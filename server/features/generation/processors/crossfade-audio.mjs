import fs from 'fs';
import { createAudioCrossFade } from '../../../audio-utils.mjs';

/**
 * Post-generation processor that makes AI-generated audio loop seamlessly.
 * Takes the tail of the audio file, applies a crossfade into the head, and
 * trims the tail — producing a loop point that blends naturally.
 *
 * @param {Object} parameters
 * @param {number} [parameters.blendDuration=3] - Seconds of audio to crossfade.
 * @param {Object} generationData
 * @param {string} generationData.saveAudioPath - Path to the generated audio file.
 */
export async function crossfadeAudioClip(parameters, generationData, _context) {
  const { blendDuration = 3 } = parameters;
  const { saveAudioPath } = generationData;

  if (!saveAudioPath) {
    throw new Error('crossfadeAudioClip requires generationData.saveAudioPath');
  }
  if (!fs.existsSync(saveAudioPath)) {
    throw new Error(`Cannot apply audio crossfade: file not found at ${saveAudioPath}`);
  }

  console.log(`[Process] Applying audio crossfade with ${blendDuration}s blend...`);
  await createAudioCrossFade(saveAudioPath, blendDuration);
  console.log(`[Process] Successfully applied audio crossfade`);
}
