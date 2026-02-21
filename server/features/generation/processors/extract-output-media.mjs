/**
 * extract-output-media – Post-generation processor that reads an output file
 * path from a ComfyUI text-file node and copies the corresponding media file
 * to the final save path.
 *
 * @module features/generation/processors/extract-output-media
 */
import fs from 'fs';
import path from 'path';
import { readOutputPathFromTextFile } from '../../../util.mjs';

/**
 * @param {Object} parameters      - Task parameters from the workflow config.
 * @param {string} parameters.filename - Name of the text file that contains
 *   the real output path written by ComfyUI.
 * @param {Object} generationData  - Mutable generation context (contains
 *   `imageFormat`).
 * @param {Object} context         - Execution context.
 * @param {string} context.storagePath - Path to the ComfyUI storage folder.
 * @param {string} context.saveImagePath    - Destination path for the final file.
 */
export async function extractOutputMediaFromTextFile(parameters, generationData, context) {
  const { filename } = parameters;
  if (!filename) {
    throw new Error('extractOutputMediaFromTextFile requires "filename" parameter');
  }

  console.log(`[Process] Extracting output path from text file: ${filename}`);

  const { storagePath, saveImagePath } = context;

  // Read the output path from the text file
  let actualOutputPath = readOutputPathFromTextFile(filename, storagePath);
  console.log(`[Process] Extracted output path: ${actualOutputPath}`);

  // Replace extension based on format parameter if provided
  if (generationData.imageFormat) {
    const formatExtension = generationData.imageFormat;
    const extractedDir = path.dirname(actualOutputPath);
    const extractedBasename = path.basename(actualOutputPath, path.extname(actualOutputPath));
    actualOutputPath = path.join(extractedDir, `${extractedBasename}.${formatExtension}`);
    console.log(`[Process] Modified output path based on format: ${actualOutputPath}`);
  } else {
    throw new Error('imageFormat is required to determine output file extension');
  }

  // Copy the file from the extracted path to saveImagePath
  if (fs.existsSync(actualOutputPath)) {
    fs.copyFileSync(actualOutputPath, saveImagePath);
    console.log(`[Process] Successfully copied file from ${actualOutputPath} to ${saveImagePath}`);
  } else {
    throw new Error(`Output file not found at extracted path: ${actualOutputPath}`);
  }
}
