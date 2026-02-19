/**
 * Upload Service – file upload logic for the upload domain.
 *
 * Handles processing of uploaded media files (images and audio),
 * including saving to storage, generating album covers for audio files,
 * running post-generation tasks (LLM-driven descriptions, tags, etc.),
 * and creating database entries.
 *
 * @module features/upload/service
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { modifyGenerationDataWithPrompt } from '../generation/orchestrator.mjs';
import { checkPromptStatus } from '../generation/orchestrator.mjs';
import { uploadFile } from '../generation/comfy-client.mjs';
import { CLIENT_ID } from '../../comfyui-websocket.mjs';
import { setObjectPathValue, findNextIndex } from '../../util.mjs';
import { STORAGE_DIR, WORKFLOWS_DIR } from '../../core/paths.mjs';
import {
  generateTaskId,
  createTask,
  getTask,
  updateTask,
  emitProgressUpdate,
  emitTaskCompletion,
  emitTaskErrorByTaskId,
  resetProgressLog
} from '../../core/sse.mjs';
import { resetPromptLog } from '../../core/llm.mjs';

// Function to add media data entry (will be set by server.mjs)
let addMediaDataEntry = null;

// Timer map to track start times for each task
const taskTimers = new Map();

/**
 * Set the function used to persist new media entries to the database.
 * Must be called once at startup.
 * @param {Function} func
 */
export function setUploadAddMediaDataEntry(func) {
  addMediaDataEntry = func;
}

/**
 * Re-export uploadFile from comfy-client so that other upload-domain
 * consumers don't need to reach into comfy-client directly.
 */
export { uploadFile as uploadFileToComfyUI };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a media upload (image or audio).
 *
 * Resets logging, creates an SSE task, delegates to the async pipeline,
 * and returns a task ID for SSE progress tracking.
 *
 * @param {Object} file             - Multer file object (buffer, originalname, mimetype, …).
 * @param {Object} workflowsConfig  - Parsed comfyui-workflows.json.
 * @param {string|null} [name]      - Optional user-supplied name.
 * @returns {Promise<string>} Task ID.
 */
export async function processMediaUpload(file, workflowsConfig, name = null) {
  // Reset per-request logs
  resetPromptLog();
  resetProgressLog();

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
  processUploadTask(taskId, file, workflowsConfig, name).catch(error => {
    console.error(`Error in upload task ${taskId}:`, error);
    emitTaskErrorByTaskId(taskId, 'Upload failed', error.message);
  });

  return taskId;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Helper: generate album cover for audio uploads.
 */
async function generateAlbumCover(taskId, requestData, workflowConfig, workflowsConfig) {
  const { base: workflowBasePath, replace: modifications, postGenerationTasks, options } = workflowConfig;
  const { seed, saveImagePath, prompt } = requestData;

  console.log(`Generating album cover with workflow: ${workflowBasePath}`);

  // Create generationData for the album cover
  const generationData = { ...requestData };

  // Load the ComfyUI workflow
  const workflowPath = path.join(WORKFLOWS_DIR, workflowBasePath);
  let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

  // Set up generationData fields
  if (saveImagePath) {
    generationData.saveImageFilename = path.basename(saveImagePath, path.extname(saveImagePath));
  }
  generationData.storagePath = STORAGE_DIR;

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
  const { getApiPath } = await import('../generation/comfy-client.mjs');
  const comfyUIAPIPath = getApiPath();

  const comfyResponse = await fetch(`${comfyUIAPIPath}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

/**
 * Process upload task asynchronously.
 */
async function processUploadTask(taskId, file, workflowsConfig, extractedName = null) {
  try {
    // Detect file type
    const isAudio = file.mimetype.startsWith('audio/');
    const fileTypeLabel = isAudio ? 'Audio' : 'Media';

    // Emit progress: Uploading file
    emitProgressUpdate(taskId, { percentage: 10, value: 1, max: 4 }, `Uploading ${fileTypeLabel.toLowerCase()}...`);

    // Determine file type and extension
    const ext = path.extname(file.originalname) || (isAudio ? '.mp3' : '.png');
    const fileType = isAudio ? 'audio' : 'image';

    // Save file to storage directory
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // Generate filename using type_index format
    const nextIndex = findNextIndex(fileType, STORAGE_DIR);
    const filename = `${fileType}_${nextIndex}${ext}`;

    const savePath = path.join(STORAGE_DIR, filename);
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
      const timestamp = Date.now();
      const albumRequestData = {
        workflow: albumWorkflowName,
        name: baseName,
        seed: Math.floor(Math.random() * 4294967295),
        saveImagePath: path.join(STORAGE_DIR, `album_${timestamp}.png`),
        saveImageFilename: `album_${timestamp}`
      };

      // Generate the album cover
      try {
        const albumResult = await generateAlbumCover(taskId, albumRequestData, albumWorkflow, workflowsConfig);

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
