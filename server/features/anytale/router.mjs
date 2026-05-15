/**
 * AnyTale Router – REST endpoints for the parts library, plot data, characters, and outfits.
 *
 * Routes:
 *   GET    /anytale/parts         – returns array of all saved part configs
 *   PUT    /anytale/parts/:uid    – upsert a part config by uid
 *   DELETE /anytale/parts/:uid    – remove a part by uid
 *
 *   GET    /anytale/plot          – returns array of { uid, name } summaries
 *   PUT    /anytale/plot/:uid     – upsert a full plot block by uid
 *   DELETE /anytale/plot/:uid     – remove a plot by uid
 *
 *   GET    /anytale/characters             – returns array of all saved characters
 *   PUT    /anytale/characters/:uid        – upsert a character by uid
 *   DELETE /anytale/characters/:uid        – remove a character by uid
 *   POST   /anytale/characters/:uid/generate-portrait – generate a portrait image for a character
 *   POST   /anytale/characters/:uid/generate-voice    – generate voice audio for a character
 *
 *   GET    /anytale/outfits       – returns array of all saved outfits
 *   PUT    /anytale/outfits/:uid  – upsert an outfit; body is { uid, name, parts }
 *   DELETE /anytale/outfits/:uid  – delete an outfit
 */
import { Router } from 'express';
import { getAllParts, savePart, removePartByUid, getAllPlots, getPlotByUid, savePlot, removePlotByUid, getAllCharacters, saveCharacter, removeCharacterByUid, getAllOutfits, saveOutfit, removeOutfitByUid } from './service.mjs';
import { initializeGenerationTask, processGenerationTask } from '../generation/orchestrator.mjs';
import { loadWorkflows } from '../generation/workflow-validator.mjs';

const router = Router();

router.get('/anytale/config', (req, res) => {
  const anytaleConfig = req.app.locals.config?.anytale || {};
  res.json(anytaleConfig);
});

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

// ── Character endpoints ───────────────────────────────────────────────────

router.get('/anytale/characters', (_req, res) => {
  try {
    const characters = getAllCharacters();
    res.json(characters);
  } catch (error) {
    console.error('Error listing anytale characters:', error);
    res.status(500).json({ error: 'Failed to list characters' });
  }
});

router.put('/anytale/characters/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    const character = req.body;
    if (!character || typeof character !== 'object') {
      return res.status(400).json({ error: 'Request body must be a character object' });
    }
    const saved = saveCharacter(uid, { ...character, uid });
    res.json({ saved });
  } catch (error) {
    if (error.code === 'EINVAL') return res.status(400).json({ error: error.message });
    console.error('Error saving anytale character:', error);
    res.status(500).json({ error: 'Failed to save character' });
  }
});

router.delete('/anytale/characters/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    removeCharacterByUid(uid);
    res.json({ deleted: uid });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Character not found' });
    console.error('Error deleting anytale character:', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// ── Generate portrait for a character ─────────────────────────────────────

router.post('/anytale/characters/:uid/generate-portrait', async (req, res) => {
  try {
    const config = req.app.locals.config;
    const uploadFileToComfyUI = req.app.locals.uploadFileToComfyUI;
    const anytaleConfig = config.anytale || {};
    const portraitWorkflow = anytaleConfig.portraitWorkflow || 'Text to Image (Illustrious Portrait)';
    const portraitBasePrompt = anytaleConfig.portraitBasePrompt || '';
    const portraitPartMatchers = Array.isArray(anytaleConfig.portraitParts) ? anytaleConfig.portraitParts : [];

    const { parts: requestParts = [] } = req.body;

    // Load all library parts from the repository
    const libraryParts = getAllParts();

    // Match library parts against portraitParts matchers (case-insensitive)
    const matchedLibraryParts = libraryParts.filter(libPart => {
      const partName = (libPart.name || '').toLowerCase();
      const partTypes = Array.isArray(libPart.type) ? libPart.type.map(t => t.toLowerCase()) : [];
      return portraitPartMatchers.some(matcher => {
        const m = matcher.toLowerCase();
        return partName === m || partTypes.includes(m);
      });
    });

    // Assemble prompt tags from matched parts using the character's saved attribute values
    const tags = [];
    if (portraitBasePrompt) tags.push(portraitBasePrompt);

    for (const libPart of matchedLibraryParts) {
      // Find matching entry in request parts array
      const charPart = requestParts.find(p => p.partUid === libPart.uid);

      // Always include the part's baseline
      if (libPart.baseline) tags.push(libPart.baseline);

      if (charPart) {
        // Add category attribute values
        for (const val of Object.values(charPart.categoryAttributeValues || {})) {
          if (val && val.trim()) tags.push(val.trim());
        }
        // Add custom attribute values
        for (const val of Object.values(charPart.customAttributeValues || {})) {
          if (val && val.trim()) tags.push(val.trim());
        }
      }
    }

    const prompt = tags.filter(Boolean).join(', ');

    const comfyuiWorkflows = loadWorkflows();
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === portraitWorkflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Portrait workflow '${portraitWorkflow}' not found` });
    }

    const requestData = {
      workflow: portraitWorkflow,
      prompt,
      seed: Math.floor(Math.random() * 4294967295),
      orientation: 'square',
      imageFormat: 'png',
      tags: '',
      description: '',
      summary: '',
      usePostPrompts: false,
      removeBackground: false,
    };

    const { taskId } = initializeGenerationTask(requestData, workflowData, config);
    res.status(202).json({ taskId });
    processGenerationTask(taskId, requestData, workflowData, config, true, uploadFileToComfyUI)
      .catch(err => console.error('Portrait generation task failed:', err));
  } catch (error) {
    console.error('Error starting portrait generation for anytale character:', error);
    res.status(500).json({ error: 'Failed to start portrait generation', details: error.message });
  }
});

// ── Generate voice for a character ────────────────────────────────────────

router.post('/anytale/characters/:uid/generate-voice', async (req, res) => {
  try {
    const config = req.app.locals.config;
    const uploadFileToComfyUI = req.app.locals.uploadFileToComfyUI;
    const anytaleConfig = config.anytale || {};
    const voiceWorkflow = anytaleConfig.voiceWorkflow || 'Personality to Voice Design (Qwen3-TTS)';

    const { personality = '', name = '' } = req.body;

    const comfyuiWorkflows = loadWorkflows();
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === voiceWorkflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Voice workflow '${voiceWorkflow}' not found` });
    }

    const requestData = {
      workflow: voiceWorkflow,
      name,
      prompt: personality,
      seed: Math.floor(Math.random() * 4294967295),
      tags: '',
      description: '',
      summary: '',
    };

    // Apply defaults from the workflow's extraInputs so required fields like
    // audioFormat are populated even when not provided in the request body.
    if (workflowData.options?.extraInputs) {
      for (const input of workflowData.options.extraInputs) {
        if (input.default !== undefined && requestData[input.id] === undefined) {
          requestData[input.id] = input.default;
        }
      }
    }

    const { taskId } = initializeGenerationTask(requestData, workflowData, config);
    res.status(202).json({ taskId });
    processGenerationTask(taskId, requestData, workflowData, config, true, uploadFileToComfyUI)
      .catch(err => console.error('Voice generation task failed:', err));
  } catch (error) {
    console.error('Error starting voice generation for anytale character:', error);
    res.status(500).json({ error: 'Failed to start voice generation', details: error.message });
  }
});

// ── Outfit endpoints ─────────────────────────────────────────────────────

router.get('/anytale/outfits', (_req, res) => {
  try {
    const outfits = getAllOutfits();
    res.json(outfits);
  } catch (error) {
    console.error('Error listing anytale outfits:', error);
    res.status(500).json({ error: 'Failed to list outfits' });
  }
});

router.put('/anytale/outfits/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    const outfit = req.body;
    if (!outfit || typeof outfit !== 'object') {
      return res.status(400).json({ error: 'Request body must be an outfit object' });
    }
    const saved = saveOutfit(uid, { ...outfit, uid });
    res.json({ saved });
  } catch (error) {
    if (error.code === 'EINVAL') return res.status(400).json({ error: error.message });
    console.error('Error saving anytale outfit:', error);
    res.status(500).json({ error: 'Failed to save outfit' });
  }
});

router.delete('/anytale/outfits/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    removeOutfitByUid(uid);
    res.json({ deleted: uid });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Outfit not found' });
    console.error('Error deleting anytale outfit:', error);
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
});

export default router;
