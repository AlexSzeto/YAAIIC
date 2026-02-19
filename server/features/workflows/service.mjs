/**
 * Workflow Service – business logic for workflow CRUD and auto-detection.
 *
 * Responsibilities:
 *   - Loading, saving, and deleting workflow entries in comfyui-workflows.json
 *   - Parsing workflow filenames into display names
 *   - Auto-detecting nodes in uploaded ComfyUI workflow JSON
 *
 * @module features/workflows/service
 */
import fs from 'fs';
import path from 'path';
import { WORKFLOWS_PATH, COMFYUI_WORKFLOWS_DIR } from '../../core/paths.mjs';

// ---------------------------------------------------------------------------
// Helpers: file I/O for comfyui-workflows.json
// ---------------------------------------------------------------------------

/**
 * Read and parse comfyui-workflows.json from disk.
 * @returns {Object} Parsed workflows data object.
 */
function readWorkflowsFile() {
  const raw = fs.readFileSync(WORKFLOWS_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Write the workflows data object back to disk.
 * @param {Object} data
 */
function writeWorkflowsFile(data) {
  fs.writeFileSync(WORKFLOWS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Name Parser
// ---------------------------------------------------------------------------

/**
 * Convert a workflow filename (without extension) to a display name.
 *
 * Format: `{model}-{source}-to-{dest}` → `{Source} to {Dest} ({Model})`
 *
 * Algorithm:
 *  1. Remove .json extension if present
 *  2. Split on `-to-` to get [before, after]
 *  3. Split before on first `-` to get [model, source]
 *  4. Capitalise each word in source and after (split on `-`)
 *  5. Format as `{Source} to {After} ({Model})`
 *
 * Falls back to the raw filename if the expected pattern is not found.
 *
 * @param {string} filename - e.g. "flux-image-to-video.json"
 * @returns {string} Display name, e.g. "Image to Video (Flux)"
 */
export function parseWorkflowName(filename) {
  // Remove extension
  const base = filename.replace(/\.json$/i, '');

  const toIndex = base.indexOf('-to-');
  if (toIndex === -1) return base;

  const before = base.slice(0, toIndex);   // e.g. "flux-image"
  const after  = base.slice(toIndex + 4);  // e.g. "video"

  const dashIndex = before.indexOf('-');
  if (dashIndex === -1) return base;

  const model  = before.slice(0, dashIndex);  // e.g. "flux"
  const source = before.slice(dashIndex + 1); // e.g. "image"

  const capitalize = (s) =>
    s.split('-')
     .map(w => w.charAt(0).toUpperCase() + w.slice(1))
     .join(' ');

  return `${capitalize(source)} to ${capitalize(after)} (${capitalize(model)})`;
}

// ---------------------------------------------------------------------------
// Auto-Detection Logic
// ---------------------------------------------------------------------------

/**
 * Analyse a ComfyUI workflow JSON object and return suggested workflow
 * configuration mappings.
 *
 * @param {Object} workflowJson - The raw ComfyUI workflow JSON.
 * @param {string} suggestedName - Display name derived from the filename.
 * @returns {{ workflow: Object, detectedNodes: Object }}
 */
export function autoDetectWorkflow(workflowJson, suggestedName) {
  const replace = [];
  const extraInputs = [];
  const detectedNodes = {
    images: [],
    audios: [],
    seeds: [],
    prompts: [],
    outputs: [],
    extras: [],
  };

  let imageCount = 0;
  let audioCount = 0;
  let workflowType = 'image';

  const mappedNodeIds = new Set(); // nodes already assigned a semantic role

  // First pass: output nodes and type detection
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (typeof node !== 'object' || !node.class_type) continue;

    const ct = node.class_type;

    if (ct === 'JWImageSaveToPath') {
      replace.push({ from: 'saveImagePath', to: [nodeId, 'inputs', 'path'] });
      detectedNodes.outputs.push({ nodeId, classType: ct, role: 'saveImagePath' });
      mappedNodeIds.add(nodeId);
    }

    if (ct === 'JWAudioSaveToPath') {
      replace.push({ from: 'saveAudioPath', to: [nodeId, 'inputs', 'path'] });
      detectedNodes.outputs.push({ nodeId, classType: ct, role: 'saveAudioPath' });
      workflowType = 'audio';
      mappedNodeIds.add(nodeId);
    }
  }

  // Second pass: input nodes
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (typeof node !== 'object' || !node.class_type) continue;

    const ct = node.class_type;

    if (ct === 'LoadImage') {
      const i = imageCount;
      imageCount++;
      replace.push({ from: `image_${i}_filename`, to: [nodeId, 'inputs', 'image'] });
      detectedNodes.images.push({ nodeId, classType: ct });
      mappedNodeIds.add(nodeId);
    }

    if (ct === 'LoadAudio') {
      const i = audioCount;
      audioCount++;
      replace.push({ from: `audio_${i}_filename`, to: [nodeId, 'inputs', 'audio'] });
      detectedNodes.audios.push({ nodeId, classType: ct });
      workflowType = 'audio';
      mappedNodeIds.add(nodeId);
    }
  }

  // Detect inpaint type: LoadImage + any node with mask-related input
  if (imageCount > 0) {
    const hasMask = Object.values(workflowJson).some(
      n => n && typeof n === 'object' && n.inputs &&
           Object.keys(n.inputs).some(k => k.toLowerCase().includes('mask'))
    );
    if (hasMask) workflowType = 'inpaint';
  }

  // Third pass: seed nodes
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (typeof node !== 'object' || !node.class_type) continue;
    if (mappedNodeIds.has(nodeId)) continue;

    const ct = node.class_type;

    if (ct.toLowerCase().includes('seed')) {
      replace.push({ from: 'seed', to: [nodeId, 'inputs', 'seed'] });
      detectedNodes.seeds.push({ nodeId, classType: ct });
      mappedNodeIds.add(nodeId);
      continue;
    }

    if (node.inputs && typeof node.inputs.seed !== 'undefined') {
      replace.push({ from: 'seed', to: [nodeId, 'inputs', 'seed'] });
      detectedNodes.seeds.push({ nodeId, classType: ct, field: 'seed' });
      mappedNodeIds.add(nodeId);
    }
  }

  // Fourth pass: prompt nodes
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (typeof node !== 'object' || !node.class_type) continue;
    if (mappedNodeIds.has(nodeId)) continue;

    const ct = node.class_type;

    // PrimitiveNode widgets that hold text
    if (ct === 'PrimitiveNode') {
      const widgets = node.widgets_values || [];
      const firstWidget = widgets[0];
      if (typeof firstWidget === 'string') {
        replace.push({ from: 'prompt', to: [nodeId, 'inputs', 'text'] });
        detectedNodes.prompts.push({ nodeId, classType: ct, value: firstWidget });
        mappedNodeIds.add(nodeId);
        continue;
      }
    }

    // CLIPTextEncode – check if text input is a direct string value (not linked)
    if (ct === 'CLIPTextEncode') {
      if (node.inputs && typeof node.inputs.text === 'string') {
        replace.push({ from: 'prompt', to: [nodeId, 'inputs', 'text'] });
        detectedNodes.prompts.push({ nodeId, classType: ct });
        mappedNodeIds.add(nodeId);
      }
    }
  }

  // Fifth pass: extra input candidates (unmapped PrimitiveNodes)
  let extraIndex = 0;
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (typeof node !== 'object' || !node.class_type) continue;
    if (mappedNodeIds.has(nodeId)) continue;
    if (node.class_type !== 'PrimitiveNode') continue;

    const widgets = node.widgets_values || [];
    const firstWidget = widgets[0];
    let inputType = 'text';
    let defaultValue = '';

    if (typeof firstWidget === 'number') {
      inputType = Number.isInteger(firstWidget) ? 'number' : 'number';
      defaultValue = firstWidget;
    } else if (typeof firstWidget === 'boolean') {
      inputType = 'checkbox';
      defaultValue = firstWidget;
    } else if (typeof firstWidget === 'string') {
      inputType = 'text';
      defaultValue = firstWidget;
    }

    const title = node._meta?.title || node.title || `param_${++extraIndex}`;
    const id = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    extraInputs.push({
      id,
      type: inputType,
      label: title,
      default: defaultValue,
      options: [],
    });
    detectedNodes.extras.push({ nodeId, classType: 'PrimitiveNode', title, defaultValue });
    mappedNodeIds.add(nodeId);
  }

  const workflow = {
    name: suggestedName,
    hidden: true,
    options: {
      type: workflowType,
      autocomplete: false,
      inputImages: imageCount,
      inputAudios: audioCount,
      optionalPrompt: false,
      nameRequired: false,
      orientation: 'portrait',
      extraInputs,
    },
    preGenerationTasks: [],
    postGenerationTasks: [],
    replace,
  };

  return { workflow, detectedNodes };
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Retrieve a single workflow by name from comfyui-workflows.json.
 *
 * @param {string} name
 * @returns {Object|null} The workflow object or null if not found.
 */
export function getWorkflowByName(name) {
  const data = readWorkflowsFile();
  return data.workflows.find(w => w.name === name) || null;
}

/**
 * List all workflow names (including hidden ones).
 *
 * @returns {string[]}
 */
export function listWorkflowNames() {
  const data = readWorkflowsFile();
  return data.workflows.map(w => w.name);
}

/**
 * List all workflows (including hidden) as lightweight summaries.
 *
 * @returns {{ name: string, hidden: boolean }[]}
 */
export function listWorkflowSummaries() {
  const data = readWorkflowsFile();
  return data.workflows.map(({ name, hidden, options }) => ({ name, hidden: !!hidden, type: options?.type }));
}

/**
 * Save (upsert) a workflow configuration.
 * Updates an existing entry by name, or appends a new one.
 *
 * @param {Object} workflowData - Full workflow object (must include `name` and `base`).
 * @returns {{ success: boolean, workflow: Object, errors: string[] }}
 */
export function saveWorkflow(workflowData) {
  const errors = validateWorkflow(workflowData);
  if (errors.length > 0) {
    return { success: false, workflow: null, errors };
  }

  const data = readWorkflowsFile();
  const existingIndex = data.workflows.findIndex(w => w.name === workflowData.name);

  if (existingIndex !== -1) {
    data.workflows[existingIndex] = workflowData;
  } else {
    data.workflows.push(workflowData);
  }

  writeWorkflowsFile(data);
  return { success: true, workflow: workflowData, errors: [] };
}

/**
 * Delete a workflow by name and optionally remove its associated base JSON file.
 *
 * @param {string} name
 * @param {boolean} [deleteBaseFile=false]
 * @returns {{ success: boolean, error?: string }}
 */
export function deleteWorkflow(name, deleteBaseFile = false) {
  const data = readWorkflowsFile();
  const index = data.workflows.findIndex(w => w.name === name);

  if (index === -1) {
    return { success: false, error: `Workflow "${name}" not found` };
  }

  const [removed] = data.workflows.splice(index, 1);

  if (deleteBaseFile && removed.base) {
    const basePath = path.join(COMFYUI_WORKFLOWS_DIR, removed.base);
    if (fs.existsSync(basePath)) {
      fs.unlinkSync(basePath);
    }
  }

  writeWorkflowsFile(data);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a workflow object.
 * Returns an array of error messages (empty = valid).
 *
 * @param {Object} workflowData
 * @returns {string[]}
 */
export function validateWorkflow(workflowData) {
  const errors = [];

  if (!workflowData.name || workflowData.name.trim() === '') {
    errors.push('Workflow name is required');
  }

  if (!workflowData.options?.type) {
    errors.push('Workflow type is required');
  }

  if (!workflowData.base) {
    errors.push('Base workflow file is required');
  } else {
    const basePath = path.join(COMFYUI_WORKFLOWS_DIR, workflowData.base);
    if (!fs.existsSync(basePath)) {
      errors.push(`Base workflow file "${workflowData.base}" not found in server/resource/workflows/`);
    }
  }

  const replace = workflowData.replace || [];

  const hasPrompt = replace.some(r => r.from === 'prompt' || r.from === 'enhancedPrompt' || r.from?.startsWith('prompt'));
  const hasSeed   = replace.some(r => r.from === 'seed');
  const hasOutput = replace.some(r => r.from === 'saveImagePath' || r.from === 'saveAudioPath');

  if (!hasPrompt)  errors.push('Missing required prompt binding in replace mappings');
  if (!hasSeed)    errors.push('Missing required seed binding in replace mappings');
  if (!hasOutput)  errors.push('Missing required output path binding (saveImagePath or saveAudioPath)');

  return errors;
}

/**
 * Compute validation errors for a workflow without failing – useful for the
 * frontend to determine why the Save button is disabled.
 *
 * @param {Object} workflowData
 * @returns {string[]}
 */
export { validateWorkflow as getValidationErrors };
