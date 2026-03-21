/**
 * Sound Sources Router – REST endpoints for global sound source management.
 *
 * Routes:
 *   GET    /api/sound-sources         – list all global sound sources
 *   POST   /api/sound-sources         – upsert a source by label (body: source object)
 *   DELETE /api/sound-sources/:name   – delete a source by label
 *
 * @module features/sound-sources/router
 */
import { Router } from 'express';
import { listSources, upsertSource, deleteSource } from './service.mjs';

const router = Router();

/**
 * GET /api/sound-sources
 * Returns the array of all global sound source objects.
 */
router.get('/api/sound-sources', async (_req, res) => {
  try {
    const sources = await listSources();
    res.json(sources);
  } catch (error) {
    console.error('Error listing sound sources:', error);
    res.status(500).json({ error: 'Failed to list sound sources' });
  }
});

/**
 * POST /api/sound-sources
 * Upserts a sound source by label. Body must be a source object with a `label` field.
 */
router.post('/api/sound-sources', async (req, res) => {
  try {
    const source = req.body;
    await upsertSource(source);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'EINVAL') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error upserting sound source:', error);
    res.status(500).json({ error: 'Failed to save sound source' });
  }
});

/**
 * DELETE /api/sound-sources/:name
 * Deletes the global sound source with the given label.
 */
router.delete('/api/sound-sources/:name', async (req, res) => {
  try {
    await deleteSource(decodeURIComponent(req.params.name));
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Sound source not found' });
    }
    console.error('Error deleting sound source:', error);
    res.status(500).json({ error: 'Failed to delete sound source' });
  }
});

export default router;
