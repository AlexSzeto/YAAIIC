/**
 * Export Module
 * Handles exporting media to folders or external endpoints
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import https from 'https';
import http from 'http';
import { parseTemplate } from './template-utils.mjs';

/**
 * Resolve the absolute file path from a media data object
 * @param {object} mediaData - Media data object with imageUrl or audioUrl
 * @param {string} storageFolder - Path to the storage folder
 * @returns {string|null} Absolute path to the media file, or null if not found
 */
export function resolveMediaPath(mediaData, storageFolder) {
  // Try imageUrl first, then audioUrl
  const mediaUrl = mediaData.imageUrl || mediaData.audioUrl;
  
  if (!mediaUrl) {
    return null;
  }
  
  // Remove /media/ prefix to get filename
  const filename = mediaUrl.replace(/^\/media\//, '');
  
  return path.join(storageFolder, filename);
}

/**
 * Get the file extension from media data based on format properties
 * @param {object} mediaData - Media data object
 * @returns {string} File extension (with leading dot)
 */
function getMediaExtension(mediaData) {
  // Check for explicit format properties
  if (mediaData.imageFormat) {
    return '.' + mediaData.imageFormat;
  }
  if (mediaData.audioFormat) {
    return '.' + mediaData.audioFormat;
  }
  
  // Fall back to extracting from URL
  const mediaUrl = mediaData.imageUrl || mediaData.audioUrl;
  if (mediaUrl) {
    const ext = path.extname(mediaUrl);
    if (ext) return ext;
  }
  
  // Default to png for images
  return '.png';
}

/**
 * Handle export to folder (save type)
 * @param {object} exportConfig - Export configuration
 * @param {object} mediaData - Media data object
 * @param {string} storageFolder - Path to the storage folder
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function handleSaveExport(exportConfig, mediaData, storageFolder) {
  try {
    // Resolve source file path
    const sourcePath = resolveMediaPath(mediaData, storageFolder);
    
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source file not found' };
    }
    
    // Parse folder template
    const destFolder = parseTemplate(exportConfig.folderTemplate, mediaData);
    
    // Parse filename template and add extension
    const extension = getMediaExtension(mediaData);
    const baseFilename = parseTemplate(exportConfig.filenameTemplate, mediaData);
    const filename = baseFilename + extension;
    
    // Full destination path
    const destPath = path.join(destFolder, filename);
    
    // Ensure destination folder exists
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    
    // Copy file
    fs.copyFileSync(sourcePath, destPath);
    
    console.log(`Export saved: ${destPath}`);
    return { success: true, path: destPath };
    
  } catch (error) {
    console.error('Error in handleSaveExport:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle export to endpoint (post type)
 * @param {object} exportConfig - Export configuration
 * @param {object} mediaData - Media data object
 * @param {string} storageFolder - Path to the storage folder
 * @returns {Promise<{success: boolean, response?: any, error?: string}>}
 */
export async function handlePostExport(exportConfig, mediaData, storageFolder) {
  try {
    // Start with a copy of media data
    let exportData = { ...mediaData };
    
    // Get extension for filename generation (needed later)
    const extension = getMediaExtension(mediaData);
    
    // Track files to upload (filename will be set after prepareDataTasks)
    const filesToUpload = [];
    
    // Run prepare data tasks
    if (exportConfig.prepareDataTasks && Array.isArray(exportConfig.prepareDataTasks)) {
      for (const task of exportConfig.prepareDataTasks) {
        if (task.from) {
          // Handle special file references
          if (task.from === 'image_0' || task.from === 'audio_0') {
            // Load file as buffer for upload - filename will be set after prepareDataTasks
            const sourcePath = resolveMediaPath(mediaData, storageFolder);
            if (sourcePath && fs.existsSync(sourcePath)) {
              const fileBuffer = fs.readFileSync(sourcePath);
              filesToUpload.push({
                fieldName: task.to,
                filename: null, // Will be set after filenameTemplate is parsed
                buffer: fileBuffer
              });
              exportData[task.to] = '[FILE]'; // Placeholder for the file
            }
          } else {
            // Copy value from one property to another
            exportData[task.to] = exportData[task.from];
          }
        } else if (task.template) {
          // Parse template and set value
          exportData[task.to] = parseTemplate(task.template, mediaData);
        }
      }
    }
    
    // Calculate filename AFTER prepareDataTasks so template can use any transformed data
    const baseFilename = parseTemplate(exportConfig.filenameTemplate, exportData);
    const filename = baseFilename + extension;
    
    // Update file entries with the calculated filename
    for (const file of filesToUpload) {
      file.filename = filename;
      exportData[file.fieldName] = filename; // Update placeholder with actual filename
    }
    
    // Filter to only sendProperties
    if (exportConfig.sendProperties && Array.isArray(exportConfig.sendProperties)) {
      const filteredData = {};
      for (const prop of exportConfig.sendProperties) {
        if (exportData[prop] !== undefined) {
          filteredData[prop] = exportData[prop];
        }
      }
      exportData = filteredData;
    }
    // === DEBUG: Export payload logging (remove later) ===
    console.log('=== EXPORT DEBUG START ===');
    console.log('Endpoint:', exportConfig.endpoint);
    console.log('Data fields:', Object.keys(exportData));
    console.log('Data payload:', JSON.stringify(exportData, null, 2));
    console.log('Number of blobs:', filesToUpload.length);
    for (const file of filesToUpload) {
      console.log(`  Blob field: "${file.fieldName}", filename: "${file.filename}", size: ${file.buffer.length} bytes`);
    }
    console.log('=== EXPORT DEBUG END ===');
    // === END DEBUG ===
    
    // Send request
    const result = await sendExportRequest(exportConfig.endpoint, exportData, filesToUpload);
    
    console.log(`Export posted to: ${exportConfig.endpoint}`);
    return result;
    
  } catch (error) {
    console.error('Error in handlePostExport:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send export request to endpoint
 * @param {string} endpoint - URL to send to
 * @param {object} data - Data to send
 * @param {Array} files - Files to upload [{fieldName, filename, buffer}]
 * @returns {Promise<{success: boolean, response?: any, error?: string}>}
 */
async function sendExportRequest(endpoint, data, files = []) {
  return new Promise((resolve) => {
    try {
      const url = new URL(endpoint);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      // Create form data for file uploads
      const form = new FormData();
      
      // Add files
      for (const file of files) {
        form.append(file.fieldName, file.buffer, {
          filename: file.filename,
          contentType: 'application/octet-stream'
        });
      }
      
      // Add other data fields (excluding file placeholders)
      const fileFieldNames = files.map(f => f.fieldName);
      for (const [key, value] of Object.entries(data)) {
        if (!fileFieldNames.includes(key)) {
          form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
      }
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: form.getHeaders()
      };
      
      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ 
              success: res.statusCode >= 200 && res.statusCode < 300, 
              response: parsed,
              statusCode: res.statusCode
            });
          } catch {
            resolve({ 
              success: res.statusCode >= 200 && res.statusCode < 300, 
              response: responseData,
              statusCode: res.statusCode
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
      
      form.pipe(req);
      
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}
