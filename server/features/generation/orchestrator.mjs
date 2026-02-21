/**
 * Orchestrator – coordinates the full media-generation pipeline:
 *   1. Pre-generation tasks  (LLM prompts, data copies, process handlers)
 *   2. ComfyUI workflow execution
 *   3. Post-generation tasks (extractors, crossfade, nested workflows, LLM prompts)
 *
 * @module features/generation/orchestrator
 */
import fs from 'fs';
import path from 'path';
import { connectToComfyUI, CLIENT_ID } from '../../comfyui-websocket.mjs';
import { setObjectPathValue, checkExecutionCondition, findNextIndex } from '../../util.mjs';

import { PROCESS_HANDLERS } from './processors/index.mjs';
import {
  generateTaskId,
  createTask,
  getTask,
  updateTask,
  setTaskPromptId,
  emitProgressUpdate,
  emitTaskCompletion,
  emitTaskErrorByTaskId,
  resetProgressLog
} from '../../core/sse.mjs';
import { modifyDataWithPrompt, resetPromptLog } from '../../core/llm.mjs';
import { COMFYUI_WORKFLOWS_DIR, STORAGE_DIR, LOGS_DIR } from '../../core/paths.mjs';
import { loadWorkflows } from './workflow-validator.mjs';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** ComfyUI HTTP API base URL (set via {@link initializeOrchestrator}). */
let comfyUIAPIPath = null;

/** Track the last used workflow to manage VRAM. */
let lastUsedWorkflow = null;

/** Function to add a new media-data entry (set via {@link setAddMediaDataEntry}). */
let addMediaDataEntry = null;

/** Per-task start timestamps for elapsed-time logging. */
const taskTimers = new Map();

// ---------------------------------------------------------------------------
// Important node types for progress tracking
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Initialization helpers (called from server.mjs)
// ---------------------------------------------------------------------------

/**
 * Set the ComfyUI API base URL for this module.
 * @param {string} apiPath - e.g. `http://127.0.0.1:8188`
 */
export function initializeOrchestrator(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('Orchestrator initialized with ComfyUI API path:', apiPath);
}

/**
 * Provide the database-entry callback.
 * @param {Function} func - `addMediaDataEntry` from `core/database.mjs`.
 */
export function setAddMediaDataEntry(func) {
  addMediaDataEntry = func;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Free VRAM on the ComfyUI server. */
async function freeComfyUIMemory() {
  if (!comfyUIAPIPath) return;

  try {
    console.log('Freeing ComfyUI memory...');
    const response = await fetch(`${comfyUIAPIPath}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true })
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

/**
 * Poll the ComfyUI `/history` endpoint until the prompt completes or errors.
 * @param {string} promptId
 * @param {number} [maxAttempts=1800]
 * @param {number} [intervalMs=1000]
 * @returns {Promise<{completed: boolean, error?: boolean, data?: Object}>}
 */
export async function checkPromptStatus(promptId, maxAttempts = 1800, intervalMs = 1000) {
  if (!comfyUIAPIPath) {
    throw new Error('Orchestrator not initialized – ComfyUI API path not available');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${comfyUIAPIPath}/history/${promptId}`);

      if (!response.ok) {
        throw new Error(`History request failed: ${response.status}`);
      }

      const history = await response.json();

      if (history[promptId]) {
        const promptData = history[promptId];

        if (promptData.status && promptData.status.completed) {
          console.log(`Prompt ${promptId} completed successfully`);
          return { completed: true, data: promptData };
        }

        if (promptData.status && promptData.status.status_str === 'error') {
          console.log(`Prompt ${promptId} failed with error`);
          return { completed: false, error: true, data: promptData };
        }
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error(`Error checking prompt status (attempt ${attempt + 1}):`, error);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Prompt ${promptId} did not complete within ${maxAttempts * intervalMs / 1000} seconds`);
}

/**
 * Calculate the total number of progress steps for a generation run.
 */
function calculateTotalSteps(preGenTasks, workflowNodes, postGenTasks) {
  let preGenCount = 0;
  if (preGenTasks && Array.isArray(preGenTasks)) {
    preGenCount = preGenTasks.filter(task =>
      (task.prompt !== undefined && task.prompt !== null) ||
      (task.process !== undefined && task.process !== null)
    ).length;
  }

  let importantNodeCount = 0;
  if (workflowNodes && typeof workflowNodes === 'object') {
    for (const nodeId in workflowNodes) {
      const node = workflowNodes[nodeId];
      if (node && node.class_type && IMPORTANT_NODE_TYPES.includes(node.class_type)) {
        importantNodeCount++;
      }
    }
  }

  let postGenCount = 0;
  if (postGenTasks && Array.isArray(postGenTasks)) {
    postGenCount = postGenTasks.filter(task =>
      (task.prompt !== undefined && task.prompt !== null) ||
      (task.process !== undefined && task.process !== null)
    ).length;
  }

  const totalSteps = preGenCount + importantNodeCount + postGenCount;
  console.log(`Step calculation: Pre-gen=${preGenCount}, Important nodes=${importantNodeCount}, Post-gen=${postGenCount}, Total=${totalSteps}`);

  return { totalSteps, preGenCount, importantNodeCount, postGenCount };
}

/**
 * Wrapper kept for backwards compatibility.
 * @param {Object} promptData
 * @param {Object} generationData
 */
export async function modifyGenerationDataWithPrompt(promptData, generationData) {
  return modifyDataWithPrompt(promptData, generationData);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a generation task in the SSE manager and returns its `taskId`.
 * Does **not** start processing — callers are responsible for invoking
 * {@link processGenerationTask} (synchronously or in the background).
 *
 * @param {Object} reqBody         - Request body from the client.
 * @param {Object} workflowConfig  - The matched workflow object.
 * @param {Object} [serverConfig]  - Server-wide configuration (reserved).
 * @param {Object} [options]       - Additional options (reserved).
 * @returns {{ taskId: string }}
 */
export function initializeGenerationTask(reqBody, workflowConfig, serverConfig, options) {
  const { base: workflowBasePath } = workflowConfig;
  const { workflow } = reqBody;

  console.log('Using workflow:', workflowBasePath);

  const taskId = generateTaskId();
  taskTimers.set(taskId, Date.now());

  createTask(taskId, {
    workflow,
    promptId: null,
    requestData: { ...reqBody },
    workflowConfig
  });

  console.log(`Created task ${taskId}`);

  return { taskId };
}

/**
 * @deprecated Use {@link initializeGenerationTask} + {@link processGenerationTask} instead.
 *
 * Entry point called by the Express route handler.
 * Creates a task, responds immediately with the `taskId`, and kicks off
 * {@link processGenerationTask} in the background.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Object}  workflowConfig - The matched workflow object.
 * @param {Object}  serverConfig   - Server-wide configuration.
 * @param {Function} uploadFileToComfyUI - File-upload helper (injected).
 */
export async function handleMediaGeneration(req, res, workflowConfig, serverConfig, uploadFileToComfyUI) {
  const { taskId } = initializeGenerationTask(req.body, workflowConfig, serverConfig);

  res.json({
    success: true,
    taskId,
    message: 'Generation task created'
  });

  processGenerationTask(taskId, req.body, workflowConfig, serverConfig, false, uploadFileToComfyUI).catch(error => {
    console.error(`Error in background task ${taskId}:`, error);
  });
}

/**
 * Background processing function that executes the full pipeline:
 *   Pre-gen tasks → ComfyUI workflow → Post-gen tasks → Database entry
 *
 * @param {string}  taskId
 * @param {Object}  requestData
 * @param {Object}  workflowConfig
 * @param {Object}  serverConfig
 * @param {boolean} [silent=false] - If true, skip database entry (nested workflows).
 * @param {Function} uploadFileToComfyUI - File-upload helper (injected).
 */
export async function processGenerationTask(taskId, requestData, workflowConfig, serverConfig, silent = false, uploadFileToComfyUI) {
  try {
    const { base: workflowBasePath, replace: modifications, postGenerationTasks, preGenerationTasks, options } = workflowConfig;
    const { type } = options || {};

    // Load fresh from disk so any edits made via the workflow editor are reflected.
    const workflowsData = loadWorkflows();
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

    // Ensure ComfyUI WebSocket connection is fresh/active
    console.log(`Refreshing ComfyUI WebSocket connection for task ${taskId}...`);
    connectToComfyUI(true);

    // Small delay to allow connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));

    const task = getTask(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found during processing`);
      return;
    }

    // Initialize logging
    resetPromptLog();
    resetProgressLog();

    console.log('Using seed:', seed);

    // Log inpaint-specific parameters for debugging
    if (inpaint) {
      console.log('Inpaint operation detected');
      console.log('Using imagePath:', imagePath);
      console.log('Using maskPath:', maskPath);
      if (inpaintArea) {
        console.log('Using inpaintArea:', inpaintArea);
      }
    }

    // Check if workflow has changed and free memory if needed
    if (lastUsedWorkflow && lastUsedWorkflow !== workflowBasePath) {
      console.log(`Workflow changed from ${lastUsedWorkflow} to ${workflowBasePath}. Freeing memory...`);
      await freeComfyUIMemory();
    }

    // Update last used workflow
    lastUsedWorkflow = workflowBasePath;

    // Load the ComfyUI workflow
    const workflowPath = path.join(COMFYUI_WORKFLOWS_DIR, workflowBasePath);
    let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // storagePath: absolute path to /storage folder
    generationData.storagePath = STORAGE_DIR;

    // Store the workflow JSON in the task for node title lookups
    updateTask(taskId, { workflowData });

    // Initialize step tracking variables
    let currentStep = 0;
    let totalSteps = 1;

    // Calculate total steps using the dynamic calculation
    const stepCalc = calculateTotalSteps(preGenerationTasks, workflowData, postGenerationTasks);
    totalSteps = stepCalc.totalSteps;
    const preGenCount = stepCalc.preGenCount;
    const importantNodeCount = stepCalc.importantNodeCount;
    const postGenCount = stepCalc.postGenCount;

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

    // Store important nodes set and total steps in the task
    updateTask(taskId, { importantNodes, totalSteps, currentStep, preGenCount, importantNodeCount, postGenCount });

    // -----------------------------------------------------------------------
    // PRE-GENERATION TASKS
    // -----------------------------------------------------------------------
    if (preGenerationTasks && Array.isArray(preGenerationTasks) && preGenerationTasks.length > 0) {
      console.log(`Processing ${preGenerationTasks.length} pre-generation tasks...`);

      const storagePath = STORAGE_DIR;

      for (let i = 0; i < preGenerationTasks.length; i++) {
        const taskConfig = preGenerationTasks[i];

        const hasPrompt = taskConfig.prompt !== undefined && taskConfig.prompt !== null;
        const hasProcess = taskConfig.process !== undefined && taskConfig.process !== null;
        const shouldCount = hasPrompt || hasProcess;

        // Check condition
        if (taskConfig.condition) {
          const dataSources = {
            data: generationData,
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, taskConfig.condition);
          if (!shouldExecute) {
            console.log(`Skipping pre-generation task due to unmet condition`);
            if (shouldCount) {
              currentStep++;
            }
            continue;
          }
        }

        try {
          if (hasProcess) {
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || `Processing ${taskConfig.process}`;

            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');

            const handler = PROCESS_HANDLERS[taskConfig.process];
            if (!handler) {
              throw new Error(`Unknown process handler: ${taskConfig.process}`);
            }

            const saveImagePath = generationData.saveImagePath || '';
            const context = { storagePath, saveImagePath, workflowsData, serverConfig, uploadFileToComfyUI, generateTaskId, createTask, getTask, processGenerationTask };

            await handler(taskConfig.parameters || {}, generationData, context);

            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          } else if (hasPrompt) {
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || `Generating ${taskConfig.to}`;

            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');

            await modifyGenerationDataWithPrompt(taskConfig, generationData);

            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          } else if (Array.isArray(taskConfig.math)) {
            // Math operations task – not counted for progress tracking
            let value = Number(generationData[taskConfig.from]);
            for (const step of taskConfig.math) {
              const { offset = 0, scale = 1, bias = 0, round = 'none' } = step;
              value = (value + offset) * scale + bias;
              if (round === 'floor') value = Math.floor(value);
              else if (round === 'ceil')  value = Math.ceil(value);
            }
            generationData[taskConfig.to] = value;
          } else {
            await modifyGenerationDataWithPrompt(taskConfig, generationData);
          }
        } catch (error) {
          console.error(`Pre-generation task failed:`, error.message);
          throw new Error(`Pre-generation failed: ${error.message}`);
        }
      }

      updateTask(taskId, { currentStep });
    }

    // -----------------------------------------------------------------------
    // CREATE OUTPUT FILE PATHS
    // -----------------------------------------------------------------------
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const isAudio = type === 'audio';
    const isVideo = type === 'video';

    const imageFormat = generationData.imageFormat;
    const audioFormat = generationData.audioFormat;

    if (!isAudio && !imageFormat) {
      throw new Error('imageFormat is required but not found in generation data. Check workflow configuration and extra inputs.');
    }

    if (isAudio && !audioFormat) {
      throw new Error('audioFormat is required for audio workflows but not found in generation data. Check workflow configuration and extra inputs.');
    }

    // Create saveImagePath if not already set
    if (!generationData.saveImagePath) {
      const nextIndex = findNextIndex('image', STORAGE_DIR);
      const imageFilename = `image_${nextIndex}.${imageFormat}`;
      generationData.saveImagePath = path.join(STORAGE_DIR, imageFilename);
      console.log('Created saveImagePath:', generationData.saveImagePath);
    }

    generationData.saveImageFilename = path.basename(generationData.saveImagePath, path.extname(generationData.saveImagePath));
    console.log('Using saveImagePath:', generationData.saveImagePath);

    // For audio workflows, also create saveAudioPath
    if (isAudio) {
      const nextAudioIndex = findNextIndex('audio', STORAGE_DIR);
      const audioFilename = `audio_${nextAudioIndex}.${audioFormat}`;
      generationData.saveAudioPath = path.join(STORAGE_DIR, audioFilename);
      generationData.audioUrl = `/media/${audioFilename}`;
      console.log('Created saveAudioPath:', generationData.saveAudioPath);
      console.log('Created audioUrl:', generationData.audioUrl);
    }

    const saveImagePath = generationData.saveImagePath;

    // Set initial imageUrl
    const filename = path.basename(saveImagePath);
    generationData.imageUrl = `/media/${filename}`;

    // -----------------------------------------------------------------------
    // APPLY WORKFLOW MODIFICATIONS
    // -----------------------------------------------------------------------
    if (modifications && Array.isArray(modifications)) {
      modifications.forEach(mod => {
        if (mod.condition) {
          const dataSources = {
            data: generationData,
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, mod.condition);
          if (!shouldExecute) {
            console.log(`Skipping workflow modification due to unmet condition`);
            return;
          }
        }

        const { from, value: directValue, to } = mod;

        let value;
        if (directValue !== undefined) {
          value = directValue;
          console.log(`Modifying: direct value to ${to.join(',')}`);
        } else if (from) {
          value = generationData[from];
          console.log(`Modifying: ${from} to ${to.join(',')}`);
        }

        console.log(` - New value: ${value}`);

        if (value !== undefined && to && Array.isArray(to)) {
          workflowData = setObjectPathValue(workflowData, to, value);
        }
      });
    }

    // Write the modified workflow to logs for debugging
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const debugWorkflowPath = path.join(LOGS_DIR, 'sent-workflow.json');
    fs.writeFileSync(debugWorkflowPath, JSON.stringify(workflowData, null, 2), 'utf8');
    console.log(`Workflow written to: ${debugWorkflowPath}`);

    // -----------------------------------------------------------------------
    // COMFYUI WORKFLOW EXECUTION
    // -----------------------------------------------------------------------
    const comfyResponse = await fetch(`${comfyUIAPIPath}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflowData, client_id: CLIENT_ID })
    });

    if (!comfyResponse.ok) {
      throw new Error(`ComfyUI request failed: ${comfyResponse.status} ${comfyResponse.statusText}`);
    }

    const comfyResult = await comfyResponse.json();
    console.log('ComfyUI response:', comfyResult);

    const promptId = comfyResult.prompt_id;
    if (!promptId) {
      throw new Error('No prompt_id received from ComfyUI');
    }

    setTaskPromptId(taskId, promptId);
    console.log(`Task ${taskId} linked to prompt ${promptId}, waiting for completion...`);

    const statusResult = await checkPromptStatus(promptId);

    if (statusResult.error) {
      throw new Error('ComfyUI generation failed');
    }

    // Update currentStep after workflow execution completes
    const taskAfterWorkflow = getTask(taskId);
    if (taskAfterWorkflow && taskAfterWorkflow.preGenCount !== undefined && taskAfterWorkflow.importantNodeCount !== undefined) {
      currentStep = taskAfterWorkflow.preGenCount + taskAfterWorkflow.importantNodeCount;
      updateTask(taskId, { currentStep });
      console.log(`Workflow execution complete. Updated currentStep to ${currentStep}/${taskAfterWorkflow.totalSteps}`);
    }

    // -----------------------------------------------------------------------
    // POST-GENERATION TASKS
    // -----------------------------------------------------------------------
    const postGenErrors = [];

    if (postGenerationTasks && Array.isArray(postGenerationTasks)) {
      console.log(`Processing ${postGenerationTasks.length} post-generation tasks...`);

      const taskState = getTask(taskId);
      let currentStep = taskState?.currentStep || 0;
      const totalSteps = taskState?.totalSteps || 1;

      const storagePath = STORAGE_DIR;

      for (let i = 0; i < postGenerationTasks.length; i++) {
        const taskConfig = postGenerationTasks[i];

        const hasPrompt = taskConfig.prompt !== undefined && taskConfig.prompt !== null;
        const hasProcess = taskConfig.process !== undefined && taskConfig.process !== null;
        const shouldCount = hasPrompt || hasProcess;

        // Check condition
        if (taskConfig.condition) {
          const dataSources = {
            data: generationData,
            generationData: generationData,
            value: generationData
          };
          const shouldExecute = checkExecutionCondition(dataSources, taskConfig.condition);
          if (!shouldExecute) {
            const taskName = taskConfig.name || (hasProcess ? `process ${taskConfig.process}` : `prompt to ${taskConfig.to}`);
            console.log(`Skipping post-generation task ${taskName} due to unmet condition`);
            if (shouldCount) {
              currentStep++;
            }
            continue;
          }
        }

        try {
          if (hasProcess) {
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || `Processing ${taskConfig.process}`;

            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');

            const handler = PROCESS_HANDLERS[taskConfig.process];
            if (!handler) {
              throw new Error(`Unknown process handler: ${taskConfig.process}`);
            }

            const context = { storagePath, saveImagePath, workflowsData, serverConfig, uploadFileToComfyUI, generateTaskId, createTask, getTask, processGenerationTask };

            await handler(taskConfig.parameters || {}, generationData, context);

            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          } else if (hasPrompt) {
            const percentage = Math.round((currentStep / totalSteps) * 100);
            const stepName = taskConfig.name || (taskConfig.to === 'description'
              ? `Analyzing Image`
              : `Generating ${taskConfig.to}`);

            emitProgressUpdate(taskId, { percentage, value: currentStep, max: totalSteps }, stepName + '...');

            await modifyGenerationDataWithPrompt(taskConfig, generationData);

            currentStep++;
            const completionPercentage = Math.round((currentStep / totalSteps) * 100);
            emitProgressUpdate(taskId, { percentage: completionPercentage, value: currentStep, max: totalSteps }, stepName + ' complete');
          } else if (Array.isArray(taskConfig.math)) {
            // Math operations task – not counted for progress tracking
            let value = Number(generationData[taskConfig.from]);
            for (const step of taskConfig.math) {
              const { offset = 0, scale = 1, bias = 0, round = 'none' } = step;
              value = (value + offset) * scale + bias;
              if (round === 'floor') value = Math.floor(value);
              else if (round === 'ceil')  value = Math.ceil(value);
            }
            generationData[taskConfig.to] = value;
          } else {
            await modifyGenerationDataWithPrompt(taskConfig, generationData);
          }
        } catch (error) {
          if (hasProcess) {
            console.error(`Post-generation process task failed:`, error.message);
            throw error;
          } else if (hasPrompt) {
            console.warn(`Failed to process prompt for ${taskConfig.to}:`, error.message);
            postGenErrors.push({ field: taskConfig.to, error: error.message });

            if (!generationData[taskConfig.to]) {
              generationData[taskConfig.to] = taskConfig.to === 'description'
                ? 'Image analysis unavailable'
                : 'Generated Content';
            }
            currentStep++;
          } else {
            throw error;
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // FINALISATION
    // -----------------------------------------------------------------------

    if (isAudio && generationData.saveAudioPath) {
      if (!fs.existsSync(generationData.saveAudioPath)) {
        throw new Error(`Generated audio file not found at: ${generationData.saveAudioPath}`);
      }
      if (!fs.existsSync(generationData.saveImagePath)) {
        delete generationData.saveImagePath;
        delete generationData.imageUrl;
        delete generationData.saveImageFilename;
      }
      console.log(`Audio file generated successfully at: ${generationData.saveAudioPath}`);
    } else {
      if (!fs.existsSync(generationData.saveImagePath)) {
        throw new Error(`Generated image file not found at: ${generationData.saveImagePath}`);
      }
      console.log(`Image generated successfully`);
    }

    // Calculate time taken
    const startTime = taskTimers.get(taskId);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    console.log(`Generation completed in ${timeTaken} seconds`);

    // Add final fields to generationData before saving
    generationData.workflow = workflow;
    generationData.inpaint = inpaint || false;
    generationData.inpaintArea = inpaintArea || null;
    generationData.timeTaken = timeTaken;

    if (!generationData.description) generationData.description = '';
    if (!generationData.summary) generationData.summary = '';
    if (!generationData.tags) generationData.tags = '';

    // Save to database (skip if silent mode / nested workflow)
    if (!silent && addMediaDataEntry) {
      addMediaDataEntry(generationData);
      console.log('Media entry saved to database with UID:', generationData.uid);
    } else if (silent) {
      console.log('Silent mode: Skipping database entry for nested workflow');
    }

    // Prepare completion data
    const completionData = {
      ...generationData,
      maxValue: totalSteps
    };

    if (postGenErrors.length > 0) {
      completionData.warnings = postGenErrors.map(e => `Failed to generate ${e.field}: ${e.error}`);
      console.log(`Task ${taskId} completed with ${postGenErrors.length} post-generation error(s)`);
    }

    emitTaskCompletion(taskId, completionData);

    taskTimers.delete(taskId);
    console.log(`Task ${taskId} completed successfully`);

    return completionData;

  } catch (error) {
    console.error(`Error in task ${taskId}:`, error);
    taskTimers.delete(taskId);
    emitTaskErrorByTaskId(taskId, 'Failed to process generation request', error.message);
    throw error;
  }
}
