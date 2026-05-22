/**
 * AnyTale Repository – Data access layer for the parts library, plot data, and characters.
 *
 * Reads and writes a flat JSON object: `server/database/anytale-data.json`
 * Shape: { "parts": [ ...partConfigs ], "plot": [ ...plotBlocks ], "characters": [ ...characterObjects ] }
 *
 * Each part config is identified by its `uid` (lower-kebab string derived from name).
 * Each plot block is identified by its `uid`.
 * Each character is identified by its `uid`.
 */
import fs from 'fs';
import { ANYTALE_DATA_PATH } from '../../core/paths.mjs';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/**
 * A reusable part definition in the parts library (body part, clothing, accessory, etc.).
 * @typedef {Object} PartConfig
 * @property {string} uid - UUID assigned by server
 * @property {string} name - Display name (e.g. 'head', 'shirt')
 * @property {string[]} type - Category tags (e.g. ['head'], ['outer upper body'])
 * @property {string} [baseline=''] - Tags always included in generation prompts when this part is active
 * @property {string} [previewBaseline=''] - Tags used in part preview image prompts
 * @property {PartAttribute[]} attributes - User-selectable attributes for this part
 * @property {boolean} [isRevealing=false] - Marks part as containing revealing content
 */

/**
 * A single selectable attribute within a PartConfig.
 * @typedef {Object} PartAttribute
 * @property {string} name - Attribute label (e.g. 'hair color')
 * @property {string} options - Comma-separated list of selectable tag values
 */

/**
 * A full plot block stored in the database (and edited in the plot section).
 * @typedef {Object} PlotBlock
 * @property {string} uid
 * @property {string} name - Display name
 * @property {string} [section=''] - Section/category grouping for organisation
 * @property {string} [description='']
 * @property {PlotPage[]} pages - Ordered list of plot pages
 * @property {string[]} [progressionSections=[]] - Progression section order
 * @property {Record<string, 'covering'|'revealing'|'removed'>} [slotRequirements={}] - Entry requirements for the entire plot; maps slot type string to required status for play mode bootstrap
 */

/**
 * A slot transition action applied when a plot page is reached.
 * @typedef {Object} PlotPageAction
 * @property {string} slot - Slot type string (e.g. 'outer upper body') to transition
 * @property {'covering'|'revealing'|'removed'} status - Target slot status after this page loads
 */

/**
 * A single page within a PlotBlock.
 * @typedef {Object} PlotPage
 * @property {string} [tags=''] - Prompt tags injected during generation for this page
 * @property {string} [dialogPrompt=''] - Prompt for generating dialog on this page
 * @property {PlotPageAction[]} [actions=[]] - Slot transitions applied when this page is reached; replayed in order by resolveSlotStatuses
 * @property {string[]} [requirements=[]] - Gate conditions: each entry is either a slot type string or a part name; all must be satisfied for this page to be reachable
 */

/**
 * A saved character in the characters database.
 * @typedef {Object} Character
 * @property {string} uid - UUID assigned by server
 * @property {string} name
 * @property {string} [personality=''] - Personality description (used for voice generation)
 * @property {string} [portraitUrl=''] - Relative URL to generated portrait image
 * @property {string} [audioUrl=''] - Relative URL to generated voice audio
 * @property {string} [introTranscript=''] - Transcript of the generated voice intro
 * @property {CharacterPart[]} [parts=[]] - Parts assigned to this character
 * @property {string[]} [preferredOutfits=[]] - UIDs of preferred outfits
 */

/**
 * A part reference attached to a Character, with the user's chosen attribute values.
 * @typedef {Object} CharacterPart
 * @property {string} partUid - UID of the PartConfig this references
 * @property {boolean} [enabled=true]
 * @property {{ [attributeName: string]: string }} [attributeValues={}] - Selected value per attribute
 * @property {string} [previewImageUrl=''] - Cached preview image URL for this combination
 */

/**
 * A saved outfit in the outfits database.
 * @typedef {Object} Outfit
 * @property {string} uid - UUID assigned by server
 * @property {string} name
 * @property {CharacterPart[]} parts - Part overrides for this outfit
 * @property {string[]} [preferredLocations=[]] - UIDs of preferred location-typed parts
 * @property {string} [renderUrl=''] - URL of the generated render image
 */

function readData() {
  try {
    const raw = fs.readFileSync(ANYTALE_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      parts: Array.isArray(parsed.parts) ? parsed.parts : [],
      plot: Array.isArray(parsed.plot) ? parsed.plot : [],
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      outfits: Array.isArray(parsed.outfits) ? parsed.outfits : [],
    };
  } catch {
    return { parts: [], plot: [], characters: [], outfits: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(ANYTALE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function listParts() {
  return readData().parts;
}

export function upsertPart(uid, config) {
  const data = readData();
  const idx = data.parts.findIndex(p => p.uid === uid);
  if (idx >= 0) {
    data.parts[idx] = config;
  } else {
    data.parts.push(config);
  }
  writeData(data);
  return config;
}

export function deletePart(uid) {
  const data = readData();
  const idx = data.parts.findIndex(p => p.uid === uid);
  if (idx < 0) {
    const err = new Error(`Part not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  data.parts.splice(idx, 1);
  writeData(data);
}

// ── Plot CRUD ──────────────────────────────────────────────────────────────

export function listPlots() {
  return readData().plot;
}

export function upsertPlot(uid, plotBlock) {
  const data = readData();
  const idx = data.plot.findIndex(p => p.uid === uid);
  if (idx >= 0) {
    data.plot[idx] = plotBlock;
  } else {
    data.plot.push(plotBlock);
  }
  writeData(data);
  return plotBlock;
}

export function deletePlot(uid) {
  const data = readData();
  const idx = data.plot.findIndex(p => p.uid === uid);
  if (idx < 0) {
    const err = new Error(`Plot not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  data.plot.splice(idx, 1);
  writeData(data);
}

// ── Characters CRUD ────────────────────────────────────────────────────────

export function listCharacters() {
  return readData().characters;
}

export function upsertCharacter(uid, character) {
  const data = readData();
  const idx = data.characters.findIndex(c => c.uid === uid);
  if (idx >= 0) {
    data.characters[idx] = character;
  } else {
    data.characters.push(character);
  }
  writeData(data);
  return character;
}

export function deleteCharacter(uid) {
  const data = readData();
  const idx = data.characters.findIndex(c => c.uid === uid);
  if (idx < 0) {
    const err = new Error(`Character not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  data.characters.splice(idx, 1);
  writeData(data);
}

// ── Outfits CRUD ───────────────────────────────────────────────────────────

export function listOutfits() {
  return readData().outfits;
}

export function upsertOutfit(uid, outfit) {
  const data = readData();
  const idx = data.outfits.findIndex(o => o.uid === uid);
  if (idx >= 0) {
    data.outfits[idx] = outfit;
  } else {
    data.outfits.push(outfit);
  }
  writeData(data);
  return outfit;
}

export function deleteOutfit(uid) {
  const data = readData();
  const idx = data.outfits.findIndex(o => o.uid === uid);
  if (idx < 0) {
    const err = new Error(`Outfit not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  data.outfits.splice(idx, 1);
  writeData(data);
}
