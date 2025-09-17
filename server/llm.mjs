import fs from 'fs';
import { getOllamaAPIPath } from './services.mjs';

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
 * Send a text prompt to the language model via Ollama
 * @param {string} prompt - Text prompt to send to the model
 * @param {string} model - Model to use for generation (default: 'gemma3:4b')
 * @returns {Promise<string>} Generated text response
 */
export async function sendTextPrompt(prompt, model = 'gemma3:4b') {
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
      return result.response.trim();
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
 * @param {string} model - Model to use for analysis (default: 'gemma3:4b')
 * @returns {Promise<string>} Description of what's in the image
 */
export async function sendImagePrompt(imagePath, prompt, model = 'gemma3:4b') {
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
      return result.response.trim();
    } else {
      throw new Error(`No response received from ${model}`);
    }

  } catch (error) {
    console.error('Error in decodeImage:', error);
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
}
