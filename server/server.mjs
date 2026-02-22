import express from 'express';
import path from 'path';
import { initializeOrchestrator, setAddMediaDataEntry } from './features/generation/orchestrator.mjs';
import { loadWorkflows } from './features/generation/workflow-validator.mjs';
import { handleMediaGeneration } from './features/generation/orchestrator.mjs';
import { initialize as initComfyClient } from './features/generation/comfy-client.mjs';
import { uploadFileToComfyUI, setUploadAddMediaDataEntry } from './features/upload/service.mjs';
import { initializeServices, checkAndStartServices } from './core/service-manager.mjs';
import { setEmitFunctions, initComfyUIWebSocket } from './comfyui-websocket.mjs';

// Core infrastructure
import { SERVER_DIR, PUBLIC_DIR, STORAGE_DIR } from './core/paths.mjs';
import { loadConfig } from './core/config.mjs';
import {
  loadMediaData, addMediaDataEntry, findMediaByUid
} from './core/database.mjs';
import { logProgressEvent, emitProgressUpdate, emitTaskCompletion, emitTaskError, handleSSEConnection } from './core/sse.mjs';

// Feature routers
import mediaRouter from './features/media/router.mjs';
import uploadRouter from './features/upload/router.mjs';
import generationRouter from './features/generation/router.mjs';
import exportRouter from './features/export/router.mjs';
import workflowsRouter from './features/workflows/router.mjs';
import llmRouter from './features/llm/router.mjs';
import brewRouter from './features/brew/router.mjs';

const app = express();

// ---------------------------------------------------------------------------
// Bootstrap: load config, workflows, and initialize sub-modules
// ---------------------------------------------------------------------------
let config;
try {
  config = loadConfig();
  console.log('Configuration loaded:', config);

  // Initialize services module with config
  initializeServices(config);

  // Set up the image data entry function for orchestrator and upload modules
  setAddMediaDataEntry(addMediaDataEntry);
  setUploadAddMediaDataEntry(addMediaDataEntry);

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
app.locals.uploadFileToComfyUI = uploadFileToComfyUI;

// ---------------------------------------------------------------------------
// Mount feature routers
// ---------------------------------------------------------------------------
app.use(mediaRouter);
app.use(uploadRouter);
app.use(generationRouter);
app.use(exportRouter);
app.use(workflowsRouter);
app.use(llmRouter);
app.use(brewRouter);

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

// GET /workflows – public list (non-hidden only, for the generator UI)
// Reads from disk each call so it always reflects the latest saved state.
app.get('/workflows', (req, res) => {
  try {
    const data = loadWorkflows();
    const workflows = data.workflows
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

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

async function startServer() {
  // Load image data on server initialization
  loadMediaData();
  
  await checkAndStartServices();
  
  const port = config.serverPort || 3000;
  app.listen(port, () => {
    console.log(`🌐 Server running at http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
