import express from 'express';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import multer from 'multer';
import { handleMediaGeneration, setAddMediaDataEntry, uploadFileToComfyUI, handleSSEConnection, emitProgressUpdate, emitTaskCompletion, emitTaskError, initializeGenerateModule, modifyGenerationDataWithPrompt, handleMediaUpload } from './generate.mjs';
import { modifyDataWithPrompt, resetPromptLog } from './llm.mjs';
import { createTask, deleteTask, getTask, resetProgressLog, logProgressEvent } from './sse.mjs';
import { initializeServices, checkAndStartServices } from './services.mjs';
import { findNextIndex } from './util.mjs';
import { setEmitFunctions, initComfyUIWebSocket } from './comfyui-websocket.mjs';

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent for ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Fix Windows path issue by removing leading slash
const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;

// Global mediaData object
let mediaData = { imageData: [], folders: [], currentFolder: '' };

// Load image data from JSON file
function loadMediaData() {
  try {
    const imageDataPath = path.join(actualDirname, 'database', 'media-data.json');
    if (fs.existsSync(imageDataPath)) {
      const data = fs.readFileSync(imageDataPath, 'utf8');
      mediaData = JSON.parse(data);
      
      // Ensure folders and currentFolder exist
      if (!mediaData.folders) {
        mediaData.folders = [];
      }
      if (!mediaData.currentFolder && mediaData.currentFolder !== '') {
        mediaData.currentFolder = '';
      }
      if (!mediaData.imageData) {
        mediaData.imageData = [];
      }
      
      console.log('Image data loaded:', mediaData.imageData.length, 'entries,', mediaData.folders.length, 'folders');
    } else {
      console.log('Image data file not found, starting with empty data');
      mediaData = { imageData: [], folders: [], currentFolder: '' };
    }
  } catch (error) {
    console.error('Failed to load image data:', error);
    mediaData = { imageData: [], folders: [], currentFolder: '' };
  }
}

// Save image data to JSON file
function saveMediaData() {
  try {
    const databaseDir = path.join(actualDirname, 'database');
    const imageDataPath = path.join(databaseDir, 'media-data.json');
    
    // Create database directory if it doesn't exist
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
      console.log('Created database directory');
    }
    
    fs.writeFileSync(imageDataPath, JSON.stringify(mediaData, null, 2));
    console.log('Image data saved successfully');
  } catch (error) {
    console.error('Failed to save image data:', error);
  }
}

// Add image data entry
export function addMediaDataEntry(entry) {
  const now = new Date();
  entry.timestamp = now.toISOString();
  entry.uid = now.getTime(); // Generate UID using Date.getTime()
  
  // Add current folder to the entry
  entry.folder = mediaData.currentFolder || '';
  
  mediaData.imageData.push(entry);
  saveMediaData();
}

// Load configuration
let config;
let comfyuiWorkflows;
try {
  const configPath = path.join(actualDirname, 'config.json');
  const defaultConfigPath = path.join(actualDirname, 'config.default.json');
  
  // If config.json doesn't exist, copy from config.default.json
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(defaultConfigPath)) {
      fs.copyFileSync(defaultConfigPath, configPath);
      console.log('Created config.json from config.default.json');
    } else {
      throw new Error('Neither config.json nor config.default.json found');
    }
  }
  
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Configuration loaded:', config);
  
  // Load ComfyUI workflows
  comfyuiWorkflows = JSON.parse(fs.readFileSync(path.join(actualDirname, 'resource', 'comfyui-workflows.json'), 'utf8'));
  console.log('ComfyUI workflows loaded:', comfyuiWorkflows);
  
  // Initialize services module with config
  initializeServices(config);
  
  // Set up the image data entry function for generate.mjs
  setAddMediaDataEntry(addMediaDataEntry);
  
  // Set up emit functions for WebSocket handlers
  setEmitFunctions({ emitProgressUpdate, emitTaskCompletion, emitTaskError, logProgressEvent });
  
  // Initialize generate module with ComfyUI API path
  initializeGenerateModule(config.comfyuiAPIPath);
  
  // Initialize ComfyUI WebSocket with API path from config
  initComfyUIWebSocket(config.comfyuiAPIPath);
} catch (error) {
  console.error('Failed to load configuration files:', error);
  process.exit(1);
}

// Middleware
app.use(express.static(path.join(actualDirname, '../public')));
app.use(express.json());

// Configure multer for file uploads (in-memory storage for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 2 // Allow up to 2 files (image + mask)
  },
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Serve textarea-caret-position library from node_modules
app.get('/lib/textarea-caret-position.js', (req, res) => {
  res.sendFile(path.join(actualDirname, '../node_modules/textarea-caret-position/index.js'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(actualDirname, '../public/index.html'));
});

// SSE endpoint for task progress
app.get('/progress/:taskId', handleSSEConnection);

// Serve images from storage folder
app.use('/media', express.static(path.join(actualDirname, 'storage')));

app.get('/tags', (req, res) => {
  // Parse query parameters with defaults
  const noCharacters = req.query.noCharacters !== 'false'; // Default to true
  const minLength = parseInt(req.query.minLength) || 4; // Default to 4
  const minUsageCount = parseInt(req.query.minUsageCount) || 100; // Default to 100
  const filterCategories = req.query.categories ? req.query.categories.split(',') : ['0'];

  console.log(`Tags endpoint called with filters: noCharacters=${noCharacters}, minLength=${minLength}, minUsageCount=${minUsageCount}, categories=${filterCategories}`);

  let debugOutput = 2;
  const results = [];
  fs.createReadStream(path.join(actualDirname, 'resource', 'danbooru_tags.csv'))
    .pipe(csv())
    .on('data', (row) => {
      // For CSV with headers: row.tag = tag, row.count = usage count
      const tagName = row.tag;
      const category = row.category; // If there's a category column
      const usageCount = parseInt(row.count) || 0;
      
      if(debugOutput) {
        debugOutput--;
        console.log(`Debugging tags: ${JSON.stringify(row)}`);
      }
      if (!tagName || !category || !filterCategories.some(cat => cat === category)) return; // Skip empty entries

      // Apply filters
      let shouldInclude = true;
      
      // Filter 1: noCharacters - remove entries with parentheses
      if (noCharacters && (tagName.includes('(') && tagName.includes(')'))) {
        shouldInclude = false;
      }
      
      // Filter 2: minLength - remove entries shorter than minLength
      if (shouldInclude && tagName.length < minLength) {
        shouldInclude = false;
      }
      
      // Filter 3: minUsageCount - remove entries with usage count less than minUsageCount
      if (shouldInclude && usageCount < minUsageCount) {
        shouldInclude = false;
      }
      
      if (shouldInclude) {
        // Convert underscores to spaces before adding to results
        results.push(tagName.replace(/_/g, ' '));
      }
    })
    .on('end', () => {
      console.log(`Tags filtered: ${results.length} tags returned after applying filters`);
      res.json({ 
        tags: results,
        filters: {
          noCharacters,
          minLength,
          minUsageCount,
          totalReturned: results.length
        }
      });
    })
    .on('error', (err) => {
      console.error('Error reading tags.csv:', err);
      res.status(500).json({ error: 'Failed to load tags.csv' });
    });
});

// POST endpoint for uploading images
app.post('/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Initialize sent-prompt.json logging
    resetPromptLog();
    resetProgressLog();
    
    console.log('Received image upload:', req.file.originalname);
    
    // Create upload task and get task ID
    const taskId = await handleImageUpload(req.file, comfyuiWorkflows);
    
    // Return task ID immediately
    res.json({
      success: true,
      taskId: taskId,
      message: 'Upload task created'
    });
    
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
});

// POST endpoint for ComfyUI image generation
app.post('/generate', upload.any(), async (req, res) => {
  try {
    const { workflow } = req.body;
    
    // Check if workflow name is provided
    if (!workflow) {
      return res.status(400).json({ error: 'Workflow parameter is required' });
    }
    
    // Find the workflow in comfyuiWorkflows
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === workflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Workflow '${workflow}' not found` });
    }
    
    // Generate random seed if not provided
    if (!req.body.seed) {
      req.body.seed = Math.floor(Math.random() * 4294967295);
      console.log('Generated random seed:', req.body.seed);
    }
    
    // Create saveImagePath similar to how handleMediaGeneration creates fullPath
    const storageFolder = path.join(actualDirname, 'storage');
    if (!fs.existsSync(storageFolder)) {
      fs.mkdirSync(storageFolder, { recursive: true });
    }
    
    const nextIndex = findNextIndex('image', storageFolder);
    const filename = `image_${nextIndex}.${workflowData.imageFormat || 'png'}`;
    req.body.saveImagePath = path.join(storageFolder, filename);
    
    // Handle file uploads if workflow specifies them
    // First, validate that required images are provided
    const requiredImages = workflowData.options?.inputImages || 0;
    const uploadedImages = req.files ? req.files.length : 0;
    
    if (requiredImages > 0 && uploadedImages < requiredImages) {
      console.log(`Workflow '${workflow}' requires ${requiredImages} image(s), but only ${uploadedImages} were provided`);
      return res.status(400).json({ 
        error: `Workflow requires ${requiredImages} input image(s), but only ${uploadedImages} were provided` 
      });
    }
    
    if (workflowData.upload && Array.isArray(workflowData.upload) && req.files && req.files.length > 0) {
      try {
        console.log('Processing uploaded images for image workflow...');
        
        // Create a map of uploaded files by field name
        const uploadedFilesByName = {};
        req.files.forEach(file => {
          uploadedFilesByName[file.fieldname] = file;
        });
        
        // Process each upload specification
        for (const uploadSpec of workflowData.upload) {
          const { from, storePathAs } = uploadSpec;
          
          if (uploadedFilesByName[from]) {
            const imageFile = uploadedFilesByName[from];
            console.log(`Processing uploaded image for field '${from}'...`);
            
            // Generate unique filename for ComfyUI upload
            const timestamp = Date.now();
            const uploadFilename = `image_${from}_${timestamp}.png`;
            
            // Upload image to ComfyUI
            const uploadResult = await uploadFileToComfyUI(imageFile.buffer, uploadFilename, "input", true);
            console.log(`Image uploaded successfully: ${uploadFilename}`);
            
            // Store the filename in request body using the specified variable name
            req.body[storePathAs] = uploadResult.filename;
            console.log(`Stored uploaded image path as '${storePathAs}': ${uploadResult.filename}`);
          }
        }
        
        // Remove files from request body before calling handleMediaGeneration
        delete req.files;
      } catch (uploadError) {
        console.error('Failed to upload images to ComfyUI:', uploadError);
        return res.status(500).json({ error: 'Failed to upload images', details: uploadError.message });
      }
    }
    
    // Call handleImageGeneration with workflow data and modifications
    handleMediaGeneration(req, res, workflowData);
  } catch (error) {
    console.error('Error in image endpoint:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// GET endpoint for image data search
app.get('/media-data', (req, res) => {
  try {
    const query = req.query.query || '';
    const tagsParam = req.query.tags || '';
    const sort = req.query.sort || 'descending';
    const limit = parseInt(req.query.limit) || 10;
    
    // Get folder parameter, default to currentFolder if not provided
    const folderParam = req.query.folder !== undefined ? req.query.folder : mediaData.currentFolder;
    const folderId = folderParam || '';
    
    // Parse tags from comma-separated string
    const tags = tagsParam ? tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
    
    console.log(`Image data endpoint called with query="${query}", tags=[${tags.join(', ')}], folder="${folderId}", sort="${sort}", limit=${limit}`);
    
    // Filter by query, tags, and folder
    let filteredData = mediaData.imageData.filter(item => {
      // Folder match - check if item belongs to the requested folder
      let folderMatch = true;
      if (folderId === '') {
        // Unsorted folder - include items with no folder, empty string, null, or undefined
        folderMatch = !item.folder || item.folder === '';
      } else {
        // Specific folder - must match exactly
        folderMatch = item.folder === folderId;
      }
      
      // Query match (search in name, description, prompt, and timestamp formatted as yyyy-mm-dd)
      let queryMatch = true;
      if (query) {
        const nameMatch = item.name && item.name.toLowerCase().includes(query.toLowerCase());
        const descriptionMatch = item.description && item.description.toLowerCase().includes(query.toLowerCase());
        const promptMatch = item.prompt && item.prompt.toLowerCase().includes(query.toLowerCase());
        
        // Format timestamp as yyyy-mm-dd for searching
        let timestampMatch = false;
        if (item.timestamp) {
          const date = new Date(item.timestamp);
          const formattedDate = date.toISOString().split('T')[0]; // yyyy-mm-dd format
          timestampMatch = formattedDate.includes(query);
        }
        
        queryMatch = nameMatch || descriptionMatch || promptMatch || timestampMatch;
      }
      
      // Tag match - image must contain ALL tags (case insensitive)
      let tagMatch = true;
      if (tags.length > 0) {
        tagMatch = item.tags && Array.isArray(item.tags) && 
          tags.every(searchTag => 
            item.tags.some(itemTag => 
              itemTag.toLowerCase() === searchTag.toLowerCase()
            )
          );
      }
      
      // All conditions must be true
      return folderMatch && queryMatch && tagMatch;
    });
    
    // Sort by timestamp
    filteredData.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      
      if (sort === 'ascending') {
        return dateA - dateB;
      } else {
        // Default to descending for any other value
        return dateB - dateA;
      }
    });
    
    // Apply limit
    const limitedData = filteredData.slice(0, limit);
    
    console.log(`Returning ${limitedData.length} entries out of ${filteredData.length} filtered from ${mediaData.imageData.length} total`);
    
    res.json(limitedData);
  } catch (error) {
    console.error('Error in image-data endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve image data' });
  }
});

// GET endpoint for single image data by UID
app.get('/media-data/:uid', (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    
    // Validate UID parameter
    if (isNaN(uid)) {
      console.log(`Invalid UID parameter: ${req.params.uid}`);
      return res.status(400).json({ error: 'UID must be a valid number' });
    }
    
    console.log(`Image data by UID endpoint called with uid=${uid}`);
    
    // Search through imageData array to find matching UID
    const matchingImage = mediaData.imageData.find(item => item.uid === uid);
    
    if (!matchingImage) {
      console.log(`No image found with UID: ${uid}`);
      return res.status(404).json({ error: `Image with UID ${uid} not found` });
    }
    
    console.log(`Found image with UID ${uid}: ${matchingImage.name || 'unnamed'}`);
    res.json(matchingImage);
    
  } catch (error) {
    console.error('Error in image-data/:uid endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve image data' });
  }
});

// DELETE endpoint for image data deletion
app.delete('/media-data/delete', (req, res) => {
  try {
    const { uids } = req.body;
    
    // Validate input
    if (!Array.isArray(uids)) {
      return res.status(400).json({ error: 'uids must be an array' });
    }
    
    if (uids.length === 0) {
      return res.status(400).json({ error: 'uids array cannot be empty' });
    }
    
    // Validate that all UIDs are numbers
    const invalidUids = uids.filter(uid => typeof uid !== 'number' || !Number.isInteger(uid));
    if (invalidUids.length > 0) {
      return res.status(400).json({ error: 'All UIDs must be integers', invalidUids });
    }
    
    console.log(`Delete request for UIDs: ${uids.join(', ')}`);
    
    // Count entries before deletion
    const originalCount = mediaData.imageData.length;
    
    // Remove entries with matching UIDs
    mediaData.imageData = mediaData.imageData.filter(item => !uids.includes(item.uid));
    
    // Count entries after deletion
    const deletedCount = originalCount - mediaData.imageData.length;
    
    // Save changes to file
    try {
      saveImageData();
      console.log(`Successfully deleted ${deletedCount} entries`);
      res.json({ 
        success: true, 
        deletedCount,
        message: `Successfully deleted ${deletedCount} entries`
      });
    } catch (saveError) {
      console.error('Failed to save after deletion:', saveError);
      res.status(500).json({ 
        error: 'Failed to save changes after deletion', 
        details: saveError.message 
      });
    }
    
  } catch (error) {
    console.error('Error in image-data delete endpoint:', error);
    res.status(500).json({ error: 'Failed to process deletion request', details: error.message });
  }
});
// POST endpoint for editing image data
app.post('/edit', (req, res) => {
  try {
    const requestData = req.body;
    
    // Check if request is an array or single object
    const isArray = Array.isArray(requestData);
    const dataToUpdate = isArray ? requestData : [requestData];
    
    // Validate all items
    for (const item of dataToUpdate) {
      if (!item.uid) {
        return res.status(400).json({ error: 'Missing required field: uid in one or more items' });
      }
      if (typeof item.uid !== 'number' || !Number.isInteger(item.uid)) {
        return res.status(400).json({ error: `UID must be an integer, got ${typeof item.uid} for uid ${item.uid}` });
      }
    }
    
    console.log(`Edit request for ${dataToUpdate.length} item(s)`);
    
    const updatedItems = [];
    const notFoundUids = [];
    
    // Process each item
    for (const updatedData of dataToUpdate) {
      const imageIndex = mediaData.imageData.findIndex(item => item.uid === updatedData.uid);
      
      if (imageIndex === -1) {
        notFoundUids.push(updatedData.uid);
        continue;
      }
      
      // Replace the entire object in place with the new data
      mediaData.imageData[imageIndex] = updatedData;
      updatedItems.push(updatedData);
    }
    
    // Check if any items were not found
    if (notFoundUids.length > 0) {
      console.log(`Images not found for UIDs: ${notFoundUids.join(', ')}`);
      return res.status(404).json({ 
        error: `Images not found for UIDs: ${notFoundUids.join(', ')}`,
        notFoundUids 
      });
    }
    
    // Save changes to file
    try {
      saveImageData();
      console.log(`Successfully updated ${updatedItems.length} image data item(s)`);
      
      // Return array or single item based on input
      res.json({ 
        success: true, 
        data: isArray ? updatedItems : updatedItems[0]
      });
    } catch (saveError) {
      console.error('Failed to save after edit:', saveError);
      res.status(500).json({ 
        error: 'Failed to save changes after edit', 
        details: saveError.message 
      });
    }
    
  } catch (error) {
    console.error('Error in edit endpoint:', error);
    res.status(500).json({ error: 'Failed to process edit request', details: error.message });
  }
});

// POST endpoint for regenerating text fields
app.post('/regenerate', async (req, res) => {
  try {
    const { uid, fields } = req.body;
    
    // Validate required fields
    if (!uid) {
      return res.status(400).json({ error: 'Missing required field: uid' });
    }
    
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid fields array' });
    }
    
    // Initialize sent-prompt.json logging
    resetPromptLog();
    resetProgressLog();
    
    console.log(`Regenerate request for UID: ${uid}, fields: ${fields.join(', ')}`);
    
    // Find the image data
    const imageIndex = mediaData.imageData.findIndex(item => item.uid === uid);
    
    if (imageIndex === -1) {
      console.log(`No image found with UID: ${uid}`);
      return res.status(404).json({ error: `Image with uid ${uid} not found` });
    }
    
    const imageEntry = mediaData.imageData[imageIndex];
    
    // Reconstruct saveImagePath from imageUrl
    // imageUrl format: /media/filename.ext -> storage/filename.ext
    if (imageEntry.imageUrl) {
      const filename = imageEntry.imageUrl.replace(/^\/media\//, '');
      imageEntry.saveImagePath = path.join(actualDirname, 'storage', filename);
      console.log(`Reconstructed saveImagePath: ${imageEntry.saveImagePath}`);
    }
    
    // Create a task ID for progress tracking
    const taskId = `regenerate-${uid}-${Date.now()}`;
    
    // Create task in SSE system
    createTask(taskId, {
      type: 'regenerate',
      uid: uid,
      fields: fields
    });
    
    // Send initial response with taskId for SSE tracking
    res.json({ taskId, message: 'Regeneration started' });
    
    try {
      // Get postGenerationTasks from comfyui-workflows
      const postGenTasks = comfyuiWorkflows.defaultImageGenerationTasks || [];
      
      let completedFields = 0;
      const totalFields = fields.length;
      
      // Process each field
      for (const field of fields) {
        console.log(`Regenerating field: ${field}`);
        
        // Find the matching task from config where task.to === field
        const task = postGenTasks.find(t => t.to === field);
        
        if (!task) {
          console.log(`No postGenerationTask found for field: ${field}`);
          emitProgressUpdate(taskId, `Skipping ${field} - no task configured`, completedFields / totalFields);
          completedFields++;
          continue;
        }
        
        // Emit progress
        emitProgressUpdate(taskId, `Regenerating ${field}...`, completedFields / totalFields);
        
        // Call modifyDataWithPrompt to regenerate the field
        await modifyDataWithPrompt(task, imageEntry);
        
        completedFields++;
        console.log(`Completed regeneration for field: ${field}`);
      }
      
      // Save updated image data
      saveMediaData();
      
      // Remove temporary saveImagePath field before sending to client
      const { saveImagePath, ...imageDataForClient } = imageEntry;
      
      // Send custom completion message with full image data
      const task = getTask(taskId);
      if (task && task.sseClients) {
        const completionMessage = {
          taskId: taskId,
          status: 'completed',
          progress: {
            percentage: 100,
            currentStep: 'Complete',
            currentValue: 1,
            maxValue: 1
          },
          imageData: imageDataForClient,
          message: 'Regeneration complete',
          timestamp: new Date().toISOString()
        };
        
        const data = JSON.stringify(completionMessage);
        task.sseClients.forEach(client => {
          try {
            client.write(`event: complete\ndata: ${data}\n\n`);
          } catch (error) {
            console.error(`Failed to send completion to client:`, error);
          }
        });
      }
      
      console.log(`Regeneration completed for UID: ${uid}`);
      
      // Clean up task after a delay to allow clients to receive completion message
      setTimeout(() => deleteTask(taskId), 5000);
      
    } catch (regenerateError) {
      console.error('Error during regeneration:', regenerateError);
      emitTaskError(taskId, `Regeneration failed: ${regenerateError.message}`);
      
      // Clean up task after error
      setTimeout(() => deleteTask(taskId), 5000);
    }
    
  } catch (error) {
    console.error('Error in regenerate endpoint:', error);
    res.status(500).json({ error: 'Failed to process regenerate request', details: error.message });
  }
});

// GET endpoint for folder data
app.get('/folder', (req, res) => {
  try {
    // Ensure folders and currentFolder exist
    if (!mediaData.folders) {
      mediaData.folders = [];
    }
    if (!mediaData.currentFolder && mediaData.currentFolder !== '') {
      mediaData.currentFolder = '';
    }
    
    // Build folder list with "Unsorted" as first item
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...mediaData.folders
    ];
    
    console.log(`Folder list retrieved: ${folderList.length} folders, current: "${mediaData.currentFolder}"`);
    
    res.json({
      list: folderList,
      current: mediaData.currentFolder
    });
  } catch (error) {
    console.error('Error in GET /folder endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve folder data' });
  }
});

// POST endpoint to create/set current folder
app.post('/folder', (req, res) => {
  try {
    const { uid, label } = req.body;
    
    // Determine what parameters were provided
    const hasUid = uid !== undefined && uid !== null;
    const hasLabel = label !== undefined && label !== null && typeof label === 'string' && label.trim().length > 0;
    
    // Validate that at least one parameter is provided
    if (!hasUid && !hasLabel) {
      return res.status(400).json({ error: 'Must provide either uid or label' });
    }
    
    // Initialize folders array if needed
    if (!mediaData.folders) {
      mediaData.folders = [];
    }
    
    let folder;
    
    // Case 1: Only uid provided - select existing folder
    if (hasUid && !hasLabel) {
      if (uid === '' || uid === null) {
        // Selecting Unsorted
        mediaData.currentFolder = '';
        console.log('Selected Unsorted folder');
      } else {
        folder = mediaData.folders.find(f => f.uid === uid);
        if (!folder) {
          return res.status(404).json({ error: `Folder with uid ${uid} not found` });
        }
        mediaData.currentFolder = folder.uid;
        console.log(`Selected folder: ${folder.label} (${folder.uid})`);
      }
    }
    // Case 2: Only label provided - create new folder and select
    else if (!hasUid && hasLabel) {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid folder label' });
      }
      
      // Check if folder with this label already exists
      folder = mediaData.folders.find(f => f.label === label.trim());
      
      if (!folder) {
        // Create new folder with unique uid
        const newUid = `folder-${Date.now()}`;
        folder = { uid: newUid, label: label.trim() };
        mediaData.folders.push(folder);
        console.log(`Created new folder: ${folder.label} (${folder.uid})`);
      } else {
        console.log(`Folder already exists: ${folder.label} (${folder.uid})`);
      }
      
      mediaData.currentFolder = folder.uid;
    }
    // Case 3: Both uid and label provided
    else {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid folder label' });
      }
      
      folder = mediaData.folders.find(f => f.uid === uid);
      
      if (!folder) {
        // Create folder with specified uid and label
        folder = { uid, label: label.trim() };
        mediaData.folders.push(folder);
        console.log(`Created new folder: ${folder.label} (${folder.uid})`);
      } else if (folder.label !== label.trim()) {
        // Rename existing folder
        const oldLabel = folder.label;
        folder.label = label.trim();
        console.log(`Renamed folder from "${oldLabel}" to "${folder.label}" (${folder.uid})`);
      } else {
        console.log(`Folder already exists with matching label: ${folder.label} (${folder.uid})`);
      }
      
      mediaData.currentFolder = folder.uid;
    }
    
    // Save changes
    saveMediaData();
    
    // Return updated folder list
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...mediaData.folders
    ];
    
    res.json({
      list: folderList,
      current: mediaData.currentFolder
    });
  } catch (error) {
    console.error('Error in POST /folder endpoint:', error);
    res.status(500).json({ error: 'Failed to create/set folder' });
  }
});

// PUT endpoint to rename a folder
app.put('/folder', (req, res) => {
  try {
    const { uid, label } = req.body;
    
    // Validate input
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid folder uid' });
    }
    
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or invalid folder label' });
    }
    
    // Cannot rename the unsorted folder
    if (uid === '') {
      return res.status(400).json({ error: 'Cannot rename the Unsorted folder' });
    }
    
    // Initialize folders array if needed
    if (!mediaData.folders) {
      mediaData.folders = [];
    }
    
    // Find folder by uid
    const folder = mediaData.folders.find(f => f.uid === uid);
    
    if (!folder) {
      console.log(`Folder not found: ${uid}`);
      return res.status(404).json({ error: `Folder with uid ${uid} not found` });
    }
    
    // Update label
    const oldLabel = folder.label;
    folder.label = label.trim();
    console.log(`Renamed folder from "${oldLabel}" to "${folder.label}" (${folder.uid})`);
    
    // Save changes
    saveMediaData();
    
    // Return updated folder list
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...mediaData.folders
    ];
    
    res.json({
      list: folderList,
      current: mediaData.currentFolder
    });
  } catch (error) {
    console.error('Error in PUT /folder endpoint:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// DELETE endpoint to delete a folder
app.delete('/folder/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    
    // Validate uid
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid folder uid' });
    }
    
    // Cannot delete the unsorted folder
    if (uid === '') {
      return res.status(400).json({ error: 'Cannot delete the Unsorted folder' });
    }
    
    // Initialize folders array if needed
    if (!mediaData.folders) {
      mediaData.folders = [];
    }
    
    // Find and remove folder
    const folderIndex = mediaData.folders.findIndex(f => f.uid === uid);
    
    if (folderIndex === -1) {
      console.log(`Folder not found: ${uid}`);
      return res.status(404).json({ error: `Folder with uid ${uid} not found` });
    }
    
    const deletedFolder = mediaData.folders[folderIndex];
    mediaData.folders.splice(folderIndex, 1);
    console.log(`Deleted folder: ${deletedFolder.label} (${deletedFolder.uid})`);
    
    // If deleted folder was current, set current to unsorted
    if (mediaData.currentFolder === uid) {
      mediaData.currentFolder = '';
      console.log('Deleted folder was current, set current to Unsorted');
    }
    
    // Update all image data entries with this folder uid to have empty string
    let updatedCount = 0;
    mediaData.imageData.forEach(item => {
      if (item.folder === uid) {
        item.folder = '';
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      console.log(`Moved ${updatedCount} images from deleted folder to Unsorted`);
    }
    
    // Save changes
    saveMediaData();
    
    // Return updated folder list
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...mediaData.folders
    ];
    
    res.json({
      list: folderList,
      current: mediaData.currentFolder
    });
  } catch (error) {
    console.error('Error in DELETE /folder/:uid endpoint:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// GET endpoint for workflow list
app.get('/workflows', (req, res) => {
  try {
    const workflows = comfyuiWorkflows.workflows.map(workflow => ({
      name: workflow.name,
      ...workflow.options
    }));
    res.json(workflows);
  } catch (error) {
    console.error('Error getting workflows:', error);
    res.status(500).json({ error: 'Failed to load workflows' });
  }
});

// POST endpoint for inpaint processing
app.post('/generate/inpaint', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mask', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('=== Inpaint endpoint called ===');
    
    // Log form data fields
    const { workflow, name, seed, prompt, inpaintArea } = req.body;
    console.log('Form data received:');
    console.log('- workflow:', workflow);
    console.log('- name:', name);
    console.log('- seed:', seed);
    console.log('- prompt:', prompt);
    console.log('- inpaintArea:', inpaintArea);
    
    // Validate required fields
    if (!workflow) {
      return res.status(400).json({ error: 'Workflow parameter is required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt parameter is required' });
    }
    
    // Validate and parse inpaintArea if provided
    let parsedInpaintArea = null;
    if (inpaintArea) {
      try {
        parsedInpaintArea = JSON.parse(inpaintArea);
        if (parsedInpaintArea && typeof parsedInpaintArea === 'object' && 
            typeof parsedInpaintArea.x1 === 'number' && 
            typeof parsedInpaintArea.y1 === 'number' && 
            typeof parsedInpaintArea.x2 === 'number' && 
            typeof parsedInpaintArea.y2 === 'number') {
          console.log('Valid inpaintArea parsed:', parsedInpaintArea);
        } else {
          return res.status(400).json({ error: 'Invalid inpaintArea format - must contain x1, y1, x2, y2 coordinates' });
        }
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid inpaintArea JSON format' });
      }
    }
    
    // Validate uploaded files
    if (!req.files || !req.files.image || !req.files.mask) {
      return res.status(400).json({ error: 'Both image and mask files are required' });
    }
    
    const imageFile = req.files.image[0];
    const maskFile = req.files.mask[0];
    
    console.log('Files received:');
    console.log('- image:', imageFile.originalname, 'size:', imageFile.size, 'type:', imageFile.mimetype);
    console.log('- mask:', maskFile.originalname, 'size:', maskFile.size, 'type:', maskFile.mimetype);
    
    // Generate unique filenames for ComfyUI upload
    const timestamp = Date.now();
    const imageFilename = `inpaint_image_${timestamp}.png`;
    const maskFilename = `inpaint_mask_${timestamp}.png`;
    
    try {
      // Upload both images to ComfyUI
      console.log('Uploading images to ComfyUI...');
      
      const [imageUploadResult, maskUploadResult] = await Promise.all([
        uploadFileToComfyUI(imageFile.buffer, imageFilename, "input", true),
        uploadFileToComfyUI(maskFile.buffer, maskFilename, "input", true)
      ]);
      
      console.log('Both images uploaded successfully to ComfyUI');
      
      // Find the workflow in comfyuiWorkflows
      const workflowData = comfyuiWorkflows.workflows.find(w => w.name === workflow);
      if (!workflowData) {
        return res.status(400).json({ error: `Workflow '${workflow}' not found` });
      }
      
      // Add postGenerationTasks from comfyui-workflows to workflowData
      if (comfyuiWorkflows.postGenerationTasks) {
        workflowData.postGenerationTasks = comfyuiWorkflows.postGenerationTasks;
      }
      
      // Generate random seed if not provided
      if (!req.body.seed) {
        req.body.seed = Math.floor(Math.random() * 4294967295);
        console.log('Generated random seed:', req.body.seed);
      }
      
      // Create storage path for the generated inpaint result image
      const storageFolder = path.join(actualDirname, 'storage');
      if (!fs.existsSync(storageFolder)) {
        fs.mkdirSync(storageFolder, { recursive: true });
      }
      
      const nextIndex = findNextIndex('image', storageFolder);
      const filename = `image_${nextIndex}.${workflowData.imageFormat || 'png'}`;
      req.body.saveImagePath = path.join(storageFolder, filename);
      
      // Prepare request body with imagePath and maskPath from uploaded filenames
      req.body.imagePath = imageUploadResult.filename;
      req.body.maskPath = maskUploadResult.filename;
      req.body.inpaint = true;
      
      // Include parsed inpaintArea if provided
      if (parsedInpaintArea) {
        req.body.inpaintArea = parsedInpaintArea;
      }
      
      // Remove uploads data from request body before calling handleMediaGeneration
      delete req.body.uploads;
      
      // Call handleImageGeneration with workflow data and modifications
      handleMediaGeneration(req, res, workflowData);
      
    } catch (uploadError) {
      console.error('Failed to upload images to ComfyUI:', uploadError);
      return res.status(500).json({
        error: 'Failed to upload images to ComfyUI',
        details: uploadError.message
      });
    }
    
  } catch (error) {
    console.error('Error in inpaint endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process inpaint request', 
      details: error.message 
    });
  }
});

// Initialize services and start server
async function startServer() {
  // Load image data on server initialization
  loadMediaData();
  
  await checkAndStartServices();
  
  app.listen(PORT, () => {
    console.log(`🌐 Server running at http://localhost:${PORT}`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
