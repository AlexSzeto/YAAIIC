import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { sendImagePrompt, sendTextPrompt, modifyDataWithPrompt, resetPromptLog } from './llm.mjs';
import sharp from 'sharp';
import { setObjectPathValue, checkExecutionCondition, findNextIndex } from './util.mjs';
import { CLIENT_ID } from './comfyui-websocket.mjs';
import {
  generateTaskId,
  createTask,
  getTask,
  updateTask,
  emitProgressUpdate,
  emitTaskCompletion,
  emitTaskErrorByTaskId
} from './sse.mjs';
import { checkPromptStatus, modifyGenerationDataWithPrompt } from './features/generation/orchestrator.mjs';

// Store ComfyUI API path locally (needed by uploadFileToComfyUI)
let comfyUIAPIPath = null;

// Function to add image data entry (will be set by server.mjs)
let addMediaDataEntry = null;

// Timer map to track start times for each task
const taskTimers = new Map(); // taskId -> startTime


// Initialize generate module with ComfyUI API path
export function initializeGenerateModule(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('Generate module initialized with ComfyUI API path:', apiPath);
}

export function setUploadAddMediaDataEntry(func) {
  addMediaDataEntry = func;
}


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
