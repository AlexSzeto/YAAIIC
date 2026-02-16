/**
 * Generation Router – Express routes for the generation domain.
 *
 * Owns the `/generate` and `/regenerate` endpoints.  Route handlers are thin
 * adapters: they validate the request, resolve shared dependencies from
 * `req.app.locals`, and delegate to the orchestrator / LLM modules.
 *
 * @module features/generation/router
 */
import { Router } from 'express';
import path from 'path';
import { upload } from '../upload/router.mjs';
import { handleMediaGeneration } from './orchestrator.mjs';
import { validateNoNestedExecuteWorkflow } from './workflow-validator.mjs';
import { modifyDataWithPrompt, resetPromptLog } from '../../llm.mjs';
import {
  createTask, deleteTask, getTask,
  resetProgressLog,
  emitProgressUpdate, emitTaskError
} from '../../sse.mjs';
import {
  findMediaByUid, findMediaIndexByUid, getAllMediaData, saveMediaData
} from '../../core/database.mjs';
import { SERVER_DIR } from '../../core/paths.mjs';

const router = Router();

// ---------------------------------------------------------------------------
// POST /generate – kick off a ComfyUI media-generation pipeline
// ---------------------------------------------------------------------------

/**
 * POST /generate
 *
 * Accepts multipart form data (via Multer `upload.any()`).  Validates the
 * requested workflow, uploads attached files to ComfyUI, then delegates the
 * actual pipeline to the orchestrator.
 */
router.post('/generate', upload.any(), async (req, res) => {
  try {
    const { workflow } = req.body;

    // --- Validate workflow name ---
    if (!workflow) {
      return res.status(400).json({ error: 'Workflow parameter is required' });
    }

    const comfyuiWorkflows = req.app.locals.comfyuiWorkflows;
    const config = req.app.locals.config;
    const uploadFileToComfyUI = req.app.locals.uploadFileToComfyUI;

    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === workflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Workflow '${workflow}' not found` });
    }

    // --- Generate random seed if not provided ---
    if (!req.body.seed) {
      req.body.seed = Math.floor(Math.random() * 4294967295);
      console.log('Generated random seed:', req.body.seed);
    }

    // --- Fill in expected but missing image-data fields ---
    const requiredImageDataFields = ['tags', 'prompt', 'description', 'summary'];
    requiredImageDataFields.forEach(field => {
      if (req.body[field] === undefined || req.body[field] === null) {
        req.body[field] = '';
        console.log(`Filled missing field '${field}' with blank string`);
      }
    });

    // --- Validate required input files ---
    const requiredImages = workflowData.options?.inputImages || 0;
    const requiredAudios = workflowData.options?.inputAudios || 0;

    let uploadedImages = 0;
    let uploadedAudios = 0;

    if (req.files) {
      req.files.forEach(file => {
        if (file.fieldname.startsWith('image_')) uploadedImages++;
        else if (file.fieldname.startsWith('audio_')) uploadedAudios++;
      });
    }

    if (requiredImages > 0 && uploadedImages < requiredImages) {
      console.log(`Workflow '${workflow}' requires ${requiredImages} image(s), but only ${uploadedImages} were provided`);
      return res.status(400).json({
        error: `Workflow requires ${requiredImages} input image(s), but only ${uploadedImages} were provided`
      });
    }

    if (requiredAudios > 0 && uploadedAudios < requiredAudios) {
      console.log(`Workflow '${workflow}' requires ${requiredAudios} audio file(s), but only ${uploadedAudios} were provided`);
      return res.status(400).json({
        error: `Workflow requires ${requiredAudios} input audio file(s), but only ${uploadedAudios} were provided`
      });
    }

    // --- Upload files to ComfyUI when the workflow declares upload specs ---
    if (workflowData.upload && Array.isArray(workflowData.upload) && req.files && req.files.length > 0) {
      try {
        console.log('Processing uploaded files for workflow...');

        const uploadedFilesByName = {};
        req.files.forEach(file => { uploadedFilesByName[file.fieldname] = file; });

        for (const uploadSpec of workflowData.upload) {
          const { from } = uploadSpec;

          if (uploadedFilesByName[from]) {
            const uploadedFile = uploadedFilesByName[from];
            const isAudio = from.startsWith('audio_');
            const fileType = isAudio ? 'audio' : 'image';

            console.log(`Processing uploaded ${fileType} for field '${from}'...`);

            const fileExt = path.extname(uploadedFile.originalname) || (isAudio ? '.mp3' : '.png');

            let uploadFilename;
            if (isAudio) {
              const audioUrl = req.body[`${from}_uid`]
                ? findMediaByUid(parseInt(req.body[`${from}_uid`]))?.audioUrl
                : null;
              uploadFilename = audioUrl ? audioUrl.replace('/media/', '') : `audio_${Date.now()}${fileExt}`;
            } else {
              const imageUrl = req.body[`${from}_uid`]
                ? findMediaByUid(parseInt(req.body[`${from}_uid`]))?.imageUrl
                : null;
              uploadFilename = imageUrl ? imageUrl.replace('/media/', '') : `image_${Date.now()}${fileExt}`;
            }

            const uploadResult = await uploadFileToComfyUI(uploadedFile.buffer, uploadFilename, fileType, 'input', true);
            console.log(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded successfully: ${uploadFilename}`);

            // Store filename for reference in workflow mappings
            req.body[`${from}_filename`] = uploadResult.filename;
          }
        }

        // Remove files before forwarding to the orchestrator
        delete req.files;
      } catch (uploadError) {
        console.error('Failed to upload files to ComfyUI:', uploadError);
        return res.status(500).json({ error: 'Failed to upload files', details: uploadError.message });
      }
    }

    // --- Validate no nested executeWorkflow ---
    const validation = validateNoNestedExecuteWorkflow(workflowData, comfyuiWorkflows.workflows);
    if (!validation.valid) {
      console.error('Workflow validation failed:', validation.error);
      return res.status(400).json({ error: 'Workflow validation failed', details: validation.error });
    }

    console.log('Starting media generation with request data: ', req.body);
    handleMediaGeneration(req, res, workflowData, config, uploadFileToComfyUI);
  } catch (error) {
    console.error('Error in generate endpoint:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /regenerate – re-run LLM post-gen tasks for specific fields
// ---------------------------------------------------------------------------

/**
 * POST /regenerate
 *
 * Re-runs the configured `defaultImageGenerationTasks` for a subset of
 * fields on an existing media entry.  Returns a task ID for SSE progress
 * tracking.
 */
router.post('/regenerate', async (req, res) => {
  try {
    const { uid, fields } = req.body;

    // --- Validate ---
    if (!uid) {
      return res.status(400).json({ error: 'Missing required field: uid' });
    }
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid fields array' });
    }

    // Reset prompt / progress logs
    resetPromptLog();
    resetProgressLog();

    console.log(`Regenerate request for UID: ${uid}, fields: ${fields.join(', ')}`);

    const imageIndex = findMediaIndexByUid(uid);
    if (imageIndex === -1) {
      console.log(`No image found with UID: ${uid}`);
      return res.status(404).json({ error: `Image with uid ${uid} not found` });
    }

    const imageEntry = getAllMediaData()[imageIndex];

    // Reconstruct saveImagePath from imageUrl
    if (imageEntry.imageUrl) {
      const filename = imageEntry.imageUrl.replace(/^\/media\//, '');
      imageEntry.saveImagePath = path.join(SERVER_DIR, 'storage', filename);
      console.log(`Reconstructed saveImagePath: ${imageEntry.saveImagePath}`);
    }

    // Create SSE task
    const taskId = `regenerate-${uid}-${Date.now()}`;
    createTask(taskId, { type: 'regenerate', uid, fields });

    // Respond immediately with taskId
    res.json({ taskId, message: 'Regeneration started' });

    try {
      const comfyuiWorkflows = req.app.locals.comfyuiWorkflows;
      const postGenTasks = comfyuiWorkflows.defaultImageGenerationTasks || [];

      let completedFields = 0;
      const totalFields = fields.length;

      for (const field of fields) {
        console.log(`Regenerating field: ${field}`);

        const task = postGenTasks.find(t => t.to === field);
        if (!task) {
          console.log(`No postGenerationTask found for field: ${field}`);
          emitProgressUpdate(taskId, `Skipping ${field} - no task configured`, completedFields / totalFields);
          completedFields++;
          continue;
        }

        emitProgressUpdate(taskId, `Regenerating ${field}...`, completedFields / totalFields);
        await modifyDataWithPrompt(task, imageEntry);

        completedFields++;
        console.log(`Completed regeneration for field: ${field}`);
      }

      // Persist
      saveMediaData();

      // Remove transient field before sending to client
      const { saveImagePath, ...imageDataForClient } = imageEntry;

      // Send SSE completion event
      const sseTask = getTask(taskId);
      if (sseTask && sseTask.sseClients) {
        const completionMessage = {
          taskId,
          status: 'completed',
          progress: { percentage: 100, currentStep: 'Complete', currentValue: 1, maxValue: 1 },
          mediaData: imageDataForClient,
          message: 'Regeneration complete',
          timestamp: new Date().toISOString()
        };

        const data = JSON.stringify(completionMessage);
        sseTask.sseClients.forEach(client => {
          try { client.write(`event: complete\ndata: ${data}\n\n`); }
          catch (error) { console.error('Failed to send completion to client:', error); }
        });
      }

      console.log(`Regeneration completed for UID: ${uid}`);
      setTimeout(() => deleteTask(taskId), 5000);

    } catch (regenerateError) {
      console.error('Error during regeneration:', regenerateError);
      emitTaskError(taskId, `Regeneration failed: ${regenerateError.message}`);
      setTimeout(() => deleteTask(taskId), 5000);
    }

  } catch (error) {
    console.error('Error in regenerate endpoint:', error);
    res.status(500).json({ error: 'Failed to process regenerate request', details: error.message });
  }
});

export default router;
