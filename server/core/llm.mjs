import fs from 'fs';
import path from 'path';
import { getOllamaAPIPath, getOllamaUseCPU } from './service-manager.mjs';

// Track the last used model to manage VRAM
let lastUsedModel = null;

/**
 * Reset the sent-prompt.json log file at the start of a task
 */
export function resetPromptLog() {
  try {
    const logsDir = path.join(process.cwd(), 'server', 'logs');
    const sentPromptPath = path.join(logsDir, 'sent-prompt.json');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Clear or create sent-prompt.json with empty array
    fs.writeFileSync(sentPromptPath, JSON.stringify([], null, 2), 'utf-8');
  } catch (error) {
    console.error('Error resetting prompt log:', error);
  }
}

/**
 * Log a prompt to sent-prompt.json
 * @param {Object} logEntry - The log entry to append
 */
function logPromptToFile(logEntry) {
  try {
    const sentPromptPath = path.join(process.cwd(), 'server', 'logs', 'sent-prompt.json');
    
    // Check if file exists, if not create it with empty array
    let logs = [];
    if (fs.existsSync(sentPromptPath)) {
      const content = fs.readFileSync(sentPromptPath, 'utf-8');
      logs = JSON.parse(content);
    }
    
    // Append the new log entry
    logs.push(logEntry);
    
    // Write back to file
    fs.writeFileSync(sentPromptPath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error logging prompt to file:', error);
  }
}

/**
 * Encode image file to base64 string
 * @param {string} imagePath - Path to the image file
 * @returns {string} Base64 encoded image
 */
export function encodeImageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to read image file: ${error.message}`);
  }
}

/**
 * Unload an Ollama model to free VRAM
 * @param {string} modelName - Name of the model to unload
 */
async function unloadOllamaModel(modelName) {
  try {
    const ollamaAPIPath = getOllamaAPIPath();
    console.log(`Unloading Ollama model: ${modelName}...`);
    
    // Send request with keep_alive: 0 to unload the model immediately
    const response = await fetch(`${ollamaAPIPath}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        keep_alive: 0
      })
    });

    if (!response.ok) {
      console.warn(`Failed to unload model ${modelName}: ${response.status} ${response.statusText}`);
    } else {
      console.log(`Model ${modelName} unloaded successfully`);
    }
  } catch (error) {
    console.error(`Error unloading model ${modelName}:`, error);
  }
}

/**
 * Send a text prompt to the language model via Ollama
 * @param {string} prompt - Text prompt to send to the model
 * @param {string} model - Model to use for generation (default: 'gemma3:4b')
 * @param {string} to - Optional field name where result will be stored (for logging)
 * @returns {Promise<string>} Generated text response
 */
export async function sendTextPrompt(prompt, model = 'gemma3:4b', to = null) {
  try {
    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    // Get Ollama API path from services
    const ollamaAPIPath = getOllamaAPIPath();

    // Prepare the request payload
    const payload = {
      model,
      prompt,
      stream: false
    };

    // Add CPU-only option if configured
    const useCPU = getOllamaUseCPU();
    if (useCPU) {
      payload.options = {
        num_gpu: 0
      };
      console.log('Forcing CPU-only mode for Ollama (num_gpu: 0)');
    }



    // Check if model has changed and unload previous model if needed
    if (lastUsedModel && lastUsedModel !== model) {
      console.log(`Model changed from ${lastUsedModel} to ${model}. Unloading previous model...`);
      // Don't await this to avoid delaying the current request? 
      // Actually, we should probably await to ensure VRAM is freed before loading new model if VRAM is tight.
      await unloadOllamaModel(lastUsedModel);
    }
    
    // Update last used model
    lastUsedModel = model;

    console.log('Sending text prompt to model...');

    // Make request to Ollama API
    const response = await fetch(`${ollamaAPIPath}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Extract the response text
    if (result.response) {
      console.log('Text generation completed successfully');
      const responseText = result.response.trim();
      
      // Log the prompt to sent-prompt.json
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'text',
        model,
        prompt,
        response: responseText
      };
      if (to) {
        logEntry.to = to;
      }
      logPromptToFile(logEntry);
      
      return responseText;
    } else {
      throw new Error('No response received from model');
    }

  } catch (error) {
    console.error('Error in sendTextPrompt:', error);
    throw new Error(`Failed to generate text: ${error.message}`);
  }
}

/**
 * Analyze an image using the LLaVA model via Ollama
 * @param {string} imagePath - Path to the image file to analyze
 * @param {string} prompt - Text prompt to guide the analysis
 * @param {string} model - Model to use for analysis (default: 'llava')
 * @param {string} to - Optional field name where result will be stored (for logging)
 * @returns {Promise<string>} Description of what's in the image
 */
export async function sendImagePrompt(imagePath, prompt, model = 'llava', to = null) {
  try {
    // Validate image path
    if (!imagePath || typeof imagePath !== 'string') {
      throw new Error('Image path is required and must be a string');
    }

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Get Ollama API path from services
    const ollamaAPIPath = getOllamaAPIPath();

    // Encode image to base64
    console.log(`Encoding image: ${imagePath}`);
    const encodedImage = encodeImageToBase64(imagePath);

    // TODO: move these constants into the config json file
    // const imageAnalysisModel = 'llava';
    // const imageAnalysisModel = 'gemma3:4b';
    // const imageAnalysisModel = 'hf.co/bartowski/SicariusSicariiStuff_X-Ray_Alpha-GGUF:Q4_K_M';

    // Prepare the request payload
    const payload = {
      model,
      prompt,
      images: [encodedImage],
      stream: false
    };

    // Add CPU-only option if configured
    const useCPU = getOllamaUseCPU();
    if (useCPU) {
      payload.options = {
        num_gpu: 0
      };
      console.log('Forcing CPU-only mode for Ollama (num_gpu: 0)');
    }



    // Check if model has changed and unload previous model if needed
    if (lastUsedModel && lastUsedModel !== model) {
      console.log(`Model changed from ${lastUsedModel} to ${model}. Unloading previous model...`);
      await unloadOllamaModel(lastUsedModel);
    }
    
    // Update last used model
    lastUsedModel = model;

    console.log(`Sending image analysis request to ${model}...`);

    // Make request to Ollama API
    const response = await fetch(`${ollamaAPIPath}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(result);

    // Extract the response text
    if (result.response) {
      console.log('Image analysis completed successfully');
      const responseText = result.response.trim();
      
      // Log the prompt to sent-prompt.json
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'image',
        model,
        imagePath,
        prompt,
        response: responseText
      };
      if (to) {
        logEntry.to = to;
      }
      logPromptToFile(logEntry);
      
      return responseText;
    } else {
      throw new Error(`No response received from ${model}`);
    }

  } catch (error) {
    console.error('Error in decodeImage:', error);
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
}

/**
 * Fetch the list of models currently installed in Ollama.
 * @returns {Promise<string[]>} Array of model name strings (e.g. ["llama2:latest", "gemma3:4b"])
 */
export async function listOllamaModels() {
  const ollamaAPIPath = getOllamaAPIPath();
  const response = await fetch(`${ollamaAPIPath}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama API request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return (data.models || []).map(m => m.name);
}

/**
 * Modify data object with a prompt-based generation task
 * @param {Object} promptData - Configuration for the prompt task
 * @param {string} promptData.model - LLM model to use (optional if template is provided)
 * @param {string} promptData.template - Template string with placeholders (alternative to prompt)
 * @param {string} promptData.prompt - Direct prompt text
 * @param {string} promptData.to - Target field to store the result
 * @param {string} promptData.imagePath - Field name containing the image path (for image prompts)
 * @param {Object} dataObject - Object containing data fields
 * @returns {Promise<Object>} Modified data object
 */
export async function modifyDataWithPrompt(promptData, dataObject) {
  try {
    const { model, template, prompt, from, to, imagePath } = promptData;
    
    // Validate that 'to' field is provided
    if (!to) {
      throw new Error('Generation task missing required "to" field');
    }
    
    // Validate that at least one source is provided
    if (!from && !template && !prompt) {
      throw new Error(`Generation task for "${to}" must have one of: "from", "template", or "prompt"`);
    }
    
    // Handle "from" parameter - copy value from one field to another
    if (from) {
      const sourceValue = dataObject[from];
      if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
        console.log(`Copying value from ${from} to ${to}: ${sourceValue}`);
        dataObject[to] = sourceValue;
      } else {
        throw new Error(`Generation task for "${to}": source field "${from}" not found, empty, or undefined in dataObject`);
      }
      return dataObject;
    }
    
    // Extract prompt text from promptData.prompt or promptData.template
    let processedPrompt = prompt || template;
    
    // Replace double curly brace placeholders (e.g., {{description}}) with values from dataObject
    const bracketPattern = /\{\{(\w+)\}\}/g;
    const missingKeys = [];
    processedPrompt = processedPrompt.replace(bracketPattern, (match, key) => {
      if (dataObject[key] === undefined || dataObject[key] === null || dataObject[key] === '') {
        missingKeys.push(key);
        return match; // Keep the placeholder if value is missing
      }
      return dataObject[key];
    });
    
    // Throw error if any required bracket replacements are missing
    if (missingKeys.length > 0) {
      throw new Error(`Generation task for "${to}": missing required data for placeholders: {{${missingKeys.join('}}, {{')}}}`);
    }
    
    // If template is present instead of model, just do string replacement
    if (template) {
      console.log(`Processing template for ${to}: ${processedPrompt}`);
      dataObject[to] = processedPrompt;
      console.log(`Stored template result in ${to}: ${processedPrompt}`);
      return dataObject;
    }
    
    // Validate model is provided for prompt-based generation
    if (!model) {
      throw new Error(`Generation task for "${to}": "model" is required when using "prompt"`);
    }
    
    console.log(`Processing prompt for ${to} with model ${model}`);
    console.log(`Prompt: ${processedPrompt}`);
    
    let response;
    
    // If imagePath is specified in promptData, resolve the actual path from dataObject
    if (imagePath) {
      const actualImagePath = dataObject[imagePath];
      if (!actualImagePath) {
        throw new Error(`Generation task for "${to}": image path field '${imagePath}' not found in dataObject`);
      }
      console.log(`Using image path: ${actualImagePath}`);
      response = await sendImagePrompt(actualImagePath, processedPrompt, model, to);
    } else {
      response = await sendTextPrompt(processedPrompt, model, to);
    }
    
    // Validate that response was received
    if (!response || response.trim() === '') {
      throw new Error(`Generation task for "${to}": received empty or invalid response from model "${model}"`);
    }
    
    // Store the response in dataObject[promptData.to]
    dataObject[to] = response;
    console.log(`Stored response in ${to}: ${response}`);
    
    return dataObject;
  } catch (error) {
    console.error(`Error in modifyDataWithPrompt:`, error);
    throw error;
  }
}
