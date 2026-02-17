/**
 * Export Router
 * Handles export-related HTTP endpoints
 */

import express from 'express';
import { loadConfig } from '../../core/config.mjs';
import { findMediaByUid } from '../../core/database.mjs';
import { STORAGE_DIR } from '../../core/paths.mjs';
import { handleSaveExport, handlePostExport } from './service.mjs';

const router = express.Router();

/**
 * GET /exports
 * Returns list of export configurations from config
 * Query params:
 *   - type: (optional) Filter exports by type
 */
router.get('/exports', (req, res) => {
  try {
    const { type } = req.query;
    const config = loadConfig();
    
    // Get exports from config
    const exports = config.exports || [];
    
    // Filter by type if provided
    let filteredExports = exports;
    if (type) {
      filteredExports = exports.filter(exp => 
        exp.types && exp.types.includes(type)
      );
    }
    
    // Return only id, name, and types for client display
    const exportList = filteredExports.map(exp => ({
      id: exp.id,
      name: exp.name,
      types: exp.types
    }));
    
    console.log(`Exports endpoint called with type="${type || 'all'}", returning ${exportList.length} exports`);
    res.json(exportList);
    
  } catch (error) {
    console.error('Error in exports endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve exports' });
  }
});

/**
 * POST /export
 * Executes an export operation for a specific media item
 * Body:
 *   - exportId: ID of the export configuration to use
 *   - mediaId: ID of the media item to export
 */
router.post('/export', async (req, res) => {
  try {
    const { exportId, mediaId } = req.body;
    const config = loadConfig();
    
    // Validate required fields
    if (!exportId) {
      return res.status(400).json({ error: 'Missing required field: exportId' });
    }
    if (!mediaId) {
      return res.status(400).json({ error: 'Missing required field: mediaId' });
    }
    
    // Find export configuration
    const exports = config.exports || [];
    const exportConfig = exports.find(exp => exp.id === exportId);
    
    if (!exportConfig) {
      return res.status(404).json({ error: `Export configuration not found: ${exportId}` });
    }
    
    // Find media data
    const uid = parseInt(mediaId);
    const mediaData = findMediaByUid(uid);
    
    if (!mediaData) {
      return res.status(404).json({ error: `Media not found with id: ${mediaId}` });
    }
    
    console.log(`Export request: exportId="${exportId}", mediaId=${mediaId}`);
    
    // Handle export based on type
    let result;
    if (exportConfig.exportType === 'save') {
      result = await handleSaveExport(exportConfig, mediaData, STORAGE_DIR);
    } else if (exportConfig.exportType === 'post') {
      result = await handlePostExport(exportConfig, mediaData, STORAGE_DIR);
    } else {
      return res.status(400).json({ error: `Unknown export type: ${exportConfig.exportType}` });
    }
    
    if (result.success) {
      console.log(`Export successful: ${exportId}`);
      res.json({ success: true, ...result });
    } else {
      console.error(`Export failed: ${result.error}`);
      res.status(500).json({ success: false, error: result.error });
    }
    
  } catch (error) {
    console.error('Error in export endpoint:', error);
    res.status(500).json({ error: 'Failed to process export request', details: error.message });
  }
});

export default router;
