/**
 * AnyTale Router – REST endpoints for the parts library, plot data, characters, and outfits.
 *
 * Routes:
 *   GET    /anytale/parts         – returns array of all saved part configs
 *   POST   /anytale/parts         – create a new part; server assigns UUID; returns { saved }
 *   PUT    /anytale/parts/:uid    – update an existing part by uid
 *   DELETE /anytale/parts/:uid    – remove a part by uid
 *
 *   GET    /anytale/plot          – returns array of { uid, name } summaries
 *   PUT    /anytale/plot/:uid     – upsert a full plot block by uid
 *   DELETE /anytale/plot/:uid     – remove a plot by uid
 *
 *   GET    /anytale/characters             – returns array of all saved characters
 *   POST   /anytale/characters             – create a new character; server assigns UUID; returns { saved }
 *   PUT    /anytale/characters/:uid        – update an existing character by uid
 *   DELETE /anytale/characters/:uid        – remove a character by uid
 *   POST   /anytale/characters/:uid/generate-portrait – generate a portrait image for a character
 *   POST   /anytale/characters/:uid/generate-voice    – generate voice audio for a character
 *
 *   GET    /anytale/outfits       – returns array of all saved outfits
 *   POST   /anytale/outfits       – create a new outfit; server assigns UUID; returns { saved }
 *   PUT    /anytale/outfits/:uid  – update an existing outfit by uid
 *   DELETE /anytale/outfits/:uid  – delete an outfit
 */
import { Router } from 'express';
import fs from 'node:fs';
import { join } from 'path';
import { STORAGE_DIR } from '../../core/paths.mjs';
import { getAllParts, createPart, savePart, removePartByUid, getAllPlots, getPlotByUid, savePlot, removePlotByUid, getAllCharacters, createCharacter, saveCharacter, removeCharacterByUid, getAllOutfits, createOutfit, saveOutfit, removeOutfitByUid, updateCharacterField } from './service.mjs';
import { loadWorkflows } from '../generation/workflow-validator.mjs';
import * as queueService from '../queue/service.mjs';
import { portraitPromptHash } from './portrait-hash.mjs';

const router = Router();

const RULES_PATH = join(process.cwd(), 'server', 'resource', 'anytale-rules.txt');

function loadSlotRules() {
  try {
    return fs.readFileSync(RULES_PATH, 'utf8');
  } catch {
    return '';
  }
}

router.get('/anytale/config', (req, res) => {
  const anytaleConfig = req.app.locals.config?.anytale || {};
  res.json({ ...anytaleConfig, slotRules: loadSlotRules() });
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

router.post('/anytale/parts', (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Request body must be a part config object' });
    }
    const saved = createPart(config);
    res.status(201).json({ saved });
  } catch (error) {
    console.error('Error creating anytale part:', error);
    res.status(500).json({ error: 'Failed to create part' });
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

router.post('/anytale/characters', (req, res) => {
  try {
    const character = req.body;
    if (!character || typeof character !== 'object') {
      return res.status(400).json({ error: 'Request body must be a character object' });
    }
    const saved = createCharacter(character);
    res.status(201).json({ saved });
  } catch (error) {
    console.error('Error creating anytale character:', error);
    res.status(500).json({ error: 'Failed to create character' });
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
    const { uid } = req.params;
    const anytaleConfig = req.app.locals.config?.anytale || {};
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
      // Only include parts that the character has actually added
      const charPart = requestParts.find(p => p.partUid === libPart.uid);
      if (!charPart) continue;

      // Include the part's baseline
      if (libPart.baseline) tags.push(libPart.baseline);

      // Add attribute values (new unified format)
      for (const val of Object.values(charPart.attributeValues || {})) {
        if (val && val.trim()) tags.push(val.trim());
      }
      // Legacy fallback: include old split maps if present
      for (const val of Object.values(charPart.categoryAttributeValues || {})) {
        if (val && val.trim()) tags.push(val.trim());
      }
      for (const val of Object.values(charPart.customAttributeValues || {})) {
        if (val && val.trim()) tags.push(val.trim());
      }
    }

    const prompt = tags.filter(Boolean).join(', ');

    const comfyuiWorkflows = loadWorkflows();
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === portraitWorkflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Portrait workflow '${portraitWorkflow}' not found` });
    }

    const charName = getAllCharacters().find(c => c.uid === uid)?.name || uid;

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
      characterUid: uid,
      entityType: 'anytale-portrait',
      requestOrigin: 'anytale',
    };

    const autoStart = req.query.queueOnly !== 'true';
    const queueItem = queueService.enqueue({
      type: 'image',
      source: 'anytale',
      name: charName,
      subLabel: 'Portrait',
      endpointKey: 'anytale-portrait',
      taskData: requestData,
    }, { autoStart });

    res.status(202).json({ queueId: queueItem.id });
  } catch (error) {
    console.error('Error starting portrait generation for anytale character:', error);
    res.status(500).json({ error: 'Failed to start portrait generation', details: error.message });
  }
});

// ── Generate voice for a character ────────────────────────────────────────

router.post('/anytale/characters/:uid/generate-voice', async (req, res) => {
  try {
    const { uid } = req.params;
    const anytaleConfig = req.app.locals.config?.anytale || {};
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

    requestData.characterUid = uid;
    requestData.entityType = 'anytale-voice';
    requestData.requestOrigin = 'anytale';

    const autoStart = req.query.queueOnly !== 'true';
    const queueItem = queueService.enqueue({
      type: 'audio',
      source: 'anytale',
      name,
      subLabel: 'Voice',
      endpointKey: 'anytale-voice',
      taskData: requestData,
    }, { autoStart });

    res.status(202).json({ queueId: queueItem.id });
  } catch (error) {
    console.error('Error starting voice generation for anytale character:', error);
    res.status(500).json({ error: 'Failed to start voice generation', details: error.message });
  }
});

// ── Generate a part preview image (always generates; hash-named for idempotency) ──

router.post('/anytale/generate-part-preview', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const hash = portraitPromptHash(prompt);
    const targetFilename = 'portrait_' + hash + '.png';
    const targetPath = join(STORAGE_DIR, targetFilename);

    const partPreviewWorkflow = (req.app.locals.config?.anytale || {}).partPreviewWorkflow || 'Text to Image (Illustrious Part Preview)';

    const comfyuiWorkflows = loadWorkflows();
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === partPreviewWorkflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Portrait workflow '${partPreviewWorkflow}' not found` });
    }

    const requestData = {
      workflow: partPreviewWorkflow,
      prompt,
      seed: Math.floor(Math.random() * 4294967295),
      orientation: 'square',
      imageFormat: 'png',
      tags: '',
      description: '',
      summary: '',
      usePostPrompts: false,
      removeBackground: false,
      saveImagePath: targetPath,
    };

    const autoStart = req.query.queueOnly !== 'true';
    const queueItem = queueService.enqueue({
      type: 'image',
      source: 'anytale',
      name: prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt,
      subLabel: 'Part Preview',
      endpointKey: 'anytale-part-preview',
      taskData: requestData,
    }, { autoStart });

    res.json({ queueId: queueItem.id });
  } catch (error) {
    console.error('Error starting part preview generation:', error);
    res.status(500).json({ error: 'Failed to start part preview generation', details: error.message });
  }
});

// ── Part preview cache lookup ─────────────────────────────────────────────

router.post('/anytale/request-part-preview', (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const hash = portraitPromptHash(prompt);
  const targetFilename = 'portrait_' + hash + '.png';
  const targetPath = join(STORAGE_DIR, targetFilename);
  if (fs.existsSync(targetPath)) {
    return res.json({ found: true, portraitUrl: '/media/' + targetFilename });
  }
  res.json({ found: false });
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

router.post('/anytale/outfits', (req, res) => {
  try {
    const outfit = req.body;
    if (!outfit || typeof outfit !== 'object') {
      return res.status(400).json({ error: 'Request body must be an outfit object' });
    }
    const saved = createOutfit(outfit);
    res.status(201).json({ saved });
  } catch (error) {
    console.error('Error creating anytale outfit:', error);
    res.status(500).json({ error: 'Failed to create outfit' });
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
