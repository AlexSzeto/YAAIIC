/**
 * AnyTale Router – REST endpoints for the parts library.
 *
 * Routes:
 *   GET    /anytale/parts         – returns array of all saved part configs
 *   PUT    /anytale/parts/:uid    – upsert a part config by uid
 *   DELETE /anytale/parts/:uid    – remove a part by uid
 */
import { Router } from 'express';
import { getAllParts, savePart, removePartByUid } from './service.mjs';

const router = Router();

router.get('/anytale/parts', (_req, res) => {
  try {
    const parts = getAllParts();
    res.json(parts);
  } catch (error) {
    console.error('Error listing anytale parts:', error);
    res.status(500).json({ error: 'Failed to list parts' });
  }
});

router.put('/anytale/parts/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Request body must be a part config object' });
    }
    const saved = savePart(uid, { ...config, uid });
    res.json({ saved });
  } catch (error) {
    if (error.code === 'EINVAL') return res.status(400).json({ error: error.message });
    console.error('Error saving anytale part:', error);
    res.status(500).json({ error: 'Failed to save part' });
  }
});

router.delete('/anytale/parts/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    removePartByUid(uid);
    res.json({ deleted: uid });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Part not found' });
    console.error('Error deleting anytale part:', error);
    res.status(500).json({ error: 'Failed to delete part' });
  }
});

export default router;
