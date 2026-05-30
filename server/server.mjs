import express from 'express';
import path from 'path';
import os from 'os';
import { initializeOrchestrator, setAddMediaDataEntry } from './features/generation/orchestrator.mjs';
import { loadWorkflows } from './features/generation/workflow-validator.mjs';
import { handleMediaGeneration } from './features/generation/orchestrator.mjs';
import { initialize as initComfyClient } from './features/generation/comfy-client.mjs';
import { uploadFileToComfyUI, setUploadAddMediaDataEntry } from './features/upload/service.mjs';
import { initializeServices, checkAndStartServices, getServiceStatus, startReadinessPolling, setOnAllReady } from './core/service-manager.mjs';
import { setEmitFunctions, initComfyUIWebSocket, reconnectComfyUIWebSocket } from './comfyui-websocket.mjs';

// Core infrastructure
import { SERVER_DIR, PUBLIC_DIR, STORAGE_DIR } from './core/paths.mjs';
import { loadConfig, startConfigWatcher } from './core/config.mjs';
import { migrateAll } from './core/migrator.mjs';
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
import chatRouter from './features/chat/router.mjs';
import brewRouter from './features/brew/router.mjs';
import soundSourcesRouter from './features/sound-sources/router.mjs';
import anytaleRouter from './features/anytale/router.mjs';
import queueRouter from './features/queue/router.mjs';
import adminRouter from './features/admin/router.mjs';
import storageRouter from './features/storage/router.mjs';
import * as queueService from './features/queue/service.mjs';
import { executeQueuedTask } from './features/generation/orchestrator.mjs';

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

  // Initialize the queue service
  queueService.initialize({ config, uploadFileToComfyUI, executeQueuedTask });
} catch (error) {
  console.error('Failed to load configuration files:', error);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Pages that do not require all services to be ready
const EXEMPT_PAGES = ['/loading.html']; // future: '/config.html'

// Redirect HTML page requests to the loading page when services are not yet ready
app.use((req, res, next) => {
  const isHtmlPage = req.path.endsWith('.html') || req.path === '/';
  if (!isHtmlPage || EXEMPT_PAGES.includes(req.path)) return next();
  const { ollama, comfyui } = getServiceStatus();
  if (!ollama || !comfyui) {
    const redirect = encodeURIComponent(req.originalUrl);
    return res.redirect(`/loading.html?redirect=${redirect}`);
  }
  next();
});

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
app.use(chatRouter);
app.use(brewRouter);
app.use(soundSourcesRouter);
app.use(anytaleRouter);
app.use(queueRouter);
app.use(adminRouter);
app.use(storageRouter);

// ---------------------------------------------------------------------------
// Routes that remain in server.mjs (not yet migrated to a feature domain)
// ---------------------------------------------------------------------------

// Service readiness status endpoint
app.get('/status', (req, res) => {
  res.json(getServiceStatus());
});

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

function changedKeys(oldConfig, newConfig) {
  const keys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
  return [...keys].filter(k => oldConfig[k] !== newConfig[k]);
}

async function startServer() {
  await migrateAll();
  // Reload config after migrations so any newly-written fields are live in app.locals
  app.locals.config = loadConfig();

  // Load image data on server initialization
  loadMediaData();

  const clearQueue = process.argv.includes('--clear-queue');

  setOnAllReady(() => {
    if (clearQueue) queueService.clear();
    queueService.resume();
  });

  await checkAndStartServices();
  startReadinessPolling();

  const port = config.serverPort || 3000;
  app.listen(port, () => {
    const nets = os.networkInterfaces();
    const localIp = Object.values(nets).flat().find(n => n.family === 'IPv4' && !n.internal)?.address ?? 'localhost';
    console.log(`🌐 Server running at http://${localIp}:${port}`);
  });

  startConfigWatcher((newConfig, oldConfig) => {
    app.locals.config = newConfig;

    const changed = changedKeys(oldConfig, newConfig);
    if (changed.length > 0) {
      console.log('[config-watcher] Config reloaded. Changed keys:', changed.join(', '));
    }

    if (changed.includes('comfyuiAPIPath')) {
      initComfyClient(newConfig.comfyuiAPIPath);
      initializeOrchestrator(newConfig.comfyuiAPIPath);
      reconnectComfyUIWebSocket(newConfig.comfyuiAPIPath);
      console.log('♻️ comfyuiAPIPath updated — reconnecting to ComfyUI');
    }

    if (changed.includes('ollamaAPIPath')) {
      initializeServices(newConfig);
      console.log('♻️ ollamaAPIPath updated — service health checks will use new URL');
    }

    if (changed.includes('serverPort')) {
      console.log('⚠️ serverPort changed — restart the server to rebind the port');
    }
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
