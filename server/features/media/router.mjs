/**
 * Media Router – Express routes for the media domain.
 *
 * Every handler is a thin adapter: it extracts request parameters, calls the
 * appropriate service function, and formats the response.  No business logic
 * lives here.
 *
 * @module features/media/router
 */
import { Router } from 'express';
import * as mediaService from './service.mjs';

const router = Router();

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/**
 * GET /tags
 * Returns filtered tags, definitions, category tree, and filter metadata.
 */
router.get('/tags', async (req, res) => {
  try {
    const noCharacters = req.query.noCharacters !== 'false';
    const minLength = parseInt(req.query.minLength) || 4;
    const minUsageCount = parseInt(req.query.minUsageCount) || 100;
    const filterCategories = req.query.categories ? req.query.categories.split(',') : ['0'];

    console.log(`Tags endpoint called with filters: noCharacters=${noCharacters}, minLength=${minLength}, minUsageCount=${minUsageCount}, categories=${filterCategories}`);

    const result = await mediaService.loadTags({ noCharacters, minLength, minUsageCount, filterCategories });

    console.log(`Tags filtered: ${result.tags.length} tags returned after applying filters`);
    console.log(`Tag definitions loaded: ${Object.keys(result.definitions).length} tags with definitions`);

    res.json(result);
  } catch (err) {
    console.error('Error reading tags.csv:', err);
    res.status(500).json({ error: 'Failed to load tags.csv' });
  }
});

/**
 * GET /tag-definitions  (deprecated – redirects to /tags)
 */
router.get('/tag-definitions', (_req, res) => {
  console.log('Tag definitions endpoint called (deprecated - redirecting to /tags)');
  res.redirect(307, '/tags');
});

// ---------------------------------------------------------------------------
// Media data – search / single / edit / delete
// ---------------------------------------------------------------------------

/**
 * GET /media-data
 * Search & filter media entries.
 */
router.get('/media-data', (req, res) => {
  try {
    const query = req.query.query || '';
    const tagsParam = req.query.tags || '';
    const sort = req.query.sort || 'descending';
    const limit = parseInt(req.query.limit) || 10;
    const folderParam = req.query.folder !== undefined ? req.query.folder : undefined;

    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

    console.log(`Image data endpoint called with query="${query}", tags=[${tags.join(', ')}], folder="${folderParam ?? '(current)'}", sort="${sort}", limit=${limit}`);

    const results = mediaService.searchMedia({ query, tags, folder: folderParam, sort, limit });

    console.log(`Returning ${results.length} entries`);
    res.json(results);
  } catch (error) {
    console.error('Error in media-data endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve image data' });
  }
});

/**
 * GET /media-data/:uid
 * Retrieve a single media entry by UID.
 */
router.get('/media-data/:uid', (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    if (isNaN(uid)) {
      return res.status(400).json({ error: 'UID must be a valid number' });
    }

    console.log(`Image data by UID endpoint called with uid=${uid}`);
    const { found, data } = mediaService.getMediaByUid(uid);

    if (!found) {
      console.log(`No image found with UID: ${uid}`);
      return res.status(404).json({ error: `Image with UID ${uid} not found` });
    }

    console.log(`Found image with UID ${uid}: ${data.name || 'unnamed'}`);
    res.json(data);
  } catch (error) {
    console.error('Error in media-data/:uid endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve image data' });
  }
});

/**
 * DELETE /media-data/delete
 * Bulk-delete media entries by UID list.
 */
router.delete('/media-data/delete', (req, res) => {
  try {
    const { uids } = req.body;

    if (!Array.isArray(uids)) {
      return res.status(400).json({ error: 'uids must be an array' });
    }
    if (uids.length === 0) {
      return res.status(400).json({ error: 'uids array cannot be empty' });
    }
    const invalidUids = uids.filter(uid => typeof uid !== 'number' || !Number.isInteger(uid));
    if (invalidUids.length > 0) {
      return res.status(400).json({ error: 'All UIDs must be integers', invalidUids });
    }

    console.log(`Delete request for UIDs: ${uids.join(', ')}`);
    const { deletedCount } = mediaService.deleteMedia(uids);

    console.log(`Successfully deleted ${deletedCount} entries`);
    res.json({ success: true, deletedCount, message: `Successfully deleted ${deletedCount} entries` });
  } catch (error) {
    console.error('Error in media-data delete endpoint:', error);
    res.status(500).json({ error: 'Failed to process deletion request', details: error.message });
  }
});

/**
 * POST /edit
 * Edit one or more media entries (full replacement by UID).
 */
router.post('/edit', (req, res) => {
  try {
    const requestData = req.body;
    const isArray = Array.isArray(requestData);
    const dataToUpdate = isArray ? requestData : [requestData];

    // Validate
    for (const item of dataToUpdate) {
      if (!item.uid) {
        return res.status(400).json({ error: 'Missing required field: uid in one or more items' });
      }
      if (typeof item.uid !== 'number' || !Number.isInteger(item.uid)) {
        return res.status(400).json({ error: `UID must be an integer, got ${typeof item.uid} for uid ${item.uid}` });
      }
    }

    console.log(`Edit request for ${dataToUpdate.length} item(s)`);
    const { updatedItems, notFoundUids } = mediaService.editMedia(dataToUpdate);

    if (notFoundUids.length > 0) {
      console.log(`Images not found for UIDs: ${notFoundUids.join(', ')}`);
      return res.status(404).json({ error: `Images not found for UIDs: ${notFoundUids.join(', ')}`, notFoundUids });
    }

    console.log(`Successfully updated ${updatedItems.length} image data item(s)`);
    res.json({ success: true, data: isArray ? updatedItems : updatedItems[0] });
  } catch (error) {
    console.error('Error in edit endpoint:', error);
    res.status(500).json({ error: 'Failed to process edit request', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/**
 * GET /folder
 * List folders and current selection.
 */
router.get('/folder', (_req, res) => {
  try {
    res.json(mediaService.listFolders());
  } catch (error) {
    console.error('Error in GET /folder endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve folder data' });
  }
});

/**
 * POST /folder
 * Create and/or select a folder.
 */
router.post('/folder', (req, res) => {
  try {
    const result = mediaService.createOrSelectFolder(req.body);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    console.error('Error in POST /folder endpoint:', error);
    res.status(status).json({ error: error.message });
  }
});

/**
 * PUT /folder
 * Rename a folder.
 */
router.put('/folder', (req, res) => {
  try {
    const { uid, label } = req.body;
    const result = mediaService.renameFolder(uid, label);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    console.error('Error in PUT /folder endpoint:', error);
    res.status(status).json({ error: error.message });
  }
});

/**
 * DELETE /folder/:uid
 * Delete a folder, moving its entries to Unsorted.
 */
router.delete('/folder/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    const result = mediaService.deleteFolder(uid);
    if (result.movedCount > 0) {
      console.log(`Moved ${result.movedCount} images from deleted folder to Unsorted`);
    }
    // Remove movedCount from client response to match original API shape
    const { movedCount, ...clientResult } = result;
    res.json(clientResult);
  } catch (error) {
    const status = error.status || 500;
    console.error('Error in DELETE /folder/:uid endpoint:', error);
    res.status(status).json({ error: error.message });
  }
});

export default router;
