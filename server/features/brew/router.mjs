/**
 * Brew Router – REST endpoints for ambient brew recipe management.
 *
 * Routes:
 *   GET    /api/brews         – list all saved brews
 *   GET    /api/brews/:name   – load a brew by name
 *   POST   /api/brews         – save/create a brew (body: { name, data })
 *   DELETE /api/brews/:name   – delete a brew by name
 *
 * @module features/brew/router
 */
import { Router } from 'express';
import { listBrews, loadBrew, saveBrew, deleteBrew } from './service.mjs';

const router = Router();

/**
 * GET /api/brews
 * Returns an array of saved brew names.
 */
router.get('/api/brews', async (_req, res) => {
  try {
    const brews = await listBrews();
    res.json(brews);
  } catch (error) {
    console.error('Error listing brews:', error);
    res.status(500).json({ error: 'Failed to list brews' });
  }
});

/**
 * GET /api/brews/:name
 * Returns the brew recipe JSON for the given name.
 */
router.get('/api/brews/:name', async (req, res) => {
  try {
    const brew = await loadBrew(req.params.name);
    res.json(brew);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Brew not found' });
    }
    console.error('Error loading brew:', error);
    res.status(500).json({ error: 'Failed to load brew' });
  }
});

/**
 * POST /api/brews
 * Creates or overwrites a brew. Body: { name: string, data: Object }
 */
router.post('/api/brews', async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    await saveBrew(name, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving brew:', error);
    res.status(500).json({ error: 'Failed to save brew' });
  }
});

/**
 * DELETE /api/brews/:name
 * Deletes the brew with the given name.
 */
router.delete('/api/brews/:name', async (req, res) => {
  try {
    await deleteBrew(req.params.name);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Brew not found' });
    }
    console.error('Error deleting brew:', error);
    res.status(500).json({ error: 'Failed to delete brew' });
  }
});

export default router;
