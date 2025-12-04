import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { sendImagePrompt, sendTextPrompt } from './llm.mjs';
import { setObjectPathValue } from './util.mjs';
import { CLIENT_ID, promptExecutionState } from './comfyui-websocket.mjs';

// Store ComfyUI API path locally
let comfyUIAPIPath = null;

// Function to add image data entry (will be set by server.mjs)
let addImageDataEntry = null;

// Initialize generate module with ComfyUI API path
export function initializeGenerateModule(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('Generate module initialized with ComfyUI API path:', apiPath);
}

// Task tracking system
const activeTasks = new Map();
// activeTasks.set(taskId, {
//   prompt: "...",
//   workflow: "...",
//   startTime: Date.now(),
//   progress: { percentage: 0, currentStep: "Starting..." },
//   sseClients: Set of response objects,
//   promptId: "comfyui-prompt-id",
//   requestData: { ... original request data ... },
//   workflowConfig: { ... workflow configuration ... }
// });

// Map promptId to taskId for reverse lookup
const promptIdToTaskId = new Map();

export function setAddImageDataEntry(func) {
  addImageDataEntry = func;
}

// Webhook response format builders
function createProgressResponse(taskId, progress, currentStep) {
  return {
    taskId: taskId,
    status: 'in-progress',
    progress: {
      percentage: progress.percentage || 0,
      currentStep: currentStep || 'Processing...',
      currentValue: progress.value || 0,
      maxValue: progress.max || 0
    },
    timestamp: new Date().toISOString()
  };
}

function createCompletionResponse(taskId, result) {
  return {
    taskId: taskId,
    status: 'completed',
    progress: {
      percentage: 100,
      currentStep: 'Complete',
      currentValue: result.maxValue || 1,
      maxValue: result.maxValue || 1
    },
    result: {
      imageUrl: result.imageUrl,
      description: result.description,
      prompt: result.prompt,
      seed: result.seed,
      name: result.name,
      workflow: result.workflow,
      inpaint: result.inpaint || false,
      inpaintArea: result.inpaintArea || null,
      uid: result.uid
    },
    timestamp: new Date().toISOString()
  };
}

function createErrorResponse(taskId, errorMessage, errorDetails) {
  return {
    taskId: taskId,
    status: 'error',
    progress: {
      percentage: 0,
      currentStep: 'Failed',
      currentValue: 0,
      maxValue: 0
    },
    error: {
      message: errorMessage || 'Generation failed',
      details: errorDetails || 'Unknown error'
    },
    timestamp: new Date().toISOString()
  };
}

// Function to emit SSE message to all subscribed clients for a task
function emitSSEToTask(taskId, message) {
  const task = activeTasks.get(taskId);
  if (!task || !task.sseClients) return;
  
  // Determine event type based on message status
  let eventType = 'progress';
  if (message.status === 'completed') eventType = 'complete';
  if (message.status === 'error') eventType = 'error-event';
  
  const data = JSON.stringify(message);
  const disconnectedClients = new Set();
  
  task.sseClients.forEach(client => {
    try {
      client.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } catch (error) {
      console.error(`Failed to send SSE to client for task ${taskId}:`, error);
      disconnectedClients.add(client);
    }
  });
  
  // Remove disconnected clients
  disconnectedClients.forEach(client => task.sseClients.delete(client));
}

// Function to generate unique task ID
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Clean up completed tasks after delay
function scheduleTaskCleanup(taskId) {
  setTimeout(() => {
    const task = activeTasks.get(taskId);
    if (task) {
      // Close all SSE connections
      if (task.sseClients) {
        task.sseClients.forEach(client => {
          try {
            client.end();
          } catch (error) {
            // Ignore errors when closing
          }
        });
      }
      // Remove from maps
      if (task.promptId) {
        promptIdToTaskId.delete(task.promptId);
      }
      activeTasks.delete(taskId);
      console.log(`Cleaned up task ${taskId}`);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Export functions for use in WebSocket handlers
export function emitProgressUpdate(promptId, progress, currentStep) {
  const taskId = promptIdToTaskId.get(promptId);
  if (!taskId) return;
  
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  task.progress = { percentage: progress.percentage, currentStep };
  
  const message = createProgressResponse(taskId, progress, currentStep);
  emitSSEToTask(taskId, message);
}

export function emitTaskCompletion(promptId, result) {
  const taskId = promptIdToTaskId.get(promptId);
  if (!taskId) return;
  
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  const message = createCompletionResponse(taskId, result);
  emitSSEToTask(taskId, message);
  
  scheduleTaskCleanup(taskId);
}

export function emitTaskError(promptId, errorMessage, errorDetails) {
  const taskId = promptIdToTaskId.get(promptId);
  if (!taskId) return;
  
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  const message = createErrorResponse(taskId, errorMessage, errorDetails);
  emitSSEToTask(taskId, message);
  
  scheduleTaskCleanup(taskId);
}

// SSE endpoint handler
export function handleSSEConnection(req, res) {
  const { taskId } = req.params;
  
  const task = activeTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Add client to task's SSE clients
  if (!task.sseClients) {
    task.sseClients = new Set();
  }
  task.sseClients.add(res);
  
  console.log(`SSE client connected for task ${taskId}`);
  
  // Send initial progress state
  const initialMessage = createProgressResponse(
    taskId,
    task.progress || { percentage: 0, value: 0, max: 0 },
    task.progress?.currentStep || 'Starting...'
  );
  res.write(`event: progress\ndata: ${JSON.stringify(initialMessage)}\n\n`);
  
  // Set up heartbeat to keep connection alive (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);
  
  // Store heartbeat interval for cleanup
  if (!task.heartbeatIntervals) {
    task.heartbeatIntervals = new Map();
  }
  task.heartbeatIntervals.set(res, heartbeatInterval);
  
  // Handle client disconnect
  req.on('close', () => {
    task.sseClients.delete(res);
    const interval = task.heartbeatIntervals?.get(res);
    if (interval) {
      clearInterval(interval);
      task.heartbeatIntervals.delete(res);
    }
    console.log(`SSE client disconnected for task ${taskId}`);
  });
}

// Function to upload image to ComfyUI
export async function uploadImageToComfyUI(imageBuffer, filename, imageType = "input", overwrite = false) {
  if (!comfyUIAPIPath) {
    throw new Error('Generate module not initialized - ComfyUI API path not available');
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Create FormData using the form-data package
      const formData = new FormData();
      
      // Append the image buffer as a stream
      formData.append('image', imageBuffer, {
        filename: filename,
        contentType: 'image/png'
      });
      formData.append('type', imageType);
      formData.append('overwrite', overwrite.toString().toLowerCase());
      
      console.log(`Uploading image to ComfyUI: ${filename} (type: ${imageType})`);
      
      // Parse the URL to determine if it's HTTP or HTTPS
      const url = new URL(`${comfyUIAPIPath}/upload/image`);
      const httpModule = url.protocol === 'https:' ? https : http;
      
      // Create the request
      const req = httpModule.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: formData.getHeaders()
      }, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Successfully uploaded ${filename} to ComfyUI:`, responseData);
            resolve({
              success: true,
              filename: filename,
              type: imageType,
              response: responseData
            });
          } else {
            reject(new Error(`ComfyUI upload failed: ${res.statusCode} ${res.statusMessage} - ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed for ${filename}: ${error.message}`));
      });
      
      // Pipe the form data to the request
      formData.pipe(req);
      
    } catch (error) {
      console.error(`Failed to upload ${filename} to ComfyUI:`, error);
      reject(new Error(`Upload failed for ${filename}: ${error.message}`));
    }
  });
}

// Reusable function to check ComfyUI prompt status
export async function checkPromptStatus(promptId, maxAttempts = 1800, intervalMs = 1000) {
  if (!comfyUIAPIPath) {
    throw new Error('Generate module not initialized - ComfyUI API path not available');
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${comfyUIAPIPath}/history/${promptId}`);
      
      if (!response.ok) {
        throw new Error(`History request failed: ${response.status}`);
      }
      
      const history = await response.json();
      
      // Check if the prompt exists in history
      if (history[promptId]) {
        const promptData = history[promptId];
        
        // Check if the prompt is complete (has outputs)
        if (promptData.status && promptData.status.completed) {
          console.log(`Prompt ${promptId} completed successfully`);
          return { completed: true, data: promptData };
        }
        
        // Check if there's an error
        if (promptData.status && promptData.status.status_str === 'error') {
          console.log(`Prompt ${promptId} failed with error`);
          return { completed: false, error: true, data: promptData };
        }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
    } catch (error) {
      console.error(`Error checking prompt status (attempt ${attempt + 1}):`, error);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  throw new Error(`Prompt ${promptId} did not complete within ${maxAttempts * intervalMs / 1000} seconds`);
}

// Main image generation handler
export async function handleImageGeneration(req, res, workflowConfig) {
  const { base: workflowBasePath, replace: modifications, describePrompt, namePromptPrefix } = workflowConfig;
  const { prompt, seed, savePath, workflow, imagePath, maskPath, inpaint, inpaintArea } = req.body;
  let { name } = req.body;
  
  // Validate required parameters
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt parameter is required and must be a string' });
  }

  console.log('Received generation request with prompt:', prompt);
  console.log('Using workflow:', workflowBasePath);
  
  // Generate unique task ID
  const taskId = generateTaskId();
  
  // Create task entry
  activeTasks.set(taskId, {
    prompt,
    workflow,
    startTime: Date.now(),
    progress: { percentage: 0, currentStep: 'Starting...' },
    sseClients: new Set(),
    promptId: null,
    requestData: { ...req.body },
    workflowConfig
  });
  
  console.log(`Created task ${taskId}`);
  
  // Return taskId immediately
  res.json({
    success: true,
    taskId: taskId,
    message: 'Generation task created'
  });
  
  // Process generation in background
  processGenerationTask(taskId, req.body, workflowConfig).catch(error => {
    console.error(`Error in background task ${taskId}:`, error);
    emitTaskError(taskId, 'Generation failed', error.message);
  });
}

// Background processing function
async function processGenerationTask(taskId, requestData, workflowConfig) {
  try {
    const { base: workflowBasePath, replace: modifications, describePrompt, namePromptPrefix } = workflowConfig;
    const { prompt, seed, savePath, workflow, imagePath, maskPath, inpaint, inpaintArea } = requestData;
    let { name } = requestData;
    
    const task = activeTasks.get(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found during processing`);
      return;
    }
    
    console.log('Using seed:', seed);
    console.log('Using savePath:', savePath);
    console.log('Received name:', name);
    
    // Log inpaint-specific parameters for debugging purposes
    if (inpaint) {
      console.log('Inpaint operation detected');
      console.log('Using imagePath:', imagePath);
      console.log('Using maskPath:', maskPath);
      if (inpaintArea) {
        console.log('Using inpaintArea:', inpaintArea);
      }
    }

    // Generate name if not provided and namePromptPrefix is available
    if ((!name || name.trim() === '') && namePromptPrefix) {
      try {
        console.log('Generating name using LLM...');
        const namePrompt = namePromptPrefix + prompt;
        name = await sendTextPrompt(namePrompt);
        console.log('Generated name:', name);
      } catch (error) {
        console.warn('Failed to generate name:', error.message);
        name = 'Generated Character'; // Fallback name
      }
    }

    // Load the ComfyUI workflow
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    // Fix Windows path issue by removing leading slash
    const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
    const workflowPath = path.join(actualDirname, 'resource', workflowBasePath);
    let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    
    // Apply dynamic modifications based on the modifications array
    if (modifications && Array.isArray(modifications)) {
      modifications.forEach(mod => {
        const { from, to, prefix, postfix } = mod;
        console.log(`Modifying: ${from} to ${to.join(',')} ${prefix ? 'with prefix ' + prefix : ''} ${postfix ? 'and postfix ' + postfix : ''}`);        
        let value = requestData[from];
        if(prefix) value = `${prefix} ${value}`;
        if(postfix) value = `${value} ${postfix}`;
        console.log(` - New value: ${value}`);

        if(value && to && Array.isArray(to)) {
          workflowData = setObjectPathValue(workflowData, to, value);
        }
      });
    }

    // Send request to ComfyUI
    const comfyResponse = await fetch(`${comfyUIAPIPath}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflowData,
        client_id: CLIENT_ID
      })
    });

    if (!comfyResponse.ok) {
      throw new Error(`ComfyUI request failed: ${comfyResponse.status} ${comfyResponse.statusText}`);
    }

    const comfyResult = await comfyResponse.json();
    console.log('ComfyUI response:', comfyResult);

    // Extract prompt_id from ComfyUI response
    const promptId = comfyResult.prompt_id;
    if (!promptId) {
      throw new Error('No prompt_id received from ComfyUI');
    }

    // Link promptId to taskId
    task.promptId = promptId;
    promptIdToTaskId.set(promptId, taskId);

    console.log(`Task ${taskId} linked to prompt ${promptId}, waiting for completion...`);
    
    // Wait for the prompt to complete
    const statusResult = await checkPromptStatus(promptId);
    
    if (statusResult.error) {
      throw new Error('ComfyUI generation failed');
    }

    // Check if the file was created
    if (!fs.existsSync(savePath)) {
      throw new Error(`Generated image file not found at: ${savePath}`);
    }

    console.log(`Image generated successfully, analyzing with ollama...`);

    // Analyze the generated image with ollama
    let description = '';
    try {
      // Only analyze if describePrompt is provided in workflow config
      if (describePrompt) {
        description = await sendImagePrompt(savePath, describePrompt);
        console.log('Image analysis completed:', description);
      } else {
        console.log('No describePrompt provided in workflow config, skipping image analysis');
        description = 'Image analysis not configured for this workflow';
      }
    } catch (error) {
      console.warn('Failed to analyze image with ollama:', error.message);
      description = 'Image analysis unavailable';
    }

    // Return the image URL path (relative to /image/ endpoint)
    const filename = path.basename(savePath);
    const imageUrl = `/image/${filename}`;

    // Save image data to database
    let uid = null;
    if (addImageDataEntry) {
      const imageDataEntry = {
        prompt: prompt,
        seed: seed,
        imageUrl: imageUrl,
        name: name,
        description: description,
        workflow: workflow,
        inpaint: inpaint || false,
        inpaintArea: inpaintArea || null
      };
      addImageDataEntry(imageDataEntry);
      uid = imageDataEntry.uid; // Capture the UID after it's been added by addImageDataEntry
      console.log('Image data entry saved to database with UID:', uid);
    }

    // Emit completion event
    emitTaskCompletion(promptId, {
      imageUrl: imageUrl,
      description: description,
      prompt: prompt,
      seed: seed,
      name: name,
      workflow: workflow,
      inpaint: inpaint || false,
      inpaintArea: inpaintArea || null,
      uid: uid,
      maxValue: task.progress?.max || 1
    });

    console.log(`Task ${taskId} completed successfully`);

  } catch (error) {
    console.error(`Error in task ${taskId}:`, error);
    
    // Find taskId if we only have promptId
    let finalTaskId = taskId;
    if (!activeTasks.has(taskId)) {
      // This shouldn't happen, but handle it just in case
      for (const [tid, task] of activeTasks.entries()) {
        if (task.requestData === requestData) {
          finalTaskId = tid;
          break;
        }
      }
    }
    
    emitTaskError(finalTaskId, 'Failed to process generation request', error.message);
  }
}
