/**
 * extract-output-texts – Post-generation processor that reads text content from
 * ComfyUI output text files and assigns each to a property on generationData.
 *
 * @module features/generation/processors/extract-output-texts
 */
import { readOutputPathFromTextFile } from '../../../util.mjs';

/**
 * @param {Object}   parameters            - Task parameters.
 * @param {string[]} parameters.properties - List of property names. Each name
 *   maps to a `{name}.txt` file in the ComfyUI storage folder.
 * @param {Object}   generationData        - Mutable generation context; text
 *   values are written back onto this object.
 * @param {Object}   context               - Execution context.
 * @param {string}   context.storagePath   - Path to the ComfyUI storage folder.
 */
export async function extractOutputTexts(parameters, generationData, context) {
  const { properties } = parameters;
  if (!properties || !Array.isArray(properties)) {
    throw new Error('extractOutputTexts requires "properties" parameter as array');
  }

  console.log(`[Process] Extracting text content from ${properties.length} file(s)...`);

  const { storagePath } = context;

  for (const propertyName of properties) {
    try {
      // Construct the text filename (e.g., "summary" -> "summary.txt")
      const textFilename = `${propertyName}.txt`;
      console.log(`[Process] Extracting text from ${textFilename} to property "${propertyName}"`);

      // Read the text file content
      const textContent = readOutputPathFromTextFile(textFilename, storagePath);

      // Assign the content to generationData
      generationData[propertyName] = textContent;
      console.log(`[Process] Successfully extracted text content: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error(`[Process] Failed to extract text from ${propertyName}.txt:`, error.message);
      throw error; // Fail immediately on error as per spec
    }
  }
}
