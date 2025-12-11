import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { sendImagePrompt, sendTextPrompt } from './llm.mjs';
import { setObjectPathValue, readOutputPathFromTextFile } from './util.mjs';
import { CLIENT_ID, promptExecutionState } from './comfyui-websocket.mjs';
import {
  generateTaskId,
  createTask,
  getTask,
  updateTask,
  setTaskPromptId,
  emitProgressUpdate,
  emitTaskCompletion,
  emitTaskError,
  emitTaskErrorByTaskId,
  handleSSEConnection
} from './sse.mjs';

// Store ComfyUI API path locally
let comfyUIAPIPath = null;

// Function to add image data entry (will be set by server.mjs)
let addImageDataEntry = null;

// Timer map to track start times for each task
const taskTimers = new Map(); // taskId -> startTime

// Initialize generate module with ComfyUI API path
export function initializeGenerateModule(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('Generate module initialized with ComfyUI API path:', apiPath);
}

export function setAddImageDataEntry(func) {
  addImageDataEntry = func;
}

// Re-export SSE functions for backwards compatibility
export {
  emitProgressUpdate,
  emitTaskCompletion,
  emitTaskError,
  emitTaskErrorByTaskId,
  handleSSEConnection
};

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

// Function to calculate workflow steps based on node dependencies
export function calculateWorkflowSteps(workflow, finalNode) {
  // Map to store nodeId -> distance from final node
  const distanceMap = new Map();
  
  // Recursive function to traverse backwards through node inputs
  function traverseNode(nodeId, currentDistance) {
    // If we've already visited this node with a greater or equal distance, skip
    if (distanceMap.has(nodeId) && distanceMap.get(nodeId) >= currentDistance) {
      return;
    }
    
    // Set the distance for this node
    distanceMap.set(nodeId, currentDistance);
    
    // Get the node from workflow
    const node = workflow[nodeId];
    if (!node || !node.inputs) {
      return;
    }
    
    // Traverse all input connections
    for (const inputKey in node.inputs) {
      const inputValue = node.inputs[inputKey];
      
      // Check if input is a node connection (array format [nodeId, outputIndex])
      if (Array.isArray(inputValue) && typeof inputValue[0] === 'string') {
        const connectedNodeId = inputValue[0];
        traverseNode(connectedNodeId, currentDistance + 1);
      }
    }
  }
  
  // Start traversal from final node
  traverseNode(finalNode, 0);
  
  // Calculate total steps (max distance + 1)
  let maxDistance = 0;
  for (const distance of distanceMap.values()) {
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }
  const totalSteps = maxDistance + 1;
  
  // Build step map with display text
  const stepMap = new Map();
  for (const [nodeId, distance] of distanceMap.entries()) {
    const stepNumber = totalSteps - distance;
    const stepDisplayText = `(${stepNumber}/${totalSteps})`;
    stepMap.set(nodeId, {
      distance,
      stepNumber,
      stepDisplayText
    });
  }
  
  return { stepMap, totalSteps };
}

// Function to modify generationData with a prompt
export async function modifyGenerationDataWithPrompt(promptData, generationData) {
  try {
    const { model, prompt, to, replaceBlankFieldOnly, imagePath } = promptData;
    
    // Check if replaceBlankFieldOnly is true and target field is not blank, skip processing
    if (replaceBlankFieldOnly && generationData[to] && generationData[to].trim() !== '') {
      console.log(`Skipping prompt for ${to} - field already has a value`);
      return generationData;
    }
    
    // Extract prompt text from promptData.prompt
    let processedPrompt = prompt;
    
    // Replace bracketed placeholders (e.g., [description]) with values from generationData
    const bracketPattern = /\[(\w+)\]/g;
    processedPrompt = processedPrompt.replace(bracketPattern, (match, key) => {
      return generationData[key] || match;
    });
    
    console.log(`Processing prompt for ${to} with model ${model}`);
    console.log(`Prompt: ${processedPrompt}`);
    
    let response;
    
    // If imagePath is specified in promptData, resolve the actual path from generationData
    if (imagePath) {
      const actualImagePath = generationData[imagePath];
      if (!actualImagePath) {
        throw new Error(`Image path field '${imagePath}' not found in generationData`);
      }
      console.log(`Using image path: ${actualImagePath}`);
      response = await sendImagePrompt(actualImagePath, processedPrompt, model);
    } else {
      response = await sendTextPrompt(processedPrompt, model);
    }
    
    // Store the response in generationData[promptData.to]
    generationData[to] = response;
    console.log(`Stored response in ${to}: ${response}`);
    
    return generationData;
  } catch (error) {
    console.error(`Error in modifyGenerationDataWithPrompt:`, error);
    throw error;
  }
}

// Main image generation handler
export async function handleImageGeneration(req, res, workflowConfig) {
  const { base: workflowBasePath } = workflowConfig;
  const { workflow } = req.body;
  
  console.log('Using workflow:', workflowBasePath);
  
  // Generate unique task ID
  const taskId = generateTaskId();
  
  // Start timer for this task
  taskTimers.set(taskId, Date.now());
  
  // Create task entry
  createTask(taskId, {
    workflow,
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
    emitTaskErrorByTaskId(taskId, 'Generation failed', error.message);
  });
}

// Background processing function
async function processGenerationTask(taskId, requestData, workflowConfig) {
  try {
    const { base: workflowBasePath, replace: modifications, extractOutputPathFromTextFile, postGenerationPrompts, type } = workflowConfig;
    const { seed, savePath, workflow, imagePath, maskPath, inpaint, inpaintArea } = requestData;
    
    // Create generationData as a copy of requestData
    const generationData = { ...requestData };
    
    const task = getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found during processing`);
      return;
    }
    
    console.log('Using seed:', seed);
    console.log('Using savePath:', savePath);
    
    // Log inpaint-specific parameters for debugging purposes
    if (inpaint) {
      console.log('Inpaint operation detected');
      console.log('Using imagePath:', imagePath);
      console.log('Using maskPath:', maskPath);
      if (inpaintArea) {
        console.log('Using inpaintArea:', inpaintArea);
      }
    }

    // Load the ComfyUI workflow
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    // Fix Windows path issue by removing leading slash
    const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
    const workflowPath = path.join(actualDirname, 'resource', workflowBasePath);
    let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // saveFilename: filename portion of savePath, no folder or extension
    if (savePath) {
      requestData.saveFilename = path.basename(savePath, path.extname(savePath));
    }
    // storagePath: absolute path to /storage folder
    requestData.storagePath = path.join(actualDirname, 'storage');

    // Store the workflow JSON in the task for node title lookups
    updateTask(taskId, { workflowData });
    
    // Calculate workflow steps if finalNode is specified
    let stepMap = null;
    let totalSteps = null;
    if (workflowConfig.finalNode) {
      const stepInfo = calculateWorkflowSteps(workflowData, workflowConfig.finalNode);
      stepMap = stepInfo.stepMap;
      totalSteps = stepInfo.totalSteps;
      console.log(`Calculated workflow steps: ${totalSteps} total steps`);
      
      // Store step map in the task for use in progress updates
      updateTask(taskId, { stepMap, totalSteps });
    }
    
    // Apply dynamic modifications based on the modifications array
    if (modifications && Array.isArray(modifications)) {
      modifications.forEach(mod => {
        const { from, to, prefix, postfix } = mod;
        console.log(`Modifying: ${from} to ${to.join(',')} ${prefix ? 'with prefix ' + prefix : ''} ${postfix ? 'and postfix ' + postfix : ''}`);        
        let value = generationData[from];
        if(prefix) value = `${prefix} ${value}`;
        if(postfix) value = `${value} ${postfix}`;
        console.log(` - New value: ${value}`);

        if(value && to && Array.isArray(to)) {
          workflowData = setObjectPathValue(workflowData, to, value);
        }
      });
    }

    // Write the modified workflow to workflow.json for debugging
    const debugWorkflowPath = path.join(actualDirname, 'storage', 'sent-workflow.json');
    fs.writeFileSync(debugWorkflowPath, JSON.stringify(workflowData, null, 2), 'utf8');
    console.log(`Workflow written to: ${debugWorkflowPath}`);

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
    setTaskPromptId(taskId, promptId);

    console.log(`Task ${taskId} linked to prompt ${promptId}, waiting for completion...`);
    
    // Wait for the prompt to complete
    const statusResult = await checkPromptStatus(promptId);
    
    if (statusResult.error) {
      throw new Error('ComfyUI generation failed');
    }

    // Handle extractOutputPathFromTextFile if specified
    if (extractOutputPathFromTextFile) {
      console.log(`Extracting output path from text file: ${extractOutputPathFromTextFile}`);
      
      // Compute absolute storage path
      const __dirname = path.dirname(new URL(import.meta.url).pathname);
      const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
      const storagePath = path.join(actualDirname, 'storage');
      
      try {
        // Read the output path from the text file
        let actualOutputPath = readOutputPathFromTextFile(extractOutputPathFromTextFile, storagePath);
        console.log(`Extracted output path: ${actualOutputPath}`);
        
        // Replace extension based on format parameter if provided
        if (workflowConfig.format) {
          // Extract extension from format (e.g., "image/webp" -> "webp")
          const formatExtension = workflowConfig.format;
          const extractedDir = path.dirname(actualOutputPath);
          const extractedBasename = path.basename(actualOutputPath, path.extname(actualOutputPath));
          actualOutputPath = path.join(extractedDir, `${extractedBasename}.${formatExtension}`);
          console.log(`Modified output path based on format: ${actualOutputPath}`);
        }
        
        // Copy the file from the extracted path to savePath
        if (fs.existsSync(actualOutputPath)) {
          fs.copyFileSync(actualOutputPath, savePath);
          console.log(`Successfully copied file from ${actualOutputPath} to ${savePath}`);
        } else {
          throw new Error(`Output file not found at extracted path: ${actualOutputPath}`);
        }
      } catch (error) {
        console.error(`Failed to extract and copy output file:`, error);
        throw new Error(`Failed to process output file: ${error.message}`);
      }
    }

    // Check if the file was created
    if (!fs.existsSync(savePath)) {
      throw new Error(`Generated image file not found at: ${savePath}`);
    }

    console.log(`Image generated successfully`);

    // Process post-generation prompts from config if workflow type is not video
    if (postGenerationPrompts && Array.isArray(postGenerationPrompts) && type !== 'video') {
      console.log(`Processing ${postGenerationPrompts.length} post-generation prompts...`);
      
      for (const promptConfig of postGenerationPrompts) {
        try {
          // Emit SSE progress update
          const stepName = promptConfig.to === 'description' ? 'Analyzing image' : `Generating ${promptConfig.to}`;
          emitProgressUpdate(promptId, { percentage: 0, value: 0, max: 1 }, stepName + '...');
          
          await modifyGenerationDataWithPrompt(promptConfig, generationData);
          
          // Emit SSE progress update for completion
          emitProgressUpdate(promptId, { percentage: 100, value: 1, max: 1 }, stepName + ' complete');
        } catch (error) {
          console.warn(`Failed to process prompt for ${promptConfig.to}:`, error.message);
          // Set a fallback value if the prompt fails
          if (!generationData[promptConfig.to]) {
            generationData[promptConfig.to] = promptConfig.to === 'description' 
              ? 'Image analysis unavailable' 
              : 'Generated Content';
          }
        }
      }
    } else if (type === 'video') {
      console.log('Skipping post-generation prompts for video workflow');
    }

    // Return the image URL path (relative to /image/ endpoint)
    const filename = path.basename(savePath);
    const imageUrl = `/image/${filename}`;

    // Calculate time taken in seconds
    const startTime = taskTimers.get(taskId);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    console.log(`Generation completed in ${timeTaken} seconds`);

    // Save image data to database using generationData fields
    let uid = null;
    if (addImageDataEntry) {
      const imageDataEntry = {
        prompt: generationData.prompt,
        seed: generationData.seed,
        imageUrl: imageUrl,
        name: generationData.name,
        description: generationData.description || '',
        workflow: workflow,
        inpaint: inpaint || false,
        inpaintArea: inpaintArea || null,
        timeTaken: timeTaken
      };
      addImageDataEntry(imageDataEntry);
      uid = imageDataEntry.uid; // Capture the UID after it's been added by addImageDataEntry
      console.log('Image data entry saved to database with UID:', uid);
    }

    // Emit completion event using generationData fields
    emitTaskCompletion(promptId, {
      imageUrl: imageUrl,
      description: generationData.description || '',
      prompt: generationData.prompt,
      seed: generationData.seed,
      name: generationData.name,
      workflow: workflow,
      inpaint: inpaint || false,
      inpaintArea: inpaintArea || null,
      uid: uid,
      timeTaken: timeTaken,
      maxValue: task.progress?.max || 1
    });

    // Clean up timer
    taskTimers.delete(taskId);

    console.log(`Task ${taskId} completed successfully`);

  } catch (error) {
    console.error(`Error in task ${taskId}:`, error);
    
    // Clean up timer
    taskTimers.delete(taskId);
    
    // Emit error using taskId directly
    emitTaskErrorByTaskId(taskId, 'Failed to process generation request', error.message);
  }
}
