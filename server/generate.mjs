import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { getComfyUIAPIPath } from './services.mjs';
import { sendImagePrompt, sendTextPrompt } from './llm.mjs';
import { setObjectPathValue } from './util.mjs';

// Function to add image data entry (will be set by server.mjs)
let addImageDataEntry = null;

export function setAddImageDataEntry(func) {
  addImageDataEntry = func;
}

// Function to upload image to ComfyUI
export async function uploadImageToComfyUI(imageBuffer, filename, imageType = "input", overwrite = false) {
  const comfyuiAPIPath = getComfyUIAPIPath();
  
  return new Promise((resolve, reject) => {
    try {
      // Create FormData using the form-data package
      const formData = new FormData();
      
      // Append the image buffer as a stream
      formData.append('image', imageBuffer, {
        filename: filename,
        contentType: 'image/png'
      });
      formData.append('type', imageType);
      formData.append('overwrite', overwrite.toString().toLowerCase());
      
      console.log(`Uploading image to ComfyUI: ${filename} (type: ${imageType})`);
      
      // Parse the URL to determine if it's HTTP or HTTPS
      const url = new URL(`${comfyuiAPIPath}/upload/image`);
      const httpModule = url.protocol === 'https:' ? https : http;
      
      // Create the request
      const req = httpModule.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: formData.getHeaders()
      }, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Successfully uploaded ${filename} to ComfyUI:`, responseData);
            resolve({
              success: true,
              filename: filename,
              type: imageType,
              response: responseData
            });
          } else {
            reject(new Error(`ComfyUI upload failed: ${res.statusCode} ${res.statusMessage} - ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed for ${filename}: ${error.message}`));
      });
      
      // Pipe the form data to the request
      formData.pipe(req);
      
    } catch (error) {
      console.error(`Failed to upload ${filename} to ComfyUI:`, error);
      reject(new Error(`Upload failed for ${filename}: ${error.message}`));
    }
  });
}

// Reusable function to check ComfyUI prompt status
export async function checkPromptStatus(promptId, maxAttempts = 1800, intervalMs = 1000) {
  const comfyuiAPIPath = getComfyUIAPIPath();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${comfyuiAPIPath}/history/${promptId}`);
      
      if (!response.ok) {
        throw new Error(`History request failed: ${response.status}`);
      }
      
      const history = await response.json();
      
      // Check if the prompt exists in history
      if (history[promptId]) {
        const promptData = history[promptId];
        
        // Check if the prompt is complete (has outputs)
        if (promptData.status && promptData.status.completed) {
          console.log(`Prompt ${promptId} completed successfully`);
          return { completed: true, data: promptData };
        }
        
        // Check if there's an error
        if (promptData.status && promptData.status.status_str === 'error') {
          console.log(`Prompt ${promptId} failed with error`);
          return { completed: false, error: true, data: promptData };
        }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
    } catch (error) {
      console.error(`Error checking prompt status (attempt ${attempt + 1}):`, error);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  throw new Error(`Prompt ${promptId} did not complete within ${maxAttempts * intervalMs / 1000} seconds`);
}

// Main image generation handler
export async function handleImageGeneration(req, res, workflowConfig) {
  try {
    const { base: workflowBasePath, replace: modifications, describePrompt, namePromptPrefix } = workflowConfig;
    const { prompt, seed, savePath, workflow, imagePath, maskPath, inpaint, inpaintArea } = req.body;
    let { name } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt parameter is required and must be a string' });
    }

    console.log('Received generation request with prompt:', prompt);
    console.log('Using workflow:', workflowBasePath);
    console.log('Using seed:', seed);
    console.log('Using savePath:', savePath);
    console.log('Received name:', name);
    
    // Log inpaint-specific parameters for debugging purposes
    if (inpaint) {
      console.log('Inpaint operation detected');
      console.log('Using imagePath:', imagePath);
      console.log('Using maskPath:', maskPath);
      if (inpaintArea) {
        console.log('Using inpaintArea:', inpaintArea);
      }
    }

    // Generate name if not provided and namePromptPrefix is available
    if ((!name || name.trim() === '') && namePromptPrefix) {
      try {
        console.log('Generating name using LLM...');
        const namePrompt = namePromptPrefix + prompt;
        name = await sendTextPrompt(namePrompt);
        console.log('Generated name:', name);
      } catch (error) {
        console.warn('Failed to generate name:', error.message);
        name = 'Generated Character'; // Fallback name
      }
    }

    // Load the ComfyUI workflow
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    // Fix Windows path issue by removing leading slash
    const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
    const workflowPath = path.join(actualDirname, 'resource', workflowBasePath);
    let workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    
    // Apply dynamic modifications based on the modifications array
    if (modifications && Array.isArray(modifications)) {
      modifications.forEach(mod => {
        const { from, to, prefix, postfix } = mod;
        console.log(`Modifying: ${from} to ${to.join(',')} ${prefix ? 'with prefix ' + prefix : ''} ${postfix ? 'and postfix ' + postfix : ''}`);        
        let value = req.body[from];
        if(prefix) value = `${prefix} ${value}`;
        if(postfix) value = `${value} ${postfix}`;
        console.log(` - New value: ${value}`);

        if(value && to && Array.isArray(to)) {
          workflowData = setObjectPathValue(workflowData, to, value);
        }
      });
    }

    // Get ComfyUI API path from services
    const comfyuiAPIPath = getComfyUIAPIPath();

    // Send request to ComfyUI
    const comfyResponse = await fetch(`${comfyuiAPIPath}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflowData,
        client_id: 'imagen-server'
      })
    });

    if (!comfyResponse.ok) {
      throw new Error(`ComfyUI request failed: ${comfyResponse.status} ${comfyResponse.statusText}`);
    }

    const comfyResult = await comfyResponse.json();
    console.log('ComfyUI response:', comfyResult);

    // Extract prompt_id from ComfyUI response
    const promptId = comfyResult.prompt_id;
    if (!promptId) {
      throw new Error('No prompt_id received from ComfyUI');
    }

    console.log(`Waiting for prompt ${promptId} to complete...`);
    
    // Wait for the prompt to complete
    const statusResult = await checkPromptStatus(promptId);
    
    if (statusResult.error) {
      throw new Error('ComfyUI generation failed');
    }

    // Check if the file was created
    if (!fs.existsSync(savePath)) {
      throw new Error(`Generated image file not found at: ${savePath}`);
    }

    console.log(`Image generated successfully, analyzing with ollama...`);

    // Analyze the generated image with ollama
    let description = '';
    try {
      // Only analyze if describePrompt is provided in workflow config
      if (describePrompt) {
        description = await sendImagePrompt(savePath, describePrompt);
        console.log('Image analysis completed:', description);
      } else {
        console.log('No describePrompt provided in workflow config, skipping image analysis');
        description = 'Image analysis not configured for this workflow';
      }
    } catch (error) {
      console.warn('Failed to analyze image with ollama:', error.message);
      description = 'Image analysis unavailable';
    }

    // Return the image URL path (relative to /image/ endpoint)
    const filename = path.basename(savePath);
    const imageUrl = `/image/${filename}`;

    // Save image data to database
    let uid = null;
    if (addImageDataEntry) {
      const imageDataEntry = {
        prompt: prompt,
        seed: seed,
        imageUrl: imageUrl,
        name: name,
        description: description,
        workflow: workflow,
        inpaint: inpaint || false,
        inpaintArea: inpaintArea || null
      };
      addImageDataEntry(imageDataEntry);
      uid = imageDataEntry.uid; // Capture the UID after it's been added by addImageDataEntry
      console.log('Image data entry saved to database with UID:', uid);
    }

    res.json({ 
      success: true, 
      message: 'Image generated and analyzed successfully',
      data: {
        imageUrl: imageUrl,
        description: description,
        prompt: prompt,
        seed: seed,
        name: name,
        workflow: workflow,
        inpaint: inpaint || false,
        inpaintArea: inpaintArea || null,
        uid: uid
      }
    });

  } catch (error) {
    console.error('Error in image generation:', error);
    res.status(500).json({ 
      error: 'Failed to process generation request',
      details: error.message 
    });
  }
}
