import express from 'express';
import path from 'path';
import { initializeOrchestrator, setAddMediaDataEntry, setWorkflowsData } from './features/generation/orchestrator.mjs';
import { loadWorkflows, validateNoNestedExecuteWorkflow } from './features/generation/workflow-validator.mjs';
import { handleMediaGeneration } from './features/generation/orchestrator.mjs';
import { initialize as initComfyClient } from './features/generation/comfy-client.mjs';
import { uploadFileToComfyUI, setUploadAddMediaDataEntry } from './features/upload/service.mjs';
import { logProgressEvent, emitProgressUpdate, emitTaskCompletion, emitTaskError, handleSSEConnection } from './sse.mjs';
import { initializeServices, checkAndStartServices } from './services.mjs';
import { setEmitFunctions, initComfyUIWebSocket } from './comfyui-websocket.mjs';
import { handleSaveExport, handlePostExport } from './export.mjs';

// Core infrastructure
import { SERVER_DIR, PUBLIC_DIR, STORAGE_DIR } from './core/paths.mjs';
import { loadConfig } from './core/config.mjs';
import {
  loadMediaData, addMediaDataEntry, findMediaByUid
} from './core/database.mjs';

// Feature routers
import mediaRouter from './features/media/router.mjs';
import uploadRouter from './features/upload/router.mjs';
import generationRouter from './features/generation/router.mjs';
import { upload } from './features/upload/router.mjs';

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

  // Set workflows data in orchestrator module
  setWorkflowsData(comfyuiWorkflows);

  // Set up emit functions for WebSocket handlers
  setEmitFunctions({ emitProgressUpdate, emitTaskCompletion, emitTaskError, logProgressEvent });

  // Initialize ComfyUI client with API path (used for file uploads)
  initComfyClient(config.comfyuiAPIPath);

  // Initialize orchestrator with ComfyUI API path
  initializeOrchestrator(config.comfyuiAPIPath);

  // Initialize ComfyUI WebSocket with API path from config
  initComfyUIWebSocket(config.comfyuiAPIPath);
} catch (error) {
  console.error('Failed to load configuration files:', error);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

// Expose shared dependencies to feature routers via app.locals
app.locals.config = config;
app.locals.comfyuiWorkflows = comfyuiWorkflows;
app.locals.uploadFileToComfyUI = uploadFileToComfyUI;

// ---------------------------------------------------------------------------
// Mount feature routers
// ---------------------------------------------------------------------------
app.use(mediaRouter);
app.use(uploadRouter);
app.use(generationRouter);

// ---------------------------------------------------------------------------
// Routes that remain in server.mjs (not yet migrated to a feature domain)
// ---------------------------------------------------------------------------

// Serve textarea-caret-position library from node_modules
app.get('/lib/textarea-caret-position.js', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, '../node_modules/textarea-caret-position/index.js'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// SSE endpoint for task progress
app.get('/progress/:taskId', handleSSEConnection);

// Serve images from storage folder
app.use('/media', express.static(STORAGE_DIR));

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
    
    // Handle export based on type
    let result;
    if (exportConfig.exportType === 'save') {
      result = await handleSaveExport(exportConfig, mediaData, STORAGE_DIR);
    } else if (exportConfig.exportType === 'post') {
      result = await handlePostExport(exportConfig, mediaData, STORAGE_DIR);
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

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

async function startServer() {
  // Load image data on server initialization
  loadMediaData();
  
  await checkAndStartServices();
  
  app.listen(PORT, () => {
    console.log(`🌐 Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
