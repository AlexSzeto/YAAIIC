/**
 * Brew Router – REST endpoints for ambient brew recipe management.
 *
 * Routes:
 *   GET    /api/brews         – list all saved brews ({ uid, name }[])
 *   GET    /api/brews/:uid    – load a brew by uid
 *   POST   /api/brews         – save/create a brew (body: { uid, name, data })
 *   DELETE /api/brews/:uid    – delete a brew by uid
 *
 * @module features/brew/router
 */
import { Router } from 'express';
import { listBrews, loadBrew, saveBrew, deleteBrew } from './service.mjs';

const router = Router();

/**
 * GET /api/brews
 * Returns an array of { uid, name } for all saved brews.
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
 * GET /api/brews/:uid
 * Returns the brew recipe JSON for the given uid.
 */
router.get('/api/brews/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    if (isNaN(uid)) {
      return res.status(400).json({ error: 'uid must be a valid number' });
    }
    const brew = await loadBrew(uid);
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
 * Creates or overwrites a brew. Body: { uid: number, name: string, data: Object }
 */
router.post('/api/brews', async (req, res) => {
  try {
    const { uid, name, data } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (uid == null || typeof uid !== 'number') {
      return res.status(400).json({ error: 'uid is required and must be a number' });
    }
    await saveBrew(uid, name, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving brew:', error);
    res.status(500).json({ error: 'Failed to save brew' });
  }
});

/**
 * DELETE /api/brews/:uid
 * Deletes the brew with the given uid.
 */
router.delete('/api/brews/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    if (isNaN(uid)) {
      return res.status(400).json({ error: 'uid must be a valid number' });
    }
    await deleteBrew(uid);
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
