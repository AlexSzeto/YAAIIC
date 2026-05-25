/**
 * AnyTale Router – REST endpoints for the parts library, plot data, characters, outfits, and genres.
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
 *   POST   /anytale/characters/:uid/render-portrait – render a portrait image for a character
 *   POST   /anytale/characters/:uid/generate-voice    – generate voice audio for a character
 *
 *   GET    /anytale/outfits                    – returns array of all saved outfits
 *   POST   /anytale/outfits                    – create a new outfit; server assigns UUID; returns { saved }
 *   PUT    /anytale/outfits/:uid               – update an existing outfit by uid
 *   DELETE /anytale/outfits/:uid               – delete an outfit
 *   POST   /anytale/outfits/:uid/render-outfit – render an image for an outfit
 *
 *   GET    /anytale/genres                          – returns array of all genres
 *   POST   /anytale/genres                          – create a new genre; server assigns UUID; returns { saved }
 *   PUT    /anytale/genres/:uid                     – update an existing genre by uid
 *   DELETE /anytale/genres/:uid                     – delete a genre and all nested tracks
 *   POST   /anytale/genres/:uid/generate-track      – queue AceStep generation for a genre
 *
 *   POST   /anytale/play/generate-intro  – queue intro image generation for play mode (stored in anytale data, not media-data)
 */
import { Router } from 'express';
import fs from 'node:fs';
import { join } from 'path';
import { STORAGE_DIR } from '../../core/paths.mjs';
import { getAllParts, createPart, savePart, removePartByUid, getAllPlots, getPlotByUid, savePlot, removePlotByUid, getAllCharacters, createCharacter, saveCharacter, removeCharacterByUid, updateCharacterField, getAllOutfits, createOutfit, saveOutfit, removeOutfitByUid, updateOutfitField, getAllGenres, createGenre, saveGenre, removeGenreByUid, setPlayIntroImageUrl } from './service.mjs';
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

// ── Render portrait for a character ───────────────────────────────────────

router.post('/anytale/characters/:uid/render-portrait', async (req, res) => {
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
      entityType: 'anytale-render-portrait',
      requestOrigin: 'anytale',
    };

    const autoStart = req.query.queueOnly !== 'true';
    const queueItem = queueService.enqueue({
      type: 'image',
      source: 'anytale',
      clientId: req.body.clientId || null,
      name: charName,
      subLabel: 'Portrait',
      endpointKey: 'anytale-render-portrait',
      taskData: requestData,
    }, { autoStart });

    res.status(202).json({});
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
      clientId: req.body.clientId || null,
      name,
      subLabel: 'Voice',
      endpointKey: 'anytale-voice',
      taskData: requestData,
    }, { autoStart });

    res.status(202).json({});
  } catch (error) {
    console.error('Error starting voice generation for anytale character:', error);
    res.status(500).json({ error: 'Failed to start voice generation', details: error.message });
  }
});

// ── Generate a part preview image (always generates; hash-named for idempotency) ──

router.post('/anytale/generate-part-preview', async (req, res) => {
  try {
    const { prompt, partContext, partUid } = req.body;
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
      partContext: partContext || null,
      partUid: partUid || null,
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
    queueService.enqueue({
      type: 'image',
      source: 'anytale',
      clientId: req.body.clientId || null,
      name: prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt,
      subLabel: 'Part Preview',
      endpointKey: 'anytale-part-preview',
      taskData: requestData,
    }, { autoStart });

    res.json({});
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

// ── Render outfit image ───────────────────────────────────────────────────

router.post('/anytale/outfits/:uid/render-outfit', async (req, res) => {
  try {
    const { uid } = req.params;
    const anytaleConfig = req.app.locals.config?.anytale || {};
    const portraitWorkflow = anytaleConfig.portraitWorkflow || 'Text to Image (Illustrious Portrait)';
    const outfitBasePrompt = anytaleConfig.outfitBasePrompt || '';

    const outfit = getAllOutfits().find(o => o.uid === uid);
    if (!outfit) return res.status(404).json({ error: 'Outfit not found' });

    const { visiblePartUids } = req.body || {};
    const activeParts = visiblePartUids
      ? (outfit.parts || []).filter(op => visiblePartUids.includes(op.partUid))
      : (outfit.parts || []);

    const libraryParts = getAllParts();

    const tags = [];
    if (outfitBasePrompt) tags.push(outfitBasePrompt);

    for (const outfitPart of activeParts) {
      const libPart = libraryParts.find(p => p.uid === outfitPart.partUid);
      if (!libPart) continue;
      if (libPart.baseline) tags.push(libPart.baseline);
      for (const val of Object.values(outfitPart.attributeValues || {})) {
        if (val?.trim()) tags.push(val.trim());
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
      outfitUid: uid,
      entityType: 'anytale-render-outfit',
      requestOrigin: 'anytale',
    };

    const autoStart = req.query.queueOnly !== 'true';
    queueService.enqueue({
      type: 'image',
      source: 'anytale',
      clientId: req.body?.clientId || null,
      name: outfit.name || uid,
      subLabel: 'Outfit Render',
      endpointKey: 'anytale-render-outfit',
      taskData: requestData,
    }, { autoStart });

    res.status(202).json({});
  } catch (error) {
    console.error('Error starting outfit render:', error);
    res.status(500).json({ error: 'Failed to start outfit render', details: error.message });
  }
});

// ── Genre endpoints ───────────────────────────────────────────────────────

router.get('/anytale/genres', (_req, res) => {
  try {
    res.json(getAllGenres());
  } catch (error) {
    console.error('Error listing anytale genres:', error);
    res.status(500).json({ error: 'Failed to list genres' });
  }
});

router.post('/anytale/genres', (req, res) => {
  try {
    const genre = req.body;
    if (!genre || typeof genre !== 'object') {
      return res.status(400).json({ error: 'Request body must be a genre object' });
    }
    const saved = createGenre(genre);
    res.status(201).json({ saved });
  } catch (error) {
    console.error('Error creating anytale genre:', error);
    res.status(500).json({ error: 'Failed to create genre' });
  }
});

router.put('/anytale/genres/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    const genre = req.body;
    if (!genre || typeof genre !== 'object') {
      return res.status(400).json({ error: 'Request body must be a genre object' });
    }
    const saved = saveGenre(uid, { ...genre, uid });
    res.json({ saved });
  } catch (error) {
    if (error.code === 'EINVAL') return res.status(400).json({ error: error.message });
    console.error('Error saving anytale genre:', error);
    res.status(500).json({ error: 'Failed to save genre' });
  }
});

router.delete('/anytale/genres/:uid', (req, res) => {
  try {
    const { uid } = req.params;
    removeGenreByUid(uid);
    res.json({ deleted: uid });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Genre not found' });
    console.error('Error deleting anytale genre:', error);
    res.status(500).json({ error: 'Failed to delete genre' });
  }
});

// ── Generate track for a genre ────────────────────────────────────────────

router.post('/anytale/genres/:uid/generate-track', async (req, res) => {
  try {
    const { uid } = req.params;
    const anytaleConfig = req.app.locals.config?.anytale || {};
    const musicWorkflow = anytaleConfig.musicWorkflow || 'AceStep Music Generation';
    const defaultMusicLength = anytaleConfig.defaultMusicLength ?? 120;

    const { clientId, genreOverrides } = req.body || {};

    const dbGenre = getAllGenres().find(g => g.uid === uid);
    if (!dbGenre) return res.status(404).json({ error: 'Genre not found' });

    // Client may supply current (possibly unsaved) form values to override stale DB data
    const genre = genreOverrides ? { ...dbGenre, ...genreOverrides } : dbGenre;

    const comfyuiWorkflows = loadWorkflows();
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === musicWorkflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Music workflow '${musicWorkflow}' not found` });
    }

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const variation = genre.variations?.length ? pick(genre.variations) : '';
    const prompt = (genre.musicPrompt || '').replace('{{variation}}', variation);
    const key = genre.keys?.length ? pick(genre.keys) : 'C major';
    const bpm = randomInt(genre.bpmMin ?? 80, genre.bpmMax ?? 120);
    const timeSignature = genre.timeSignatures?.length ? pick(genre.timeSignatures) : '4/4';
    const adjective = genre.adjectives?.length ? pick(genre.adjectives) : 'New';
    const noun = genre.nouns?.length ? pick(genre.nouns) : 'Track';
    const name = `${adjective} ${noun}`;

    const requestData = {
      workflow: musicWorkflow,
      name,
      prompt,
      lyrics: '',
      bpm,
      keyscale: key,
      timesignature: timeSignature,
      length: defaultMusicLength,
      seed: Math.floor(Math.random() * 4294967295),
      tags: '',
      description: '',
      summary: '',
      genreUid: uid,
      audioFormat: 'mp3',
    };

    const autoStart = req.query.queueOnly !== 'true';
    queueService.enqueue({
      type: 'audio',
      source: 'anytale',
      clientId: clientId || null,
      name,
      subLabel: genre.name || 'Music',
      endpointKey: 'anytale-music',
      taskData: requestData,
    }, { autoStart });

    res.status(202).json({});
  } catch (error) {
    console.error('Error starting music generation for genre:', error);
    res.status(500).json({ error: 'Failed to start music generation', details: error.message });
  }
});

// ── Play mode intro image generation ─────────────────────────────────────

router.post('/anytale/play/generate-intro', async (req, res) => {
  try {
    const anytaleConfig = req.app.locals.config?.anytale || {};
    const { prompt, workflow, seed, orientation, name, clientId } = req.body;

    const generationWorkflow = workflow || anytaleConfig.generationWorkflow || 'Text to Image (Illustrious Characters)';

    const comfyuiWorkflows = loadWorkflows();
    const workflowData = comfyuiWorkflows.workflows.find(w => w.name === generationWorkflow);
    if (!workflowData) {
      return res.status(400).json({ error: `Workflow '${generationWorkflow}' not found` });
    }

    const requestData = {
      workflow: generationWorkflow,
      prompt: prompt || '',
      seed: seed ?? Math.floor(Math.random() * 4294967295),
      orientation: orientation || 'portrait',
      imageFormat: 'png',
      tags: '',
      description: '',
      summary: '',
      usePostPrompts: false,
      removeBackground: false,
      entityType: 'anytale-play-intro',
      requestOrigin: 'anytale-play',
    };

    const queueItem = queueService.enqueue({
      type: 'image',
      source: 'anytale-play',
      clientId: clientId || null,
      name: name || 'Play Intro',
      subLabel: 'Play Intro',
      endpointKey: 'anytale-play-intro',
      taskData: requestData,
    }, { autoStart: true });

    res.status(202).json({ taskId: queueItem.id });
  } catch (error) {
    console.error('Error starting play intro image generation:', error);
    res.status(500).json({ error: 'Failed to start generation', details: error.message });
  }
});

export default router;
