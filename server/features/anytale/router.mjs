/**
 * AnyTale Router – REST endpoints for the parts library and plot data.
 *
 * Routes:
 *   GET    /anytale/parts         – returns array of all saved part configs
 *   PUT    /anytale/parts/:uid    – upsert a part config by uid
 *   DELETE /anytale/parts/:uid    – remove a part by uid
 *
 *   GET    /anytale/plot          – returns array of { uid, name } summaries
 *   PUT    /anytale/plot/:uid     – upsert a full plot block by uid
 *   DELETE /anytale/plot/:uid     – remove a plot by uid
 */
import { Router } from 'express';
import { getAllParts, savePart, removePartByUid, getAllPlots, getPlotByUid, savePlot, removePlotByUid } from './service.mjs';

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

// ── Plot endpoints ────────────────────────────────────────────────────────

router.get('/anytale/plot', (_req, res) => {
  try {
    const plots = getAllPlots();
    res.json(plots);
  } catch (error) {
    console.error('Error listing anytale plots:', error);
    res.status(500).json({ error: 'Failed to list plots' });
  }
});

router.get('/anytale/plot/:uid', (req, res) => {
  try {
    const plot = getPlotByUid(req.params.uid);
    res.json(plot);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Plot not found' });
    console.error('Error fetching anytale plot:', error);
    res.status(500).json({ error: 'Failed to fetch plot' });
  }
});

router.put('/anytale/plot/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    const plotBlock = req.body;
    if (!plotBlock || typeof plotBlock !== 'object') {
      return res.status(400).json({ error: 'Request body must be a plot block object' });
    }
    const saved = savePlot(uid, { ...plotBlock, uid });
    res.json({ saved });
  } catch (error) {
    if (error.code === 'EINVAL') return res.status(400).json({ error: error.message });
    console.error('Error saving anytale plot:', error);
    res.status(500).json({ error: 'Failed to save plot' });
  }
});

router.delete('/anytale/plot/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    removePlotByUid(uid);
    res.json({ deleted: uid });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Plot not found' });
    console.error('Error deleting anytale plot:', error);
    res.status(500).json({ error: 'Failed to delete plot' });
  }
});

export default router;
