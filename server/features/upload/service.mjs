/**
 * Upload Service – file upload logic for the upload domain.
 *
 * Currently delegates to generate.mjs for the heavy lifting (ComfyUI
 * communication, task orchestration, album-cover generation for audio).
 * The full extraction of that logic into this module is planned for Phase 3.
 *
 * The service also owns log-reset side-effects that must run before each
 * upload request is processed.
 *
 * @module features/upload/service
 */
import { handleMediaUpload as _handleMediaUpload, uploadFileToComfyUI as _uploadFileToComfyUI } from '../../generate.mjs';
import { resetPromptLog } from '../../llm.mjs';
import { resetProgressLog } from '../../sse.mjs';

/**
 * Process a media upload (image or audio).
 *
 * Resets logging, delegates to the generate module's upload handler, and
 * returns a task ID for SSE progress tracking.
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

  return _handleMediaUpload(file, workflowsConfig, name);
}

/**
 * Upload a file buffer to ComfyUI's input storage.
 *
 * Thin re-export kept here so that other upload-domain consumers don't need
 * to reach into generate.mjs directly.
 *
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @param {string} [fileType='image']     - 'image' or 'audio'.
 * @param {string} [storageType='input']  - ComfyUI storage folder.
 * @param {boolean} [overwrite=false]
 * @returns {Promise<{ success: boolean, filename: string, type: string, response: string }>}
 */
export const uploadFileToComfyUI = _uploadFileToComfyUI;
