/**
 * ComfyUI Node Type to Human-Readable Step Name Mappings
 * 
 * This module contains application-specific mappings for ComfyUI node types
 * to user-friendly progress step names.
 */

/**
 * Map ComfyUI node types to human-readable step names
 */
export const NODE_STEP_NAMES = {
  'CheckpointLoaderSimple': 'Loading model...',
  'LoraLoaderModelOnly': 'Loading LoRA...',
  'CLIPTextEncode': 'Encoding prompt...',
  'EmptyLatentImage': 'Preparing canvas...',
  'EmptySD3LatentImage': 'Preparing canvas...',
  'FluxGuidance': 'Configuring guidance...',
  'KSampler': 'Generating latent data...',
  'VAEEncode': 'Encoding data...',
  'VAEDecode': 'Decoding data...',
  'VAEEncodeForInpaint': 'Encoding for inpaint...',
  'LoadImage': 'Loading image...',
  'LoadImageMask': 'Loading mask...',
  'JWImageSaveToPath': 'Saving image...',
  'SaveImage': 'Saving image...',
  'JWAudioSaveToPath': 'Saving audio...'
};

/**
 * Get human-readable step name from node class type
 * @param {string} nodeType - ComfyUI node class type
 * @returns {string} - Human-readable step name
 */
export function getStepName(nodeType) {
  return NODE_STEP_NAMES[nodeType] || 'Processing...';
}
