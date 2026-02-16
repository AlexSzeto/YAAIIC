/**
 * ComfyUI Client – wraps all HTTP / WebSocket communication with ComfyUI.
 *
 * This module is the single point of contact with the ComfyUI backend.
 * It consolidates:
 *   - API-path initialisation
 *   - File upload (image & audio)
 *   - Prompt submission helpers
 *   - VRAM / memory management
 *   - Prompt-status polling
 *   - WebSocket re-exports (CLIENT_ID, promptExecutionState, connectToComfyUI)
 *   - Important-node-type list (used for progress-step calculation)
 *
 * Other generation-domain modules should import from here rather than
 * reaching into generate.mjs or comfyui-websocket.mjs directly.
 *
 * @module features/generation/comfy-client
 */
import FormData from 'form-data';
import https from 'https';
import http from 'http';

// Re-export WebSocket-layer exports so consumers only need this module.
export { CLIENT_ID, promptExecutionState, connectToComfyUI } from '../../comfyui-websocket.mjs';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let comfyUIAPIPath = null;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Store the ComfyUI API base URL (e.g. `http://127.0.0.1:8188`).
 * Must be called once at startup before any other function in this module.
 *
 * @param {string} apiPath
 */
export function initialize(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('ComfyUI client initialized with API path:', apiPath);
}

/**
 * Return the stored API base URL.
 * @returns {string|null}
 */
export function getApiPath() {
  return comfyUIAPIPath;
}

// ---------------------------------------------------------------------------
// Important node types (used by progress-step calculation)
// ---------------------------------------------------------------------------

/**
 * Node class_types in a ComfyUI workflow that represent substantial work
 * (samplers, VAE ops, etc.).  Used to estimate total progress steps.
 */
export const IMPORTANT_NODE_TYPES = [
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
// File upload
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to ComfyUI's storage.
 *
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @param {'image'|'audio'} [fileType='image']
 * @param {'input'|'output'|'temp'} [storageType='input']
 * @param {boolean} [overwrite=false]
 * @returns {Promise<{ success: boolean, filename: string, type: string, response: string }>}
 */
export async function uploadFile(fileBuffer, filename, fileType = 'image', storageType = 'input', overwrite = false) {
  if (!comfyUIAPIPath) {
    throw new Error('ComfyUI client not initialized – call initialize() first');
  }

  return new Promise((resolve, reject) => {
    try {
      const formData = new FormData();

      // Determine content type from file type / extension
      let contentType;
      if (fileType === 'audio') {
        const ext = filename.split('.').pop().toLowerCase();
        contentType = ext === 'mp3' ? 'audio/mpeg'
          : ext === 'ogg' ? 'audio/ogg'
          : ext === 'wav' ? 'audio/wav'
          : ext === 'flac' ? 'audio/flac'
          : 'audio/mpeg';
      } else {
        contentType = 'image/png';
      }

      // ComfyUI uses the 'image' field and /upload/image for ALL file types
      formData.append('image', fileBuffer, { filename, contentType });
      formData.append('type', storageType);
      formData.append('overwrite', overwrite.toString().toLowerCase());

      console.log(`Uploading ${fileType} to ComfyUI: ${filename} (type: ${storageType})`);

      const url = new URL(`${comfyUIAPIPath}/upload/image`);
      const httpModule = url.protocol === 'https:' ? https : http;

      const req = httpModule.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: formData.getHeaders()
      }, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`Successfully uploaded ${filename} to ComfyUI:`, responseData);
              resolve({ success: true, filename, type: fileType, response: responseData });
            } else {
              reject(new Error(`ComfyUI upload failed: ${res.statusCode} ${res.statusMessage} - ${responseData}`));
            }
          } catch (endError) {
            reject(new Error(`Failed to process upload response for ${filename}: ${endError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed for ${filename}: ${error.message}`));
      });

      try {
        formData.pipe(req);
      } catch (pipeError) {
        reject(new Error(`Failed to send upload data for ${filename}: ${pipeError.message}`));
      }
    } catch (error) {
      reject(new Error(`Upload failed for ${filename}: ${error.message}`));
    }
  });
}

// ---------------------------------------------------------------------------
// Memory management
// ---------------------------------------------------------------------------

/**
 * Ask ComfyUI to unload models and free VRAM.
 */
export async function freeMemory() {
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

// ---------------------------------------------------------------------------
// Prompt status polling
// ---------------------------------------------------------------------------

/**
 * Poll the ComfyUI `/history` endpoint until the given prompt completes or
 * errors, with a configurable timeout.
 *
 * @param {string} promptId
 * @param {number} [maxAttempts=1800]
 * @param {number} [intervalMs=1000]
 * @returns {Promise<{ completed: boolean, error?: boolean, data: Object }>}
 */
export async function checkPromptStatus(promptId, maxAttempts = 1800, intervalMs = 1000) {
  if (!comfyUIAPIPath) {
    throw new Error('ComfyUI client not initialized – call initialize() first');
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
