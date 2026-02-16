/**
 * crossfade – Post-generation processor that applies a crossfade blend to the
 * first and last frames of a video file, creating a seamless loop.
 *
 * @module features/generation/processors/crossfade
 */
import fs from 'fs';
import { createCrossFade } from '../../../image-utils.mjs';

/**
 * @param {Object} parameters              - Task parameters.
 * @param {number} [parameters.blendFrames=10] - Number of frames to blend.
 * @param {Object} _generationData         - Unused (kept for uniform signature).
 * @param {Object} context                 - Execution context.
 * @param {string} context.savePath        - Path to the video file to process.
 */
export async function crossfadeVideoFrames(parameters, _generationData, context) {
  const { blendFrames = 10 } = parameters;

  console.log(`[Process] Applying loop fade blending with ${blendFrames} frames...`);

  const { savePath } = context;

  if (!fs.existsSync(savePath)) {
    throw new Error(`Cannot apply crossfade: file not found at ${savePath}`);
  }

  await createCrossFade(savePath, blendFrames);
  console.log(`[Process] Successfully applied crossfade blending`);
}
