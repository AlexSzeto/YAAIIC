/**
 * Processor registry – maps process names (as they appear in
 * `comfyui-workflows.json`) to their handler functions.
 *
 * Each handler has the signature:
 *   (parameters, generationData, context) => Promise<void>
 *
 * New processors can be added here by importing the handler and registering it
 * in the `PROCESS_HANDLERS` map.
 *
 * @module features/generation/processors
 */
import { extractOutputMediaFromTextFile } from './extract-output-media.mjs';
import { crossfadeVideoFrames } from './crossfade.mjs';
import { crossfadeAudioClip } from './crossfade-audio.mjs';
import { extractOutputTexts } from './extract-output-texts.mjs';
import { executeWorkflow } from './execute-workflow.mjs';

/** @type {Record<string, (params, genData, ctx) => Promise<void>>} */
export const PROCESS_HANDLERS = {
  extractOutputMediaFromTextFile,
  crossfadeVideoFrames,
  crossfadeAudioClip,
  extractOutputTexts,
  executeWorkflow,
};
