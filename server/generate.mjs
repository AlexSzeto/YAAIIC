import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { sendImagePrompt, sendTextPrompt, modifyDataWithPrompt, resetPromptLog } from './llm.mjs';
import { createCrossFade } from './image-utils.mjs';
import { setObjectPathValue, readOutputPathFromTextFile, checkExecutionCondition } from './util.mjs';
import { CLIENT_ID, promptExecutionState, connectToComfyUI } from './comfyui-websocket.mjs';
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
  handleSSEConnection,
  resetProgressLog
} from './sse.mjs';

// Store ComfyUI API path locally
let comfyUIAPIPath = null;

// Track the last used workflow to manage VRAM
let lastUsedWorkflow = null;

// Function to add image data entry (will be set by server.mjs)
let addMediaDataEntry = null;

// Timer map to track start times for each task
const taskTimers = new Map(); // taskId -> startTime

// Initialize generate module with ComfyUI API path
export function initializeGenerateModule(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('Generate module initialized with ComfyUI API path:', apiPath);
}

export function setAddMediaDataEntry(func) {
  addMediaDataEntry = func;
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
export async function uploadFileToComfyUI(fileBuffer, filename, fileType = "image", storageType = "input", overwrite = false) {
  if (!comfyUIAPIPath) {
    throw new Error('Generate module not initialized - ComfyUI API path not available');
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Create FormData using the form-data package
      const formData = new FormData();
      
      // Determine content type and field name based on file type
      let contentType, fieldName, uploadEndpoint;
      if (fileType === 'audio') {
        // For audio files, determine content type from filename extension
        const ext = filename.split('.').pop().toLowerCase();
        contentType = ext === 'mp3' ? 'audio/mpeg' : 
                     ext === 'ogg' ? 'audio/ogg' :
                     ext === 'wav' ? 'audio/wav' :
                     ext === 'flac' ? 'audio/flac' : 'audio/mpeg';
        fieldName = 'audio';
        uploadEndpoint = '/upload/audio';
      } else {
        contentType = 'image/png';
        fieldName = 'image';
        uploadEndpoint = '/upload/image';
      }
      
      // Append the file buffer as a stream
      formData.append(fieldName, fileBuffer, {
        filename: filename,
        contentType: contentType
      });
      formData.append('type', storageType);
      formData.append('overwrite', overwrite.toString().toLowerCase());
      
      console.log(`Uploading ${fileType} to ComfyUI: ${filename} (type: ${storageType})`);
      
      // Parse the URL to determine if it's HTTP or HTTPS
      const url = new URL(`${comfyUIAPIPath}${uploadEndpoint}`);
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

// Function to free ComfyUI memory
async function freeComfyUIMemory() {
  if (!comfyUIAPIPath) return;

  try {
    console.log('Freeing ComfyUI memory...');
    const response = await fetch(`${comfyUIAPIPath}/free`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        unload_models: true,
        free_memory: true
      })
    });

    if (!response.ok) {
      console.warn(`Failed to free ComfyUI memory: ${response.status} ${response.statusText}`);
    } else {
      console.log('ComfyUI memory freed successfully');
    }
  } catch (error) {
    console.error('Error freeing ComfyUI memory:', error);
  }
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
export function calculateWorkflowSteps(workflow, finalNode, preGenTaskCount = 0, postGenTaskCount = 0) {
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
  
  // Calculate base workflow total steps (max distance + 1)
  let maxDistance = 0;
  for (const distance of distanceMap.values()) {
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }
  const baseWorkflowSteps = maxDistance + 1;
  
  // Calculate total steps including all pre-gen and post-gen tasks
  const totalSteps = preGenTaskCount + baseWorkflowSteps + postGenTaskCount;
  
  console.log(`Pre-gen tasks: ${preGenTaskCount}, Workflow steps: ${baseWorkflowSteps}, Post-gen tasks: ${postGenTaskCount}, Total: ${totalSteps}`);
  
  // Build step map with display text
  // Workflow steps start after pre-gen tasks
  const stepOffset = preGenTaskCount;
  const stepMap = new Map();
  for (const [nodeId, distance] of distanceMap.entries()) {
    const stepNumber = baseWorkflowSteps - distance + stepOffset;
    const stepDisplayText = `(${stepNumber}/${totalSteps})`;
    stepMap.set(nodeId, {
      distance,
      stepNumber,
      stepDisplayText
    });
  }
  
  return { stepMap, totalSteps, baseWorkflowSteps, preGenTaskCount, postGenTaskCount };
}

// Function to modify generationData with a prompt (wrapper for backwards compatibility)
export async function modifyGenerationDataWithPrompt(promptData, generationData) {
  return modifyDataWithPrompt(promptData, generationData);
}

// Handler for upload image processing
export async function handleMediaUpload(file, workflowsConfig) {
  // Generate unique task ID
  const taskId = generateTaskId();
  
  // Start timer for this task
  taskTimers.set(taskId, Date.now());
  
  // Create task entry
  createTask(taskId, {
    workflow: 'Uploaded Image',
    promptId: null,
    requestData: { filename: file.originalname },
    workflowConfig: { type: 'upload' }
  });
  
  console.log(`Created upload task ${taskId}`);
  
  // Process upload task asynchronously
  processUploadTask(taskId, file, workflowsConfig).catch(error => {
    console.error(`Error in upload task ${taskId}:`, error);
    emitTaskErrorByTaskId(taskId, 'Upload failed', error.message);
  });
  
  return taskId;
}

// Process upload task asynchronously
async function processUploadTask(taskId, file, workflowsConfig) {
  try {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
    
    // Detect file type
    const isAudio = file.mimetype.startsWith('audio/');
    const fileTypeLabel = isAudio ? 'Audio' : 'Media';
    
    // Emit progress: Uploading file
    emitProgressUpdate(taskId, { percentage: 10, value: 1, max: 4 }, `Uploading ${fileTypeLabel.toLowerCase()}...`);
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || (isAudio ? '.mp3' : '.png');
    const filename = `upload_${timestamp}${ext}`;
    
    // Save file to storage directory
    const storageFolder = path.join(actualDirname, 'storage');
    if (!fs.existsSync(storageFolder)) {
      fs.mkdirSync(storageFolder, { recursive: true });
    }
    
    const savePath = path.join(storageFolder, filename);
    fs.writeFileSync(savePath, file.buffer);
    console.log(`${fileTypeLabel} saved to: ${savePath}`);
    
    // Handle audio files differently
    if (isAudio) {
      // For audio files, generate album cover using defaultAudioGenerationWorkflow
      if (!workflowsConfig.defaultAudioGenerationWorkflow) {
        throw new Error('No default audio generation workflow configured');
      }
      
      // Extract name from filename (will be implemented in next task)
      const baseName = file.originalname.replace(ext, '');
      
      // TODO: Generate album cover using the defaultAudioGenerationWorkflow
      // For now, create a placeholder entry
      const generationData = {
        saveAudioPath: savePath,
        audioUrl: `/media/${filename}`,
        audioFormat: ext.substring(1), // Remove leading dot
        saveImagePath: '', // Will be populated after album cover generation
        imageUrl: '', // Will be populated after album cover generation
        prompt: '',
        seed: 0,
        workflow: 'Uploaded Audio',
        name: baseName,
        description: '(description unavailable for uploaded audio)',
        summary: '(summary unavailable for uploaded audio)',
        tags: '(tags unavailable for uploaded audio)',
        inpaint: false,
        inpaintArea: null,
        timeTaken: 0
      };
      
      // Emit progress: Saving to database
      emitProgressUpdate(taskId, { percentage: 90, value: 3, max: 4 }, 'Saving to database...');
      
      // Calculate time taken
      const startTime = taskTimers.get(taskId);
      const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      generationData.timeTaken = timeTaken;
      
      // Save to database
      if (addMediaDataEntry) {
        addMediaDataEntry(generationData);
        console.log('Audio data entry saved with UID:', generationData.uid);
      }
      
      // Emit completion
      emitTaskCompletion(taskId, {
        ...generationData,
        maxValue: 4
      });
      
      // Clean up timer
      taskTimers.delete(taskId);
      
      console.log(`Audio upload task ${taskId} completed successfully`);
      return;
    }
    
    // For image files, continue with existing logic
    
    // Create generationData object with the saved path
    const generationData = {
      saveImagePath: savePath,
      prompt: '',
      seed: 0,
      workflow: 'Uploaded Image',
      name: '',
      description: ''
    };
    
    // Process post-generation tasks to generate description and name
    if (workflowsConfig.defaultImageGenerationTasks && Array.isArray(workflowsConfig.defaultImageGenerationTasks)) {
      console.log('Processing post-generation tasks for uploaded image...');
      
      let promptIndex = 0;
      for (const promptConfig of workflowsConfig.defaultImageGenerationTasks) {
        try {
          promptIndex++;
          // Emit progress for each prompt
          const stepName = promptConfig.to === 'description' ? 'Generating description' : `Generating ${promptConfig.to}`;
          const progressValue = 1 + promptIndex;
          const progressPercent = Math.round((progressValue / 4) * 100);
          emitProgressUpdate(taskId, { percentage: progressPercent, value: progressValue, max: 4 }, stepName + '...');
          
          await modifyGenerationDataWithPrompt(promptConfig, generationData);
        } catch (error) {
          console.warn(`Failed to process prompt for ${promptConfig.to}:`, error.message);
          if (!generationData[promptConfig.to]) {
            generationData[promptConfig.to] = promptConfig.to === 'description' 
              ? 'No description available' 
              : file.originalname.replace(ext, '');
          }
        }
      }
    }
    
    // Emit progress: Saving to database
    emitProgressUpdate(taskId, { percentage: 90, value: 3, max: 4 }, 'Saving to database...');
    
    // Calculate time taken in seconds
    const startTime = taskTimers.get(taskId);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    
    // Add all fields to generationData before saving
    generationData.imageUrl = `/media/${filename}`;
    generationData.workflow = 'Uploaded Image';
    generationData.inpaint = false;
    generationData.inpaintArea = null;
    generationData.timeTaken = timeTaken;
    generationData.seed = 0;
    
    // Ensure defaults for optional fields
    if (!generationData.prompt) generationData.prompt = '';
    if (!generationData.name) generationData.name = file.originalname.replace(ext, '');
    if (!generationData.description) generationData.description = 'Uploaded image';
    if (!generationData.summary) generationData.summary = '';
    if (!generationData.tags) generationData.tags = '';
    
    // Save to database
    if (addMediaDataEntry) {
      addMediaDataEntry(generationData);
      console.log('Image data entry saved with UID:', generationData.uid);
    }
    
    // Emit completion event with entire generationData
    emitTaskCompletion(taskId, {
      ...generationData,
      maxValue: 4
    });
    
    // Clean up timer
    taskTimers.delete(taskId);
    
    console.log(`Upload task ${taskId} completed successfully`);
    
  } catch (error) {
    console.error(`Error in upload task ${taskId}:`, error);
    
    // Clean up timer
    taskTimers.delete(taskId);
    
    // Emit error
    emitTaskErrorByTaskId(taskId, 'Failed to process uploaded media', error.message);
  }
}

// Main image generation handler
export async function handleMediaGeneration(req, res, workflowConfig, serverConfig) {
  const { base: workflowBasePath } = workflowConfig;
  const { workflow } = req.body;
  const { ollamaAPIPath } = serverConfig;
  
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
  processGenerationTask(taskId, req.body, workflowConfig, serverConfig).catch(error => {
    console.error(`Error in background task ${taskId}:`, error);
    emitTaskErrorByTaskId(taskId, 'Generation failed', error.message);
  });
}

// Background processing function
async function processGenerationTask(taskId, requestData, workflowConfig, serverConfig) {
  try {
    const { base: workflowBasePath, replace: modifications, extractOutputPathFromTextFile, postGenerationTasks, preGenerationTasks, options } = workflowConfig;
    const { type } = options || {};
    const { seed, saveImagePath, workflow, imagePath, maskPath, inpaint, inpaintArea } = requestData;
    const { ollamaAPIPath } = serverConfig;
    
    // Create generationData as a copy of requestData
    const generationData = { ...requestData };
    
    // Add ollamaAPIPath to generation data
    if (ollamaAPIPath) {
      generationData.ollamaAPIPath = ollamaAPIPath;
    }
    
    // Extract savePath as local working variable for file operations
    const savePath = saveImagePath;
    
    // Ensure ComfyUI WebSocket connection is fresh/active
    console.log(`Refreshing ComfyUI WebSocket connection for task ${taskId}...`);
    connectToComfyUI(true);
    
    // Small delay to allow connection to simple stabilize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const task = getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found during processing`);
      return;
    }
    
    // Initialize sent-prompt.json logging
    resetPromptLog();
    resetProgressLog();
    
    console.log('Using seed:', seed);
    console.log('Using saveImagePath:', saveImagePath);
    
    // Log inpaint-specific parameters for debugging purposes
    if (inpaint) {
      console.log('Inpaint operation detected');
      console.log('Using imagePath:', imagePath);
      console.log('Using maskPath:', maskPath);
      if (inpaintArea) {
        console.log('Using inpaintArea:', inpaintArea);
      }
    }

    // Check if workflow has changed and free memory if needed
    // Use workflowBasePath as the identifier since it represents the file being used
    if (lastUsedWorkflow && lastUsedWorkflow !== workflowBasePath) {
      console.log(`Workflow changed from ${lastUsedWorkflow} to ${workflowBasePath}. Freeing memory...`);
      await freeComfyUIMemory();
    }
    
    // Update last used workflow
    lastUsedWorkflow = workflowBasePath;

    // Load the ComfyUI workflow
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    // Fix Windows path issue by removing leading slash
    const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
    const workflowPath = path.join(actualDirname, 'resource', workflowBasePath);
    let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // saveImageFilename: filename portion of saveImagePath, no folder or extension
    if (saveImagePath) {
      generationData.saveImageFilename = path.basename(saveImagePath, path.extname(saveImagePath));
    }
    // storagePath: absolute path to /storage folder
    generationData.storagePath = path.join(actualDirname, 'storage');

    // Store the workflow JSON in the task for node title lookups
    updateTask(taskId, { workflowData });

    // Initialize step tracking variables and calculate workflow steps
    let currentStep = 0;
    let totalSteps = 1;
    let stepMap = null;
    
    if (workflowConfig.finalNode) {
      const preGenTaskCount = preGenerationTasks && Array.isArray(preGenerationTasks) ? preGenerationTasks.length : 0;
      const postGenTaskCount = (postGenerationTasks && Array.isArray(postGenerationTasks) && type !== 'video') ? postGenerationTasks.length : 0;
      
      const stepInfo = calculateWorkflowSteps(workflowData, workflowConfig.finalNode, preGenTaskCount, postGenTaskCount);
      stepMap = stepInfo.stepMap;
      totalSteps = stepInfo.totalSteps;
      console.log(`Calculated workflow steps: ${totalSteps} total steps`);
      
      // Store step map and total steps in the task for use in progress updates
      updateTask(taskId, { stepMap, totalSteps, currentStep });
    }

    // Process pre-generation tasks if they exist
    if (preGenerationTasks && Array.isArray(preGenerationTasks) && preGenerationTasks.length > 0) {
      console.log(`Processing ${preGenerationTasks.length} pre-generation tasks...`);
      
      for (let i = 0; i < preGenerationTasks.length; i++) {
        const promptConfig = preGenerationTasks[i];
        
        // Check if task has a condition
        if (promptConfig.condition) {
          const dataSources = {
            generationData: generationData,
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, promptConfig.condition);
          if (!shouldExecute) {
            console.log(`Skipping pre-generation task for ${promptConfig.to} due to unmet condition`);
            // Increment step counter for skipped task
            currentStep++;
            continue;
          }
        }
        
        try {
          // Use global step counter for progress
          const percentage = Math.round((currentStep / totalSteps) * 100);
          const stepName = `Generating ${promptConfig.to}`;
          
          // Emit SSE progress update for start
          emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');
          
          await modifyGenerationDataWithPrompt(promptConfig, generationData);
          
          // Increment step counter after completion
          currentStep++;
          const completionPercentage = Math.round((currentStep / totalSteps) * 100);
          const completionStepName = `Generating ${promptConfig.to}`;
          
          // Emit SSE progress update for completion
          emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, completionStepName + ' complete');
        } catch (error) {
          console.warn(`Failed to process pre-generation task for ${promptConfig.to}:`, error.message);
          // Set a fallback value if the task fails and field is empty
          if (!generationData[promptConfig.to]) {
            generationData[promptConfig.to] = promptConfig.to === 'prompt' 
              ? 'Dynamic motion and camera movement' 
              : 'Generated Content';
          }
          // Increment step counter even if task failed
          currentStep++;
        }
      }
      
      // Update task with current step after pre-generation
      updateTask(taskId, { currentStep });
    }

    // Apply dynamic modifications based on the modifications array
    if (modifications && Array.isArray(modifications)) {
      modifications.forEach(mod => {
        // Check if modification has a condition
        if (mod.condition) {
          const dataSources = {
            generationData: generationData,
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, mod.condition);
          if (!shouldExecute) {
            console.log(`Skipping workflow modification due to unmet condition`);
            return;
          }
        }
        
        const { from, value: directValue, to, prefix, postfix } = mod;
        
        // Determine the source of the value
        let value;
        if (directValue !== undefined) {
          // Use direct value if provided
          value = directValue;
          console.log(`Modifying: direct value to ${to.join(',')} ${prefix ? 'with prefix ' + prefix : ''} ${postfix ? 'and postfix ' + postfix : ''}`);
        } else if (from) {
          // Use value from generationData
          value = generationData[from];
          console.log(`Modifying: ${from} to ${to.join(',')} ${prefix ? 'with prefix ' + prefix : ''} ${postfix ? 'and postfix ' + postfix : ''}`);
        }
        
        if(prefix) value = `${prefix} ${value}`;
        if(postfix) value = `${value} ${postfix}`;
        console.log(` - New value: ${value}`);

        if(value !== undefined && to && Array.isArray(to)) {
          workflowData = setObjectPathValue(workflowData, to, value);
        }
      });
    }

    // Write the modified workflow to workflow.json for debugging
    const logsDir = path.join(actualDirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const debugWorkflowPath = path.join(logsDir, 'sent-workflow.json');
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

    // Update currentStep after workflow execution completes
    // Calculate how many steps have been completed: pre-gen tasks + workflow steps
    const taskAfterWorkflow = getTask(taskId);
    if (taskAfterWorkflow && taskAfterWorkflow.stepMap && taskAfterWorkflow.totalSteps) {
      // Find the maximum step number from the workflow execution
      let maxWorkflowStep = 0;
      for (const stepInfo of taskAfterWorkflow.stepMap.values()) {
        if (stepInfo.stepNumber > maxWorkflowStep) {
          maxWorkflowStep = stepInfo.stepNumber;
        }
      }
      // Update currentStep to continue from where workflow left off
      currentStep = maxWorkflowStep;
      updateTask(taskId, { currentStep });
      console.log(`Workflow execution complete. Updated currentStep to ${currentStep}/${taskAfterWorkflow.totalSteps}`);
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
        if (workflowConfig.imageFormat) {
          // Extract extension from format (e.g., "image/webp" -> "webp")
          const formatExtension = workflowConfig.imageFormat;
          const extractedDir = path.dirname(actualOutputPath);
          const extractedBasename = path.basename(actualOutputPath, path.extname(actualOutputPath));
          actualOutputPath = path.join(extractedDir, `${extractedBasename}.${formatExtension}`);
          console.log(`Modified output path based on format: ${actualOutputPath}`);
        }
        
        // Copy the file from the extracted path to savePath
        if (fs.existsSync(actualOutputPath)) {
          fs.copyFileSync(actualOutputPath, savePath);
          console.log(`Successfully copied file from ${actualOutputPath} to ${savePath}`);
          
          // Apply loop fade blending if enabled in workflow options
          if (workflowConfig.blendLoopFrames) {
            console.log('Applying loop fade blending to animation...');
            await createCrossFade(savePath);
          }
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

    // Process post-generation tasks from config if workflow type is not video
    if (postGenerationTasks && Array.isArray(postGenerationTasks) && type !== 'video') {
      console.log(`Processing ${postGenerationTasks.length} post-generation tasks...`);
      
      // Retrieve current step from task
      const task = getTask(taskId);
      let currentStep = task?.currentStep || 0;
      const totalSteps = task?.totalSteps || 1;
      
      for (let i = 0; i < postGenerationTasks.length; i++) {
        const promptConfig = postGenerationTasks[i];
        
        // Check if task has a condition
        if (promptConfig.condition) {
          const dataSources = {
            generationData: generationData,
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, promptConfig.condition);
          if (!shouldExecute) {
            console.log(`Skipping post-generation task for ${promptConfig.to} due to unmet condition`);
            // Increment step counter for skipped task
            currentStep++;
            continue;
          }
        }
        
        try {
          // Use global step counter for progress
          const percentage = Math.round((currentStep / totalSteps) * 100);
          const stepName = promptConfig.to === 'description' 
            ? `Analyzing image` 
            : `Generating ${promptConfig.to}`;
          
          // Emit SSE progress update for start
          emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');
          
          await modifyGenerationDataWithPrompt(promptConfig, generationData);
          
          // Increment step counter after completion
          currentStep++;
          const completionPercentage = Math.round((currentStep / totalSteps) * 100);
          const completionStepName = promptConfig.to === 'description' 
            ? `Analyzing image` 
            : `Generating ${promptConfig.to}`;
          
          // Emit SSE progress update for completion
          emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, completionStepName + ' complete');
        } catch (error) {
          console.warn(`Failed to process prompt for ${promptConfig.to}:`, error.message);
          // Set a fallback value if the prompt fails
          if (!generationData[promptConfig.to]) {
            generationData[promptConfig.to] = promptConfig.to === 'description' 
              ? 'Image analysis unavailable' 
              : 'Generated Content';
          }
          // Increment step counter even if task failed
          currentStep++;
        }
      }
    } else if (type === 'video') {
      console.log('Skipping post-generation prompts for video workflow');
    }

    // Return the image URL path (relative to /media/ endpoint)
    const filename = path.basename(savePath);
    const imageUrl = `/media/${filename}`;

    // Calculate time taken in seconds
    const startTime = taskTimers.get(taskId);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    console.log(`Generation completed in ${timeTaken} seconds`);

    // Add all fields to generationData before saving
    generationData.imageUrl = imageUrl;
    generationData.workflow = workflow;
    generationData.inpaint = inpaint || false;
    generationData.inpaintArea = inpaintArea || null;
    generationData.timeTaken = timeTaken;
    
    // Ensure defaults for optional fields
    if (!generationData.description) generationData.description = '';
    if (!generationData.summary) generationData.summary = '';
    if (!generationData.tags) generationData.tags = '';

    // Save image data to database using entire generationData object
    if (addMediaDataEntry) {
      addMediaDataEntry(generationData);
      console.log('Image data entry saved to database with UID:', generationData.uid);
    }

    // Emit completion event using entire generationData object
    emitTaskCompletion(taskId, {
      ...generationData,
      maxValue: totalSteps
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
