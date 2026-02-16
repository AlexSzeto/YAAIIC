/**
 * execute-workflow – Post-generation processor that triggers a nested workflow
 * execution, mapping inputs/outputs between the parent and child workflows.
 *
 * This processor uses Dependency Injection: the heavy dependencies
 * (`uploadFileToComfyUI`, `generateTaskId`, `createTask`, `getTask`,
 * `processGenerationTask`) are expected on the `context` object rather than
 * being imported directly, which avoids a circular dependency back to
 * `generate.mjs`.
 *
 * @module features/generation/processors/execute-workflow
 */
import fs from 'fs';
import path from 'path';

/**
 * @param {Object} parameters - Task parameters from the workflow config.
 * @param {string} parameters.workflow       - Name of the target workflow.
 * @param {Array}  [parameters.inputMapping] - Rules for mapping parent → child.
 * @param {Array}  [parameters.outputMapping]- Rules for mapping child → parent.
 * @param {Object} generationData  - Mutable generation context.
 * @param {Object} context         - Execution context (injected dependencies).
 * @param {Object}   context.workflowsData        - Parsed comfyui-workflows.json.
 * @param {Object}   context.serverConfig          - Server configuration.
 * @param {Function} context.uploadFileToComfyUI   - File upload helper.
 * @param {Function} context.generateTaskId        - SSE task-id generator.
 * @param {Function} context.createTask            - SSE task creator.
 * @param {Function} context.getTask               - SSE task getter.
 * @param {Function} context.processGenerationTask - Main generation loop.
 */
export async function executeWorkflow(parameters, generationData, context) {
  const { workflow: targetWorkflowName, inputMapping = [], outputMapping = [] } = parameters;

  if (!targetWorkflowName) {
    throw new Error('executeWorkflow requires "workflow" parameter');
  }

  console.log(`[Process] Executing nested workflow: ${targetWorkflowName}`);

  const {
    workflowsData, serverConfig,
    uploadFileToComfyUI, generateTaskId, createTask, getTask,
    processGenerationTask
  } = context;

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
          const uploadResult = await uploadFileToComfyUI(imageBuffer, filename, 'image', 'input', true);

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
          const uploadResult = await uploadFileToComfyUI(audioBuffer, filename, 'audio', 'input', true);

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
