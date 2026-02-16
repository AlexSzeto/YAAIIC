import express from 'express';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import multer from 'multer';
import { uploadFileToComfyUI, handleMediaUpload, initializeGenerateModule, setUploadAddMediaDataEntry } from './generate.mjs';
import { handleMediaGeneration, initializeOrchestrator, setAddMediaDataEntry, setWorkflowsData, modifyGenerationDataWithPrompt } from './features/generation/orchestrator.mjs';
import { loadWorkflows, validateNoNestedExecuteWorkflow } from './features/generation/workflow-validator.mjs';
import { modifyDataWithPrompt, resetPromptLog } from './llm.mjs';
import { createTask, deleteTask, getTask, resetProgressLog, logProgressEvent, emitProgressUpdate, emitTaskCompletion, emitTaskError } from './sse.mjs';
import { initializeServices, checkAndStartServices } from './services.mjs';
import { findNextIndex } from './util.mjs';
import { setEmitFunctions, initComfyUIWebSocket } from './comfyui-websocket.mjs';
import { handleSaveExport, handlePostExport, resolveMediaPath } from './export.mjs';

// Core infrastructure
import { SERVER_DIR, PUBLIC_DIR, RESOURCE_DIR, STORAGE_DIR } from './core/paths.mjs';
import { loadConfig } from './core/config.mjs';
import {
  loadMediaData, saveMediaData, addMediaDataEntry,
  getAllMediaData, findMediaByUid, findMediaIndexByUid,
  replaceMediaAtIndex, deleteMediaByUids,
  getFolders, getCurrentFolder, setCurrentFolder,
  addFolder, findFolderByUid, findFolderByLabel,
  removeFolderByUid, reassignMediaFolder
} from './core/database.mjs';

// Keep actualDirname as an alias for SERVER_DIR for the remaining
// references that haven't been migrated yet.
const actualDirname = SERVER_DIR;

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Bootstrap: load config, workflows, and initialize sub-modules
// ---------------------------------------------------------------------------
let config;
let comfyuiWorkflows;
try {
  config = loadConfig();
  console.log('Configuration loaded:', config);

  // Load ComfyUI workflows via the workflow-validator module
  comfyuiWorkflows = loadWorkflows();

  // Initialize services module with config
  initializeServices(config);

  // Set up the image data entry function for orchestrator and upload modules
  setAddMediaDataEntry(addMediaDataEntry);
  setUploadAddMediaDataEntry(addMediaDataEntry);

  // Set workflows data in generate module
  setWorkflowsData(comfyuiWorkflows);

  // Set up emit functions for WebSocket handlers
  setEmitFunctions({ emitProgressUpdate, emitTaskCompletion, emitTaskError, logProgressEvent });

  // Initialize generate module with ComfyUI API path
  initializeGenerateModule(config.comfyuiAPIPath);

  // Initialize orchestrator with ComfyUI API path
  initializeOrchestrator(config.comfyuiAPIPath);

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
    fileSize: 100 * 1024 * 1024, // 100MB limit for audio files
    files: 2 // Allow up to 2 files (image + mask, or audio + reference)
  },
  fileFilter: (req, file, cb) => {
    // Accept image and audio files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'), false);
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

  // Read category tree file
  let categoryTree = {};
  const categoryTreePath = path.join(actualDirname, 'resource', 'danbooru_category_tree.json');
  try {
    const categoryTreeData = fs.readFileSync(categoryTreePath, 'utf8');
    categoryTree = JSON.parse(categoryTreeData);
    console.log(`Category tree loaded with ${Object.keys(categoryTree).length} entries`);
  } catch (err) {
    console.error('Error reading danbooru_category_tree.json:', err.message);
    // Continue with empty category tree
  }

  let debugOutput = 2;
  const results = [];
  const definitions = {};
  
  fs.createReadStream(path.join(actualDirname, 'resource', 'danbooru_tags.csv'))
    .pipe(csv())
    .on('data', (row) => {
      // For CSV with headers: row.tag = tag, row.count = usage count
      const tagName = row.tag;
      const category = row.category; // If there's a category column
      const usageCount = parseInt(row.count) || 0;
      const definition = row.definition;
      
      if(debugOutput) {
        debugOutput--;
        console.log(`Debugging tags: ${JSON.stringify(row)}`);
      }
      if (!tagName || !category || !filterCategories.some(cat => cat === category)) return; // Skip empty entries

      // Collect all tag definitions (regardless of filters)
      if (definition && definition.trim()) {
        definitions[tagName] = definition.trim();
      }

      // Apply filters for tags list
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
      console.log(`Tag definitions loaded: ${Object.keys(definitions).length} tags with definitions`);
      res.json({ 
        tags: results,
        definitions,
        categoryTree,
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

// GET endpoint for tag definitions (deprecated - use /tags endpoint instead)
// Kept for backwards compatibility
app.get('/tag-definitions', (req, res) => {
  console.log('Tag definitions endpoint called (deprecated - redirecting to /tags)');
  
  // Redirect to /tags endpoint which now includes definitions
  res.redirect(307, '/tags');
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
    
    // Extract optional name field from request body
    const extractedName = req.body.name || null;
    
    // Create upload task and get task ID
    const taskId = await handleMediaUpload(req.file, comfyuiWorkflows, extractedName);
    
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

// POST endpoint for uploading audio files
app.post('/upload/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    // Initialize sent-prompt.json logging
    resetPromptLog();
    resetProgressLog();
    
    console.log('Received audio upload:', req.file.originalname);
    
    // Extract optional name field from request body
    const extractedName = req.body.name || null;
    
    // Create upload task and get task ID
    const taskId = await handleMediaUpload(req.file, comfyuiWorkflows, extractedName);
    
    // Return task ID immediately
    res.json({
      success: true,
      taskId: taskId,
      message: 'Upload task created'
    });
    
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({ error: 'Failed to upload audio', details: error.message });
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
    
    // Don't create saveImagePath here - it will be created after preGenerationTasks
    // so that the format can be determined from extra inputs
    
    // Fill in expected but missing image data values with blank strings
    const requiredImageDataFields = ['tags', 'prompt', 'description', 'summary'];
    requiredImageDataFields.forEach(field => {
      if (req.body[field] === undefined || req.body[field] === null) {
        req.body[field] = '';
        console.log(`Filled missing field '${field}' with blank string`);
      }
    });
    
    // Handle file uploads if workflow specifies them
    // First, validate that required images and audio files are provided
    const requiredImages = workflowData.options?.inputImages || 0;
    const requiredAudios = workflowData.options?.inputAudios || 0;
    
    // Count uploaded files by type
    let uploadedImages = 0;
    let uploadedAudios = 0;
    
    if (req.files) {
      req.files.forEach(file => {
        if (file.fieldname.startsWith('image_')) {
          uploadedImages++;
        } else if (file.fieldname.startsWith('audio_')) {
          uploadedAudios++;
        }
      });
    }
    
    // Validate image count
    if (requiredImages > 0 && uploadedImages < requiredImages) {
      console.log(`Workflow '${workflow}' requires ${requiredImages} image(s), but only ${uploadedImages} were provided`);
      return res.status(400).json({ 
        error: `Workflow requires ${requiredImages} input image(s), but only ${uploadedImages} were provided` 
      });
    }
    
    // Validate audio count
    if (requiredAudios > 0 && uploadedAudios < requiredAudios) {
      console.log(`Workflow '${workflow}' requires ${requiredAudios} audio file(s), but only ${uploadedAudios} were provided`);
      return res.status(400).json({ 
        error: `Workflow requires ${requiredAudios} input audio file(s), but only ${uploadedAudios} were provided` 
      });
    }
    
    if (workflowData.upload && Array.isArray(workflowData.upload) && req.files && req.files.length > 0) {
      try {
        console.log('Processing uploaded files for workflow...');
        
        // Create a map of uploaded files by field name
        const uploadedFilesByName = {};
        req.files.forEach(file => {
          uploadedFilesByName[file.fieldname] = file;
        });
        
        // Process each upload specification
        for (const uploadSpec of workflowData.upload) {
          const { from } = uploadSpec;
          
          if (uploadedFilesByName[from]) {
            const uploadedFile = uploadedFilesByName[from];
            const isAudio = from.startsWith('audio_');
            const fileType = isAudio ? 'audio' : 'image';
            
            console.log(`Processing uploaded ${fileType} for field '${from}'...`);
            
            // Extract extension from the uploaded file's originalname (e.g., image_0.png, audio_0.mp3)
            const fileExt = path.extname(uploadedFile.originalname) || (isAudio ? '.mp3' : '.png');
            
            // Use the storage filename with proper extension (extract from mediaData URL)
            let uploadFilename;
            if (isAudio) {
              const audioUrl = req.body[`${from}_uid`] ? 
                findMediaByUid(parseInt(req.body[`${from}_uid`]))?.audioUrl : null;
              uploadFilename = audioUrl ? audioUrl.replace('/media/', '') : `audio_${Date.now()}${fileExt}`;
            } else {
              const imageUrl = req.body[`${from}_uid`] ? 
                findMediaByUid(parseInt(req.body[`${from}_uid`]))?.imageUrl : null;
              uploadFilename = imageUrl ? imageUrl.replace('/media/', '') : `image_${Date.now()}${fileExt}`;
            }
            
            // Upload file to ComfyUI
            const uploadResult = await uploadFileToComfyUI(uploadedFile.buffer, uploadFilename, fileType, "input", true);
            console.log(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded successfully: ${uploadFilename}`);
            
            // Store the filename in request body using {from}_filename variable for reference in workflow mappings
            req.body[`${from}_filename`] = uploadResult.filename;
          }
        }
        
        // Remove files from request body before calling handleMediaGeneration
        delete req.files;
      } catch (uploadError) {
        console.error('Failed to upload files to ComfyUI:', uploadError);
        return res.status(500).json({ error: 'Failed to upload files', details: uploadError.message });
      }
    }
    
    // Validate that workflow doesn't contain nested executeWorkflow processes
    const validation = validateNoNestedExecuteWorkflow(workflowData, comfyuiWorkflows.workflows);
    if (!validation.valid) {
      console.error('Workflow validation failed:', validation.error);
      return res.status(400).json({ error: 'Workflow validation failed', details: validation.error });
    }
    
    console.log('Starting media generation with request data: ', req.body);
    // Call handleImageGeneration with workflow data and modifications
    handleMediaGeneration(req, res, workflowData, config, uploadFileToComfyUI);
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
    const folderParam = req.query.folder !== undefined ? req.query.folder : getCurrentFolder();
    const folderId = folderParam || '';
    
    // Parse tags from comma-separated string
    const tags = tagsParam ? tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
    
    console.log(`Image data endpoint called with query="${query}", tags=[${tags.join(', ')}], folder="${folderId}", sort="${sort}", limit=${limit}`);
    
    // Filter by query, tags, and folder
    let filteredData = getAllMediaData().filter(item => {
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
      // Tags in media data are stored as comma-separated strings
      let tagMatch = true;
      if (tags.length > 0) {
        if (!item.tags) {
          tagMatch = false;
        } else {
          // Convert comma-separated string to array if needed
          const itemTags = typeof item.tags === 'string' 
            ? item.tags.split(',').map(t => t.trim()) 
            : (Array.isArray(item.tags) ? item.tags : []);
          
          tagMatch = tags.every(searchTag => 
            itemTags.some(itemTag => 
              itemTag.toLowerCase() === searchTag.toLowerCase()
            )
          );
        }
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
    
    console.log(`Returning ${limitedData.length} entries out of ${filteredData.length} filtered from ${getAllMediaData().length} total`);
    
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
    const matchingImage = findMediaByUid(uid);
    
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
    const originalCount = getAllMediaData().length;
    
    // Remove entries with matching UIDs
    const deletedCount = deleteMediaByUids(uids);
    
    // Deletion count returned by deleteMediaByUids above
    
    // Save changes to file
    try {
      saveMediaData();
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
      const imageIndex = findMediaIndexByUid(updatedData.uid);
      
      if (imageIndex === -1) {
        notFoundUids.push(updatedData.uid);
        continue;
      }
      
      // Replace the entire object in place with the new data
      replaceMediaAtIndex(imageIndex, updatedData);
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
      saveMediaData();
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
    const imageIndex = findMediaIndexByUid(uid);
    
    if (imageIndex === -1) {
      console.log(`No image found with UID: ${uid}`);
      return res.status(404).json({ error: `Image with uid ${uid} not found` });
    }
    
    const imageEntry = getAllMediaData()[imageIndex];
    
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
          mediaData: imageDataForClient,
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
    // Build folder list with "Unsorted" as first item
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...getFolders()
    ];
    
    const current = getCurrentFolder();
    console.log(`Folder list retrieved: ${folderList.length} folders, current: "${current}"`);
    
    res.json({
      list: folderList,
      current
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
    
    let folder;
    
    // Case 1: Only uid provided - select existing folder
    if (hasUid && !hasLabel) {
      if (uid === '' || uid === null) {
        // Selecting Unsorted
        setCurrentFolder('');
        console.log('Selected Unsorted folder');
      } else {
        folder = findFolderByUid(uid);
        if (!folder) {
          return res.status(404).json({ error: `Folder with uid ${uid} not found` });
        }
        setCurrentFolder(folder.uid);
        console.log(`Selected folder: ${folder.label} (${folder.uid})`);
      }
    }
    // Case 2: Only label provided - create new folder and select
    else if (!hasUid && hasLabel) {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid folder label' });
      }
      
      // Check if folder with this label already exists
      folder = findFolderByLabel(label.trim());
      
      if (!folder) {
        // Create new folder with unique uid
        const newUid = `folder-${Date.now()}`;
        folder = { uid: newUid, label: label.trim() };
        addFolder(folder);
        console.log(`Created new folder: ${folder.label} (${folder.uid})`);
      } else {
        console.log(`Folder already exists: ${folder.label} (${folder.uid})`);
      }
      
      setCurrentFolder(folder.uid);
    }
    // Case 3: Both uid and label provided
    else {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid folder label' });
      }
      
      folder = findFolderByUid(uid);
      
      if (!folder) {
        // Create folder with specified uid and label
        folder = { uid, label: label.trim() };
        addFolder(folder);
        console.log(`Created new folder: ${folder.label} (${folder.uid})`);
      } else if (folder.label !== label.trim()) {
        // Rename existing folder
        const oldLabel = folder.label;
        folder.label = label.trim();
        console.log(`Renamed folder from "${oldLabel}" to "${folder.label}" (${folder.uid})`);
      } else {
        console.log(`Folder already exists with matching label: ${folder.label} (${folder.uid})`);
      }
      
      setCurrentFolder(folder.uid);
    }
    
    // Save changes
    saveMediaData();
    
    // Return updated folder list
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...getFolders()
    ];
    
    res.json({
      list: folderList,
      current: getCurrentFolder()
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
    
    // Find folder by uid
    const folder = findFolderByUid(uid);
    
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
      ...getFolders()
    ];
    
    res.json({
      list: folderList,
      current: getCurrentFolder()
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
    
    // Find and remove folder
    const deletedFolder = removeFolderByUid(uid);
    
    if (!deletedFolder) {
      console.log(`Folder not found: ${uid}`);
      return res.status(404).json({ error: `Folder with uid ${uid} not found` });
    }
    
    console.log(`Deleted folder: ${deletedFolder.label} (${deletedFolder.uid})`);
    
    // If deleted folder was current, set current to unsorted
    if (getCurrentFolder() === uid) {
      setCurrentFolder('');
      console.log('Deleted folder was current, set current to Unsorted');
    }
    
    // Update all image data entries with this folder uid to have empty string
    const updatedCount = reassignMediaFolder(uid, '');
    
    if (updatedCount > 0) {
      console.log(`Moved ${updatedCount} images from deleted folder to Unsorted`);
    }
    
    // Save changes
    saveMediaData();
    
    // Return updated folder list
    const folderList = [
      { uid: '', label: 'Unsorted' },
      ...getFolders()
    ];
    
    res.json({
      list: folderList,
      current: getCurrentFolder()
    });
  } catch (error) {
    console.error('Error in DELETE /folder/:uid endpoint:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// GET endpoint for workflow list
app.get('/workflows', (req, res) => {
  try {
    const workflows = comfyuiWorkflows.workflows
      .filter(workflow => !workflow.hidden)
      .map(workflow => ({
        name: workflow.name,
        ...workflow.options
      }));
    res.json(workflows);
  } catch (error) {
    console.error('Error getting workflows:', error);
    res.status(500).json({ error: 'Failed to load workflows' });
  }
});

// GET endpoint for export destinations list
app.get('/exports', (req, res) => {
  try {
    const { type } = req.query;
    
    // Get exports from config
    const exports = config.exports || [];
    
    // Filter by type if provided
    let filteredExports = exports;
    if (type) {
      filteredExports = exports.filter(exp => 
        exp.types && exp.types.includes(type)
      );
    }
    
    // Return only id, name, and types for client display
    const exportList = filteredExports.map(exp => ({
      id: exp.id,
      name: exp.name,
      types: exp.types
    }));
    
    console.log(`Exports endpoint called with type="${type || 'all'}", returning ${exportList.length} exports`);
    res.json(exportList);
    
  } catch (error) {
    console.error('Error in exports endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve exports' });
  }
});

// POST endpoint for exporting media
app.post('/export', async (req, res) => {
  try {
    const { exportId, mediaId } = req.body;
    
    // Validate required fields
    if (!exportId) {
      return res.status(400).json({ error: 'Missing required field: exportId' });
    }
    if (!mediaId) {
      return res.status(400).json({ error: 'Missing required field: mediaId' });
    }
    
    // Find export configuration
    const exports = config.exports || [];
    const exportConfig = exports.find(exp => exp.id === exportId);
    
    if (!exportConfig) {
      return res.status(404).json({ error: `Export configuration not found: ${exportId}` });
    }
    
    // Find media data
    const uid = parseInt(mediaId);
    const mediaData = findMediaByUid(uid);
    
    if (!mediaData) {
      return res.status(404).json({ error: `Media not found with id: ${mediaId}` });
    }
    
    console.log(`Export request: exportId="${exportId}", mediaId=${mediaId}`);
    
    // Get storage folder path
    const storageFolder = path.join(actualDirname, 'storage');
    
    // Handle export based on type
    let result;
    if (exportConfig.exportType === 'save') {
      result = await handleSaveExport(exportConfig, mediaData, storageFolder);
    } else if (exportConfig.exportType === 'post') {
      result = await handlePostExport(exportConfig, mediaData, storageFolder);
    } else {
      return res.status(400).json({ error: `Unknown export type: ${exportConfig.exportType}` });
    }
    
    if (result.success) {
      console.log(`Export successful: ${exportId}`);
      res.json({ success: true, ...result });
    } else {
      console.error(`Export failed: ${result.error}`);
      res.status(500).json({ success: false, error: result.error });
    }
    
  } catch (error) {
    console.error('Error in export endpoint:', error);
    res.status(500).json({ error: 'Failed to process export request', details: error.message });
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
    console.log('- image_0_imageFormat:', req.body.image_0_imageFormat);
    console.log('- All req.body keys:', Object.keys(req.body));
    
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
    
    // Generate filenames for ComfyUI upload
    // For inpaint image: reuse storage filename if from gallery, otherwise use temp name
    const imageUrl = req.body.imageUrl;
    const imageFilename = imageUrl ? imageUrl.replace('/media/', '') : `inpaint_image_${Date.now()}.png`;
    
    // For mask: use filename provided by client (includes dimensions and area for deduplication)
    const maskFilename = req.body.maskFilename || `mask_${Date.now()}.png`;
    
    try {
      // Upload both images to ComfyUI
      console.log('Uploading images to ComfyUI...');
      
      const [imageUploadResult, maskUploadResult] = await Promise.all([
        uploadFileToComfyUI(imageFile.buffer, imageFilename, "image", "input", true),
        uploadFileToComfyUI(maskFile.buffer, maskFilename, "image", "input", true)
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
      
      // Don't create saveImagePath here - it will be created after preGenerationTasks
      // so that the format can be determined from extra inputs
      
      // Fill in expected but missing image data values with blank strings
      const requiredImageDataFields = ['tags', 'prompt', 'description', 'summary'];
      requiredImageDataFields.forEach(field => {
        if (req.body[field] === undefined || req.body[field] === null) {
          req.body[field] = '';
          console.log(`Filled missing field '${field}' with blank string`);
        }
      });
      
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
      
      // Validate that workflow doesn't contain nested executeWorkflow processes
      const validation = validateNoNestedExecuteWorkflow(workflowData, comfyuiWorkflows.workflows);
      if (!validation.valid) {
        console.error('Workflow validation failed:', validation.error);
        return res.status(500).json({ error: 'Workflow validation failed', details: validation.error });
      }
      
      // Call handleImageGeneration with workflow data and modifications
      handleMediaGeneration(req, res, workflowData, config, uploadFileToComfyUI);
      
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
