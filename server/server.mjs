import express from 'express';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import multer from 'multer';
import { handleImageGeneration, setAddImageDataEntry, uploadImageToComfyUI } from './generate.mjs';
import { initializeServices, checkAndStartServices } from './services.mjs';
import { findNextIndex } from './util.mjs';

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent for ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Fix Windows path issue by removing leading slash
const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;

// Global imageData object
let imageData = { imageData: [] };

// Load image data from JSON file
function loadImageData() {
  try {
    const imageDataPath = path.join(actualDirname, 'database', 'image-data.json');
    if (fs.existsSync(imageDataPath)) {
      const data = fs.readFileSync(imageDataPath, 'utf8');
      imageData = JSON.parse(data);
      console.log('Image data loaded:', imageData.imageData.length, 'entries');
    } else {
      console.log('Image data file not found, starting with empty data');
      imageData = { imageData: [] };
    }
  } catch (error) {
    console.error('Failed to load image data:', error);
    imageData = { imageData: [] };
  }
}

// Save image data to JSON file
function saveImageData() {
  try {
    const imageDataPath = path.join(actualDirname, 'database', 'image-data.json');
    fs.writeFileSync(imageDataPath, JSON.stringify(imageData, null, 2));
    console.log('Image data saved successfully');
  } catch (error) {
    console.error('Failed to save image data:', error);
  }
}

// Add image data entry
export function addImageDataEntry(entry) {
  const now = new Date();
  entry.timestamp = now.toISOString();
  entry.uid = now.getTime(); // Generate UID using Date.getTime()
  imageData.imageData.push(entry);
  saveImageData();
}

// Load configuration
let config;
let comfyuiWorkflows;
try {
  config = JSON.parse(fs.readFileSync(path.join(actualDirname, 'config.json'), 'utf8'));
  console.log('Configuration loaded:', config);
  
  // Load ComfyUI workflows
  comfyuiWorkflows = JSON.parse(fs.readFileSync(path.join(actualDirname, 'resource', 'comfyui-workflows.json'), 'utf8'));
  console.log('ComfyUI workflows loaded:', comfyuiWorkflows);
  
  // Initialize services module with config
  initializeServices(config);
  
  // Set up the image data entry function for generate.mjs
  setAddImageDataEntry(addImageDataEntry);
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

// Serve images from storage folder
app.use('/image', express.static(path.join(actualDirname, 'storage')));

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

// POST endpoint for ComfyUI image generation
app.post('/generate/txt2img', (req, res) => {
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
    
    // Create savePath similar to how handleImageGeneration creates fullPath
    const storageFolder = path.join(actualDirname, 'storage');
    if (!fs.existsSync(storageFolder)) {
      fs.mkdirSync(storageFolder, { recursive: true });
    }
    
    const nextIndex = findNextIndex('image', storageFolder);
    const filename = `image_${nextIndex}.${workflowData.format || 'png'}`;
    req.body.savePath = path.join(storageFolder, filename);
    
    // Call handleImageGeneration with workflow data and modifications
    handleImageGeneration(req, res, workflowData);
  } catch (error) {
    console.error('Error in txt2img endpoint:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// GET endpoint for image data search
app.get('/image-data', (req, res) => {
  try {
    const query = req.query.query || '';
    const sort = req.query.sort || 'descending';
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`Image data endpoint called with query="${query}", sort="${sort}", limit=${limit}`);
    
    // Filter by query (search in name and timestamp formatted as yyyy-mm-dd)
    let filteredData = imageData.imageData.filter(item => {
      if (!query) return true; // No query means include all
      
      const nameMatch = item.name && item.name.toLowerCase().includes(query.toLowerCase());
      
      // Format timestamp as yyyy-mm-dd for searching
      let timestampMatch = false;
      if (item.timestamp) {
        const date = new Date(item.timestamp);
        const formattedDate = date.toISOString().split('T')[0]; // yyyy-mm-dd format
        timestampMatch = formattedDate.includes(query);
      }
      
      return nameMatch || timestampMatch;
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
    
    console.log(`Returning ${limitedData.length} entries out of ${filteredData.length} filtered from ${imageData.imageData.length} total`);
    
    res.json(limitedData);
  } catch (error) {
    console.error('Error in image-data endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve image data' });
  }
});

// GET endpoint for single image data by UID
app.get('/image-data/:uid', (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    
    // Validate UID parameter
    if (isNaN(uid)) {
      console.log(`Invalid UID parameter: ${req.params.uid}`);
      return res.status(400).json({ error: 'UID must be a valid number' });
    }
    
    console.log(`Image data by UID endpoint called with uid=${uid}`);
    
    // Search through imageData array to find matching UID
    const matchingImage = imageData.imageData.find(item => item.uid === uid);
    
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
app.delete('/image-data/delete', (req, res) => {
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
    const originalCount = imageData.imageData.length;
    
    // Remove entries with matching UIDs
    imageData.imageData = imageData.imageData.filter(item => !uids.includes(item.uid));
    
    // Count entries after deletion
    const deletedCount = originalCount - imageData.imageData.length;
    
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

// GET endpoint for workflow list
app.get('/generate/workflows', (req, res) => {
  try {
    const workflows = comfyuiWorkflows.workflows.map(workflow => ({
      name: workflow.name,
      type: workflow.type,
      autocomplete: workflow.autocomplete,
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
    const { workflow, name, seed, prompt } = req.body;
    console.log('Form data received:');
    console.log('- workflow:', workflow);
    console.log('- name:', name);
    console.log('- seed:', seed);
    console.log('- prompt:', prompt);
    
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
        uploadImageToComfyUI(imageFile.buffer, imageFilename, "input", true),
        uploadImageToComfyUI(maskFile.buffer, maskFilename, "input", true)
      ]);
      
      console.log('Both images uploaded successfully to ComfyUI');
      
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
      
      // Create storage path for the generated inpaint result image
      const storageFolder = path.join(actualDirname, 'storage');
      if (!fs.existsSync(storageFolder)) {
        fs.mkdirSync(storageFolder, { recursive: true });
      }
      
      const nextIndex = findNextIndex('image', storageFolder);
      const filename = `image_${nextIndex}.${workflowData.format || 'png'}`;
      req.body.savePath = path.join(storageFolder, filename);
      
      // Prepare request body with imagePath and maskPath from uploaded filenames
      req.body.imagePath = imageUploadResult.filename;
      req.body.maskPath = maskUploadResult.filename;
      req.body.inpaint = true;
      
      // Remove uploads data from request body before calling handleImageGeneration
      delete req.body.uploads;
      
      // Call handleImageGeneration with workflow data and modifications
      handleImageGeneration(req, res, workflowData);
      
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
  loadImageData();
  
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
