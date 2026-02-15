import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { sendImagePrompt, sendTextPrompt, modifyDataWithPrompt, resetPromptLog } from './llm.mjs';
import { createCrossFade } from './image-utils.mjs';
import sharp from 'sharp';
import { setObjectPathValue, readOutputPathFromTextFile, checkExecutionCondition, findNextIndex } from './util.mjs';
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

// Store workflows data locally
let workflowsData = null;

// Track the last used workflow to manage VRAM
let lastUsedWorkflow = null;

// Function to add image data entry (will be set by server.mjs)
let addMediaDataEntry = null;

// Timer map to track start times for each task
const taskTimers = new Map(); // taskId -> startTime

// Important node types that take substantial time during workflow execution
const IMPORTANT_NODE_TYPES = [
  'KSampler',
  'KSamplerAdvanced',
  'VAEDecode',
  'VAEEncode',
  'CLIPTextEncode',
  'VAEEncodeForInpaint',
  'SamplerCustomAdvanced',
  'SaveAnimatedWEBP',
  'VHS_VideoCombine',
  'stable-audio-open-generate',
  'TextEncodeAceStepAudio1.5',
  'Qwen3VoiceDesign',
  'Qwen3VoiceClone',
  'UnifiedTTSTextNode',
  'HeartMuLa_Generate',
];

/**
 * Validates that a workflow does not contain nested executeWorkflow processes
 * @param {Object} workflowConfig - The workflow configuration to validate
 * @param {Array} allWorkflows - Array of all available workflows
 * @param {Set} visited - Set of visited workflow names (for recursion detection)
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateNoNestedExecuteWorkflow(workflowConfig, allWorkflows, visited = new Set()) {
  // Check if this workflow has postGenerationTasks
  const postGenTasks = workflowConfig.postGenerationTasks;
  if (!postGenTasks || !Array.isArray(postGenTasks)) {
    return { valid: true, error: null };
  }

  // Find all executeWorkflow processes
  const executeWorkflowTasks = postGenTasks.filter(task => task.process === 'executeWorkflow');
  
  if (executeWorkflowTasks.length === 0) {
    return { valid: true, error: null };
  }

  // For each executeWorkflow task, validate the target workflow
  for (const task of executeWorkflowTasks) {
    const targetWorkflowName = task.parameters?.workflow;
    
    if (!targetWorkflowName) {
      return { 
        valid: false, 
        error: `executeWorkflow process missing 'workflow' parameter in workflow "${workflowConfig.name}"` 
      };
    }

    // Find the target workflow
    const targetWorkflow = allWorkflows.find(w => w.name === targetWorkflowName);
    
    if (!targetWorkflow) {
      return { 
        valid: false, 
        error: `Target workflow "${targetWorkflowName}" not found for executeWorkflow in workflow "${workflowConfig.name}"` 
      };
    }

    // Check for circular reference
    if (visited.has(targetWorkflowName)) {
      return { 
        valid: false, 
        error: `Circular workflow reference detected: "${targetWorkflowName}" in workflow "${workflowConfig.name}"` 
      };
    }

    // Check if target workflow has any executeWorkflow processes (nesting not allowed)
    const targetPostGenTasks = targetWorkflow.postGenerationTasks;
    if (targetPostGenTasks && Array.isArray(targetPostGenTasks)) {
      const hasNestedExecuteWorkflow = targetPostGenTasks.some(t => t.process === 'executeWorkflow');
      
      if (hasNestedExecuteWorkflow) {
        return { 
          valid: false, 
          error: `Nested executeWorkflow detected: workflow "${targetWorkflowName}" contains executeWorkflow process. Only one level of nesting is allowed.` 
        };
      }
    }

    // Recursively validate the target workflow (for other validation, not executeWorkflow)
    const newVisited = new Set(visited);
    newVisited.add(workflowConfig.name);
    const targetValidation = validateNoNestedExecuteWorkflow(targetWorkflow, allWorkflows, newVisited);
    
    if (!targetValidation.valid) {
      return targetValidation;
    }
  }

  return { valid: true, error: null };
}

// Process handler registry - maps process names to handler functions
const PROCESS_HANDLERS = {
  extractOutputMediaFromTextFile: async (parameters, generationData, context) => {
    const { filename } = parameters;
    if (!filename) {
      throw new Error('extractOutputMediaFromTextFile requires "filename" parameter');
    }
    
    console.log(`[Process] Extracting output path from text file: ${filename}`);
    
    const { storagePath, savePath } = context;
    
    // Read the output path from the text file
    let actualOutputPath = readOutputPathFromTextFile(filename, storagePath);
    console.log(`[Process] Extracted output path: ${actualOutputPath}`);
    
    // Replace extension based on format parameter if provided
    if (generationData.imageFormat) {
      // Extract extension from format (e.g., "webp" or "image/webp" -> "webp")
      const formatExtension = generationData.imageFormat;
      const extractedDir = path.dirname(actualOutputPath);
      const extractedBasename = path.basename(actualOutputPath, path.extname(actualOutputPath));
      actualOutputPath = path.join(extractedDir, `${extractedBasename}.${formatExtension}`);
      console.log(`[Process] Modified output path based on format: ${actualOutputPath}`);
    } else {
      throw new Error('imageFormat is required to determine output file extension');
    }
    
    // Copy the file from the extracted path to savePath
    if (fs.existsSync(actualOutputPath)) {
      fs.copyFileSync(actualOutputPath, savePath);
      console.log(`[Process] Successfully copied file from ${actualOutputPath} to ${savePath}`);
    } else {
      throw new Error(`Output file not found at extracted path: ${actualOutputPath}`);
    }
  },
  
  crossfadeVideoFrames: async (parameters, generationData, context) => {
    const { blendFrames = 10 } = parameters;
    
    console.log(`[Process] Applying loop fade blending with ${blendFrames} frames...`);
    
    const { savePath } = context;
    
    if (!fs.existsSync(savePath)) {
      throw new Error(`Cannot apply crossfade: file not found at ${savePath}`);
    }
    
    await createCrossFade(savePath, blendFrames);
    console.log(`[Process] Successfully applied crossfade blending`);
  },
  
  extractOutputTexts: async (parameters, generationData, context) => {
    const { properties } = parameters;
    if (!properties || !Array.isArray(properties)) {
      throw new Error('extractOutputTexts requires "properties" parameter as array');
    }
    
    console.log(`[Process] Extracting text content from ${properties.length} file(s)...`);
    
    const { storagePath } = context;
    
    for (const propertyName of properties) {
      try {
        // Construct the text filename (e.g., "summary" -> "summary.txt")
        const textFilename = `${propertyName}.txt`;
        console.log(`[Process] Extracting text from ${textFilename} to property "${propertyName}"`);
        
        // Read the text file content
        const textContent = readOutputPathFromTextFile(textFilename, storagePath);
        
        // Assign the content to generationData
        generationData[propertyName] = textContent;
        console.log(`[Process] Successfully extracted text content: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}`);
      } catch (error) {
        console.error(`[Process] Failed to extract text from ${propertyName}.txt:`, error.message);
        throw error; // Fail immediately on error as per spec
      }
    }
  },
  
  executeWorkflow: async (parameters, generationData, context) => {
    const { workflow: targetWorkflowName, inputMapping = [], outputMapping = [] } = parameters;
    
    if (!targetWorkflowName) {
      throw new Error('executeWorkflow requires "workflow" parameter');
    }
    
    console.log(`[Process] Executing nested workflow: ${targetWorkflowName}`);
    
    const { workflowsData, serverConfig } = context;
    
    if (!workflowsData || !workflowsData.workflows) {
      throw new Error('Workflows data not available in context');
    }
    
    // Find the target workflow
    const targetWorkflow = workflowsData.workflows.find(w => w.name === targetWorkflowName);
    if (!targetWorkflow) {
      throw new Error(`Target workflow "${targetWorkflowName}" not found`);
    }
    
    // Create nested request data starting with basic fields
    const nestedRequestData = {
      workflow: targetWorkflowName,
      seed: Math.floor(Math.random() * 4294967295) // Generate new seed for nested workflow
    };
    
    console.log(`[Process] Applying input mapping with ${inputMapping.length} rules...`);
    
    // Apply input mapping
    for (const mapping of inputMapping) {
      // Text field mapping
      if (mapping.from && mapping.to) {
        const value = generationData[mapping.from];
        if (value !== undefined) {
          nestedRequestData[mapping.to] = value;
          console.log(`[Process] Mapped text field: ${mapping.from} -> ${mapping.to}`);
        }
      }
      // Image mapping
      else if (mapping.image && mapping.toMediaInput !== undefined) {
        const mediaIndex = mapping.toMediaInput;
        const imageKey = mapping.image === 'generated' ? 'saveImagePath' : mapping.image;
        
        // Get the image path from generationData
        const imagePath = generationData[imageKey];
        if (imagePath) {
          try {
            // Read the image file from disk
            console.log(`[Process] Reading image file: ${imagePath}`);
            const imageBuffer = fs.readFileSync(imagePath);
            
            // Extract filename from path
            const filename = path.basename(imagePath);
            
            // Upload to ComfyUI
            console.log(`[Process] Uploading image to ComfyUI: ${filename}`);
            const uploadResult = await uploadFileToComfyUI(imageBuffer, filename, "image", "input", true);
            
            // Store the ComfyUI filename in nestedRequestData
            nestedRequestData[`image_${mediaIndex}_filename`] = uploadResult.filename;
            console.log(`[Process] Mapped image: ${imageKey} -> image_${mediaIndex} (ComfyUI: ${uploadResult.filename})`);
            
            // Map associated metadata fields
            const metadataFields = ['description', 'summary', 'tags', 'name', 'uid', 'imageFormat'];
            for (const field of metadataFields) {
              const sourceField = imageKey === 'saveImagePath' ? field : `${imageKey}_${field}`;
              const targetField = `image_${mediaIndex}_${field}`;
              const value = generationData[sourceField];
              
              if (value !== undefined) {
                nestedRequestData[targetField] = value;
                console.log(`[Process] Mapped metadata: ${sourceField} -> ${targetField}`);
              }
            }
          } catch (uploadError) {
            console.error(`[Process] Failed to upload image to ComfyUI:`, uploadError);
            throw new Error(`Failed to upload image for nested workflow: ${uploadError.message}`);
          }
        }
      }
      // Audio mapping
      else if (mapping.audio && mapping.toMediaInput !== undefined) {
        const mediaIndex = mapping.toMediaInput;
        const audioKey = mapping.audio === 'generated' ? 'saveAudioPath' : mapping.audio;
        
        // Get the audio path from generationData
        const audioPath = generationData[audioKey];
        if (audioPath) {
          try {
            // Read the audio file from disk
            console.log(`[Process] Reading audio file: ${audioPath}`);
            const audioBuffer = fs.readFileSync(audioPath);
            
            // Extract filename from path
            const filename = path.basename(audioPath);
            
            // Upload to ComfyUI
            console.log(`[Process] Uploading audio to ComfyUI: ${filename}`);
            const uploadResult = await uploadFileToComfyUI(audioBuffer, filename, "audio", "input", true);
            
            // Store the ComfyUI filename in nestedRequestData
            nestedRequestData[`audio_${mediaIndex}`] = uploadResult.filename;
            console.log(`[Process] Mapped audio: ${audioKey} -> audio_${mediaIndex} (ComfyUI: ${uploadResult.filename})`);
            
            // Map associated metadata fields
            const metadataFields = ['description', 'summary', 'tags', 'name', 'uid'];
            for (const field of metadataFields) {
              const sourceField = audioKey === 'saveAudioPath' ? field : `${audioKey}_${field}`;
              const targetField = `audio_${mediaIndex}_${field}`;
              const value = generationData[sourceField];
              
              if (value !== undefined) {
                nestedRequestData[targetField] = value;
                console.log(`[Process] Mapped metadata: ${sourceField} -> ${targetField}`);
              }
            }
          } catch (uploadError) {
            console.error(`[Process] Failed to upload audio to ComfyUI:`, uploadError);
            throw new Error(`Failed to upload audio for nested workflow: ${uploadError.message}`);
          }
        }
      }
    }
    
    // Fill in required fields with blanks if not provided
    const requiredFields = ['tags', 'prompt', 'description', 'summary', 'name'];
    for (const field of requiredFields) {
      if (nestedRequestData[field] === undefined || nestedRequestData[field] === null) {
        nestedRequestData[field] = '';
      }
    }
    
    console.log(`[Process] Executing nested workflow with request data:`, nestedRequestData);
    
    // Create a temporary task ID for the nested workflow (not saved to database)
    const nestedTaskId = generateTaskId();
    
    // Create task entry (will not be visible as it won't be saved to database)
    createTask(nestedTaskId, {
      workflow: targetWorkflowName,
      promptId: null,
      requestData: nestedRequestData,
      workflowConfig: targetWorkflow
    });
    
    try {
      // Execute the nested workflow in silent mode (skip database entry)
      await processGenerationTask(nestedTaskId, nestedRequestData, targetWorkflow, serverConfig, true);
      
      // Get the nested task to extract result data
      const nestedTask = getTask(nestedTaskId);
      if (!nestedTask || !nestedTask.result) {
        throw new Error('Nested workflow did not produce a result');
      }
      
      const nestedResult = nestedTask.result;
      console.log(`[Process] Nested workflow completed successfully`);
      
      // Apply output mapping for text fields
      console.log(`[Process] Applying output mapping with ${outputMapping.length} rules...`);
      for (const mapping of outputMapping) {
        if (mapping.from && mapping.to) {
          const value = nestedResult[mapping.from];
          if (value !== undefined) {
            generationData[mapping.to] = value;
            console.log(`[Process] Mapped output field: ${mapping.from} -> ${mapping.to}`);
          }
        }
      }
      
      // Automatically update media URLs from nested workflow
      if (nestedResult.imageUrl) {
        generationData.imageUrl = nestedResult.imageUrl;
        generationData.saveImagePath = nestedResult.saveImagePath;
        console.log(`[Process] Updated imageUrl from nested workflow: ${nestedResult.imageUrl}`);
      }
      
      if (nestedResult.audioUrl) {
        generationData.audioUrl = nestedResult.audioUrl;
        generationData.saveAudioPath = nestedResult.saveAudioPath;
        console.log(`[Process] Updated audioUrl from nested workflow: ${nestedResult.audioUrl}`);
      }
      
      console.log(`[Process] Nested workflow execution completed successfully`);
    } catch (error) {
      console.error(`[Process] Nested workflow failed:`, error.message);
      throw new Error(`Nested workflow "${targetWorkflowName}" failed: ${error.message}`);
    }
  }
};

// Initialize generate module with ComfyUI API path
export function initializeGenerateModule(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('Generate module initialized with ComfyUI API path:', apiPath);
}

export function setAddMediaDataEntry(func) {
  addMediaDataEntry = func;
}

export function setWorkflowsData(workflows) {
  workflowsData = workflows;
  console.log('Workflows data set in generate module');
}

// Re-export SSE functions for backwards compatibility
export {
  emitProgressUpdate,
  emitTaskCompletion,
  emitTaskError,
  emitTaskErrorByTaskId,
  handleSSEConnection
};

// Export validation function for workflow nesting
export { validateNoNestedExecuteWorkflow };

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
        fieldName = 'image'; // ComfyUI uses 'image' field for all file uploads
        uploadEndpoint = '/upload/image'; // ComfyUI uses /upload/image for all file types
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
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`Successfully uploaded ${filename} to ComfyUI:`, responseData);
              resolve({
                success: true,
                filename: filename,
                type: fileType,
                response: responseData
              });
            } else {
              reject(new Error(`ComfyUI upload failed: ${res.statusCode} ${res.statusMessage} - ${responseData}`));
            }
          } catch (endError) {
            console.error(`Error processing upload response for ${filename}:`, endError);
            reject(new Error(`Failed to process upload response for ${filename}: ${endError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Upload request error for ${filename}:`, error);
        reject(new Error(`Request failed for ${filename}: ${error.message}`));
      });
      
      // Pipe the form data to the request
      try {
        formData.pipe(req);
      } catch (pipeError) {
        console.error(`Error piping form data for ${filename}:`, pipeError);
        reject(new Error(`Failed to send upload data for ${filename}: ${pipeError.message}`));
      }
      
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

/**
 * Calculate the total number of steps for progress tracking
 * @param {Array} preGenTasks - Pre-generation tasks
 * @param {Object} workflowNodes - Workflow nodes from ComfyUI (workflow object)
 * @param {Array} postGenTasks - Post-generation tasks
 * @returns {Object} Object containing totalSteps, preGenCount, importantNodeCount, and postGenCount
 */
function calculateTotalSteps(preGenTasks, workflowNodes, postGenTasks) {
  // Count pre-gen tasks with prompt or process parameter
  let preGenCount = 0;
  if (preGenTasks && Array.isArray(preGenTasks)) {
    preGenCount = preGenTasks.filter(task => 
      (task.prompt !== undefined && task.prompt !== null) || 
      (task.process !== undefined && task.process !== null)
    ).length;
  }
  
  // Count workflow nodes that match IMPORTANT_NODE_TYPES (linear counting, no execution order)
  let importantNodeCount = 0;
  if (workflowNodes && typeof workflowNodes === 'object') {
    for (const nodeId in workflowNodes) {
      const node = workflowNodes[nodeId];
      if (node && node.class_type && IMPORTANT_NODE_TYPES.includes(node.class_type)) {
        importantNodeCount++;
      }
    }
  }
  
  // Count post-gen tasks with prompt or process parameter
  let postGenCount = 0;
  if (postGenTasks && Array.isArray(postGenTasks)) {
    postGenCount = postGenTasks.filter(task => 
      (task.prompt !== undefined && task.prompt !== null) || 
      (task.process !== undefined && task.process !== null)
    ).length;
  }
  
  // Calculate total
  const totalSteps = preGenCount + importantNodeCount + postGenCount;
  
  console.log(`Step calculation: Pre-gen=${preGenCount}, Important nodes=${importantNodeCount}, Post-gen=${postGenCount}, Total=${totalSteps}`);
  
  return { totalSteps, preGenCount, importantNodeCount, postGenCount };
}

// Function to modify generationData with a prompt (wrapper for backwards compatibility)
export async function modifyGenerationDataWithPrompt(promptData, generationData) {
  return modifyDataWithPrompt(promptData, generationData);
}

// Helper function to generate album cover for audio uploads
// TODO: Refactor duplicate code with main generation function into helper functions
async function generateAlbumCover(taskId, requestData, workflowConfig, workflowsConfig) {
  const { base: workflowBasePath, replace: modifications, postGenerationTasks, options } = workflowConfig;
  const { seed, saveImagePath, prompt } = requestData;
  
  console.log(`Generating album cover with workflow: ${workflowBasePath}`);
  
  // Create generationData for the album cover
  const generationData = { ...requestData };
  
  // Initialize progress for album cover generation
  // (We won't emit progress updates here to avoid conflicting with main task progress)
  
  // Load the ComfyUI workflow
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
  const workflowPath = path.join(actualDirname, 'resource', workflowBasePath);
  let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  
  // Set up generationData fields
  if (saveImagePath) {
    generationData.saveImageFilename = path.basename(saveImagePath, path.extname(saveImagePath));
  }
  generationData.storagePath = path.join(actualDirname, 'storage');
  
  // Apply modifications to the workflow
  if (modifications && Array.isArray(modifications)) {
    modifications.forEach(({ from, to, prefix, postfix }) => {
      let value = generationData[from];
      
      if (prefix) value = `${prefix} ${value}`;
      if (postfix) value = `${value} ${postfix}`;
      
      if (value !== undefined && to && Array.isArray(to)) {
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
  const promptId = comfyResult.prompt_id;
  
  if (!promptId) {
    throw new Error('No prompt_id received from ComfyUI');
  }
  
  console.log(`Album cover generation prompt ${promptId} submitted, waiting for completion...`);
  
  // Wait for the prompt to complete
  const statusResult = await checkPromptStatus(promptId);
  
  if (statusResult.error) {
    throw new Error('Album cover generation failed');
  }
  
  // Get the generated image URL
  const ext = path.extname(saveImagePath);
  const filename = path.basename(saveImagePath);
  generationData.imageUrl = `/media/${filename}`;
  
  // Run post-generation tasks if configured
  if (postGenerationTasks && Array.isArray(postGenerationTasks)) {
    for (const promptConfig of postGenerationTasks) {
      try {
        await modifyGenerationDataWithPrompt(promptConfig, generationData);
      } catch (error) {
        console.warn(`Failed to process album cover post-gen task for ${promptConfig.to}:`, error.message);
      }
    }
  }
  
  return generationData;
}

// Handler for upload image processing
export async function handleMediaUpload(file, workflowsConfig, extractedName = null) {
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
  processUploadTask(taskId, file, workflowsConfig, extractedName).catch(error => {
    console.error(`Error in upload task ${taskId}:`, error);
    emitTaskErrorByTaskId(taskId, 'Upload failed', error.message);
  });
  
  return taskId;
}

// Process upload task asynchronously
async function processUploadTask(taskId, file, workflowsConfig, extractedName = null) {
  try {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
    
    // Detect file type
    const isAudio = file.mimetype.startsWith('audio/');
    const fileTypeLabel = isAudio ? 'Audio' : 'Media';
    
    // Emit progress: Uploading file
    emitProgressUpdate(taskId, { percentage: 10, value: 1, max: 4 }, `Uploading ${fileTypeLabel.toLowerCase()}...`);
    
    // Determine file type and extension
    const ext = path.extname(file.originalname) || (isAudio ? '.mp3' : '.png');
    const fileType = isAudio ? 'audio' : 'image';
    
    // Save file to storage directory
    const storageFolder = path.join(actualDirname, 'storage');
    if (!fs.existsSync(storageFolder)) {
      fs.mkdirSync(storageFolder, { recursive: true });
    }
    
    // Generate filename using type_index format
    const nextIndex = findNextIndex(fileType, storageFolder);
    const filename = `${fileType}_${nextIndex}${ext}`;
    
    const savePath = path.join(storageFolder, filename);
    fs.writeFileSync(savePath, file.buffer);
    console.log(`${fileTypeLabel} saved to: ${savePath}`);
    
    // Handle audio files differently
    if (isAudio) {
      // For audio files, generate album cover using defaultAudioGenerationWorkflow
      if (!workflowsConfig.defaultAudioGenerationWorkflow) {
        throw new Error('No default audio generation workflow configured');
      }
      
      // Use extracted name if provided, otherwise use filename
      const baseName = extractedName || file.originalname.replace(ext, '');
      
      // Generate album cover using the defaultAudioGenerationWorkflow
      emitProgressUpdate(taskId, { percentage: 40, value: 2, max: 4 }, 'Generating album cover...');
      
      const albumWorkflowName = workflowsConfig.defaultAudioGenerationWorkflow;
      const albumWorkflow = workflowsConfig.workflows.find(w => w.name === albumWorkflowName);
      
      if (!albumWorkflow) {
        throw new Error(`Album cover workflow '${albumWorkflowName}' not found`);
      }
      
      // Prepare request data for album cover generation
        // TODO: Create global const to remove magic number 4294967295      
      const albumRequestData = {
        workflow: albumWorkflowName,
        name: baseName,
        seed: Math.floor(Math.random() * 4294967295),
        saveImagePath: path.join(actualDirname, 'storage', `album_${timestamp}.png`),
        saveImageFilename: `album_${timestamp}`
      };
      
      // Generate the album cover
      try {
        const albumResult = await generateAlbumCover(taskId, albumRequestData, albumWorkflow, workflowsConfig);
        
        // TODO: Start with a copy albumResult and add audio info fields

        // Create generationData with both audio and image info
        const generationData = {
          saveAudioPath: savePath,
          audioUrl: `/media/${filename}`,
          audioFormat: ext.substring(1), // Remove leading dot
          saveImagePath: albumResult.saveImagePath,
          imageUrl: albumResult.imageUrl,
          prompt: albumRequestData.prompt,
          seed: albumRequestData.seed,
          workflow: 'Uploaded Audio',
          name: baseName,
          description: albumResult.description || '(description unavailable for uploaded audio)',
          summary: albumResult.summary || '(summary unavailable for uploaded audio)',
          tags: albumResult.tags || '(tags unavailable for uploaded audio)',
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
      } catch (albumError) {
        console.error('Failed to generate album cover:', albumError);
        throw new Error(`Album cover generation failed: ${albumError.message}`);
      }
      
      return;
    }
    
    // For image files, continue with existing logic
    
    // Detect image dimensions and orientation
    let orientation = 'portrait'; // default
    try {
      const metadata = await sharp(file.buffer).metadata();
      if (metadata.width && metadata.height) {
        orientation = metadata.width > metadata.height ? 'landscape' : 'portrait';
        console.log(`Image dimensions: ${metadata.width}x${metadata.height}, orientation: ${orientation}`);
      }
    } catch (dimensionError) {
      console.warn('Failed to detect image dimensions:', dimensionError.message);
    }
    
    // Create generationData object with the saved path
    const generationData = {
      saveImagePath: savePath,
      prompt: '',
      seed: 0,
      workflow: 'Uploaded Image',
      name: extractedName || '',
      description: '',
      orientation: orientation
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
async function processGenerationTask(taskId, requestData, workflowConfig, serverConfig, silent = false) {
  try {
    const { base: workflowBasePath, replace: modifications, postGenerationTasks, preGenerationTasks, options } = workflowConfig;
    const { type } = options || {};
    const { seed, workflow, imagePath, maskPath, inpaint, inpaintArea } = requestData;
    const { ollamaAPIPath } = serverConfig;
    
    // Create generationData as a copy of requestData
    const generationData = { ...requestData };
    
    // Add ollamaAPIPath to generation data
    if (ollamaAPIPath) {
      generationData.ollamaAPIPath = ollamaAPIPath;
    }
    
    // Add workflow type to generation data
    // For inpaint workflows, the output type should be "image" not "inpaint"
    if (type) {
      generationData.type = (type === 'inpaint') ? 'image' : type;
    }
    
    // savePath will be set after preGenerationTasks when saveImagePath is created
    
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
    // saveImagePath will be logged after it's created
    
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

    // storagePath: absolute path to /storage folder (needed before file creation)
    generationData.storagePath = path.join(actualDirname, 'storage');

    // Store the workflow JSON in the task for node title lookups
    updateTask(taskId, { workflowData });

    // Initialize step tracking variables and calculate workflow steps using new method
    let currentStep = 0;
    let totalSteps = 1;
    let stepMap = null;
    let preGenCount = 0;
    let importantNodeCount = 0;
    let postGenCount = 0;
    
    // Calculate total steps using the new dynamic calculation
    const postGenTasksForCounting = (postGenerationTasks && type !== 'video') ? postGenerationTasks : [];
    const stepCalc = calculateTotalSteps(preGenerationTasks, workflowData, postGenTasksForCounting);
    totalSteps = stepCalc.totalSteps;
    preGenCount = stepCalc.preGenCount;
    importantNodeCount = stepCalc.importantNodeCount;
    postGenCount = stepCalc.postGenCount;
    
    // Build a map of important nodes for quick lookup during execution
    const importantNodes = new Set();
    if (workflowData && typeof workflowData === 'object') {
      for (const nodeId in workflowData) {
        const node = workflowData[nodeId];
        if (node && node.class_type && IMPORTANT_NODE_TYPES.includes(node.class_type)) {
          importantNodes.add(nodeId);
        }
      }
    }
    
    // Store important nodes set and total steps in the task for use in progress updates
    updateTask(taskId, { importantNodes, totalSteps, currentStep, preGenCount, importantNodeCount, postGenCount });

    // Process pre-generation tasks if they exist
    if (preGenerationTasks && Array.isArray(preGenerationTasks) && preGenerationTasks.length > 0) {
      console.log(`Processing ${preGenerationTasks.length} pre-generation tasks...`);
      
      // Compute context for process handlers (will be needed later)
      const __dirname = path.dirname(new URL(import.meta.url).pathname);
      const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
      const storagePath = path.join(actualDirname, 'storage');
      
      for (let i = 0; i < preGenerationTasks.length; i++) {
        const taskConfig = preGenerationTasks[i];
        
        // Determine task type: prompt task or process task
        const hasPrompt = taskConfig.prompt !== undefined && taskConfig.prompt !== null;
        const hasProcess = taskConfig.process !== undefined && taskConfig.process !== null;
        const shouldCount = hasPrompt || hasProcess;
        
        // Check if task has a condition
        if (taskConfig.condition) {
          const dataSources = {
            data: generationData,           // Primary: new 'data' key for conditions
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, taskConfig.condition);
          if (!shouldExecute) {
            console.log(`Skipping pre-generation task due to unmet condition`);
            // Increment step counter only if this task should be counted
            if (shouldCount) {
              currentStep++;
            }
            continue;
          }
        }
        
        try {
          // Process task handling
          if (hasProcess) {
            // Show progress for process task
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || `Processing ${taskConfig.process}`;
            
            // Emit SSE progress update for start
            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');
            
            // Get the process handler
            const handler = PROCESS_HANDLERS[taskConfig.process];
            if (!handler) {
              throw new Error(`Unknown process handler: ${taskConfig.process}`);
            }
            
            // Build context for process handler
            const savePath = generationData.saveImagePath || '';
            const context = { storagePath, savePath, workflowsData, serverConfig };
            
            // Execute the process handler
            await handler(taskConfig.parameters || {}, generationData, context);
            
            // Increment step counter
            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            
            // Emit SSE progress update for completion
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          }
          // Prompt task handling
          else if (hasPrompt) {
            // Show progress for prompt task
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || `Generating ${taskConfig.to}`;
            
            // Emit SSE progress update for start
            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');
            
            await modifyGenerationDataWithPrompt(taskConfig, generationData);
            
            // Increment step counter
            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            
            // Emit SSE progress update for completion
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          }
          // Data copy task (from/to) or template task - no progress tracking
          else {
            await modifyGenerationDataWithPrompt(taskConfig, generationData);
          }
        } catch (error) {
          console.error(`Pre-generation task failed:`, error.message);
          // For pre-generation tasks, fail immediately and stop generation
          throw new Error(`Pre-generation failed: ${error.message}`);
        }
      }
      
      // Update task with current step after pre-generation
      updateTask(taskId, { currentStep });
    }

    // Create output filenames after preGenerationTasks (so format from extra inputs is available)
    const __dirname2 = path.dirname(new URL(import.meta.url).pathname);
    const actualDirname2 = process.platform === 'win32' && __dirname2.startsWith('/') ? __dirname2.slice(1) : __dirname2;
    const storageFolder = path.join(actualDirname2, 'storage');
    if (!fs.existsSync(storageFolder)) {
      fs.mkdirSync(storageFolder, { recursive: true });
    }
    
    // Determine if this is an audio, video, or image workflow
    const isAudio = type === 'audio';
    const isVideo = type === 'video';
    
    // Get format from generationData (set by preGenerationTasks or extra inputs)
    const imageFormat = generationData.imageFormat;
    const audioFormat = generationData.audioFormat;
    
    // Validate required formats
    if (!imageFormat) {
      throw new Error('imageFormat is required but not found in generation data. Check workflow configuration and extra inputs.');
    }
    
    if (isAudio && !audioFormat) {
      throw new Error('audioFormat is required for audio workflows but not found in generation data. Check workflow configuration and extra inputs.');
    }
    
    // Create saveImagePath if not already set
    if (!generationData.saveImagePath) {
      const nextIndex = findNextIndex('image', storageFolder);
      const imageFilename = `image_${nextIndex}.${imageFormat}`;
      generationData.saveImagePath = path.join(storageFolder, imageFilename);
      console.log('Created saveImagePath:', generationData.saveImagePath);
    }
    
    // Create saveImageFilename from saveImagePath
    generationData.saveImageFilename = path.basename(generationData.saveImagePath, path.extname(generationData.saveImagePath));
    console.log('Using saveImagePath:', generationData.saveImagePath);
    
    // For audio workflows, also create saveAudioPath
    if (isAudio) {
      const nextAudioIndex = findNextIndex('audio', storageFolder);
      const audioFilename = `audio_${nextAudioIndex}.${audioFormat}`;
      generationData.saveAudioPath = path.join(storageFolder, audioFilename);
      generationData.audioUrl = `/media/${audioFilename}`;
      console.log('Created saveAudioPath:', generationData.saveAudioPath);
      console.log('Created audioUrl:', generationData.audioUrl);
    }
    
    // Update savePath variable for compatibility
    const savePath = generationData.saveImagePath;

    // Set initial imageUrl from savePath (can be overridden by post-generation tasks)
    const filename = path.basename(savePath);
    generationData.imageUrl = `/media/${filename}`;

    // Apply dynamic modifications based on the modifications array
    if (modifications && Array.isArray(modifications)) {
      modifications.forEach(mod => {
        // Check if modification has a condition
        if (mod.condition) {
          const dataSources = {
            data: generationData,           // Primary: new 'data' key for conditions
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, mod.condition);
          if (!shouldExecute) {
            console.log(`Skipping workflow modification due to unmet condition`);
            return;
          }
        }
        
        const { from, value: directValue, to } = mod;
        
        // Determine the source of the value
        let value;
        if (directValue !== undefined) {
          // Use direct value if provided
          value = directValue;
          console.log(`Modifying: direct value to ${to.join(',')}`);
        } else if (from) {
          // Use value from generationData
          value = generationData[from];
          console.log(`Modifying: ${from} to ${to.join(',')}`);
        }
        
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
    // Advance counter to preGenCount + importantNodeCount to account for any skipped nodes
    const taskAfterWorkflow = getTask(taskId);
    if (taskAfterWorkflow && taskAfterWorkflow.preGenCount !== undefined && taskAfterWorkflow.importantNodeCount !== undefined) {
      currentStep = taskAfterWorkflow.preGenCount + taskAfterWorkflow.importantNodeCount;
      updateTask(taskId, { currentStep });
      console.log(`Workflow execution complete. Updated currentStep to ${currentStep}/${taskAfterWorkflow.totalSteps}`);
    }

    // Track post-generation errors
    const postGenErrors = [];
    
    // Process post-generation tasks from config
    if (postGenerationTasks && Array.isArray(postGenerationTasks)) {
      console.log(`Processing ${postGenerationTasks.length} post-generation tasks...`);
      
      // Retrieve current step from task
      const task = getTask(taskId);
      let currentStep = task?.currentStep || 0;
      const totalSteps = task?.totalSteps || 1;
      
      // Compute context for process handlers
      const __dirname = path.dirname(new URL(import.meta.url).pathname);
      const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
      const storagePath = path.join(actualDirname, 'storage');
      
      for (let i = 0; i < postGenerationTasks.length; i++) {
        const taskConfig = postGenerationTasks[i];
        
        // Determine task type: prompt task or process task
        const hasPrompt = taskConfig.prompt !== undefined && taskConfig.prompt !== null;
        const hasProcess = taskConfig.process !== undefined && taskConfig.process !== null;
        const shouldCount = hasPrompt || hasProcess;
        
        // Check if task has a condition
        if (taskConfig.condition) {
          const dataSources = {
            data: generationData,           // Primary: new 'data' key for conditions
            generationData: generationData, // Additional key for post-gen tasks
            value: generationData           // Backward compatibility
          };
          const shouldExecute = checkExecutionCondition(dataSources, taskConfig.condition);
          if (!shouldExecute) {
            const taskName = taskConfig.name || (hasProcess ? `process ${taskConfig.process}` : `prompt to ${taskConfig.to}`);
            console.log(`Skipping post-generation task ${taskName} due to unmet condition`);
            // Increment step counter only if this task should be counted
            if (shouldCount) {
              currentStep++;
            }
            continue;
          }
        }
        
        try {
          // Process task handling
          if (hasProcess) {
            // Show progress for process task
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || `Processing ${taskConfig.process}`;
            
            // Emit SSE progress update for start
            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');
            
            // Get the process handler
            const handler = PROCESS_HANDLERS[taskConfig.process];
            if (!handler) {
              throw new Error(`Unknown process handler: ${taskConfig.process}`);
            }
            
            // Build context for process handler
            const context = { storagePath, savePath, workflowsData, serverConfig };
            
            // Execute the process handler (fail immediately on error)
            await handler(taskConfig.parameters || {}, generationData, context);
            
            // Increment step counter
            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            
            // Emit SSE progress update for completion
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          }
          // Prompt task handling
          else if (hasPrompt) {
            // Show progress for prompt task
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || (taskConfig.to === 'description' 
              ? `Analyzing image` 
              : `Generating ${taskConfig.to}`);
            
            // Emit SSE progress update for start
            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');
            
            await modifyGenerationDataWithPrompt(taskConfig, generationData);
            
            // Increment step counter
            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            
            // Emit SSE progress update for completion
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          }
          // Data copy task (from/to) or template task - no progress tracking
          else {
            await modifyGenerationDataWithPrompt(taskConfig, generationData);
          }
        } catch (error) {
          // Process tasks fail immediately
          if (hasProcess) {
            console.error(`Post-generation process task failed:`, error.message);
            throw error;
          }
          // Prompt tasks fail gracefully
          else if (hasPrompt) {
            console.warn(`Failed to process prompt for ${taskConfig.to}:`, error.message);
            
            // Track the error for reporting
            postGenErrors.push({ field: taskConfig.to, error: error.message });
            
            // Set a fallback value if the prompt fails
            if (!generationData[taskConfig.to]) {
              generationData[taskConfig.to] = taskConfig.to === 'description' 
                ? 'Image analysis unavailable' 
                : 'Generated Content';
            }
            // Increment step counter
            currentStep++;
          }
          // Other tasks fail immediately
          else {
            throw error;
          }
        }
      }
    }

    // Check if the file was created
    if (!fs.existsSync(savePath)) {
      throw new Error(`Generated image file not found at: ${savePath}`);
    }

    console.log(`Image generated successfully`);
    
    // For audio workflows, also check if audio file was created
    if (isAudio && generationData.saveAudioPath) {
      if (!fs.existsSync(generationData.saveAudioPath)) {
        throw new Error(`Generated audio file not found at: ${generationData.saveAudioPath}`);
      }
      console.log(`Audio file generated successfully at: ${generationData.saveAudioPath}`);
    }

    // Calculate time taken in seconds
    const startTime = taskTimers.get(taskId);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    console.log(`Generation completed in ${timeTaken} seconds`);

    // Add final fields to generationData before saving
    generationData.workflow = workflow;
    generationData.inpaint = inpaint || false;
    generationData.inpaintArea = inpaintArea || null;
    generationData.timeTaken = timeTaken;
    
    // Ensure defaults for optional fields
    if (!generationData.description) generationData.description = '';
    if (!generationData.summary) generationData.summary = '';
    if (!generationData.tags) generationData.tags = '';

    // Save image data to database using entire generationData object (skip if silent mode)
    if (!silent && addMediaDataEntry) {
      addMediaDataEntry(generationData);
      console.log('Image data entry saved to database with UID:', generationData.uid);
    } else if (silent) {
      console.log('Silent mode: Skipping database entry for nested workflow');
    }

    // Prepare completion data
    const completionData = {
      ...generationData,
      maxValue: totalSteps
    };
    
    // Add error information if post-generation tasks failed
    if (postGenErrors.length > 0) {
      completionData.warnings = postGenErrors.map(e => `Failed to generate ${e.field}: ${e.error}`);
      console.log(`Task ${taskId} completed with ${postGenErrors.length} post-generation error(s)`);
    }

    // Emit completion event using entire generationData object
    emitTaskCompletion(taskId, completionData);

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
