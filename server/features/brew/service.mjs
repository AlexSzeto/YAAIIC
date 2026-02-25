/**
 * Brew Service – Business logic for reading/writing ambient brew recipes.
 *
 * All brews are stored in a single flat JSON file: `server/database/brew-data.json`.
 * The file contains an array of { name, data } entries, mirroring the structure
 * of media-data.json.
 *
 * On first load, if brew-data.json does not exist but the legacy `server/database/brews/`
 * directory contains JSON files, they are automatically migrated into the flat format
 * and the old directory is removed.
 *
 * @module features/brew/service
 */
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { DATABASE_DIR, BREW_DATA_PATH } from '../../core/paths.mjs';

const LEGACY_BREWS_DIR = path.join(DATABASE_DIR, 'brews');

// ---------------------------------------------------------------------------
// Migration: legacy per-file → flat brew-data.json
// ---------------------------------------------------------------------------

// function migrateLegacyBrews() {
//   if (fs.existsSync(BREW_DATA_PATH)) return; // already migrated

//   if (!fs.existsSync(LEGACY_BREWS_DIR)) return; // nothing to migrate

//   const files = fs.readdirSync(LEGACY_BREWS_DIR).filter(f => f.endsWith('.json'));
//   if (files.length === 0) return;

//   const entries = [];
//   for (const file of files) {
//     try {
//       const raw = fs.readFileSync(path.join(LEGACY_BREWS_DIR, file), 'utf8');
//       const data = JSON.parse(raw);
//       const name = file.replace(/\.json$/, '');
//       entries.push({ name, data });
//     } catch (e) {
//       console.warn(`Brew migration: skipping "${file}":`, e.message);
//     }
//   }

//   fs.writeFileSync(BREW_DATA_PATH, JSON.stringify(entries, null, 2), 'utf8');
//   console.log(`Brew migration: migrated ${entries.length} brew(s) to brew-data.json`);

//   // Remove legacy directory
//   try {
//     for (const file of files) {
//       fs.unlinkSync(path.join(LEGACY_BREWS_DIR, file));
//     }
//     fs.rmdirSync(LEGACY_BREWS_DIR);
//     console.log('Brew migration: removed legacy brews/ directory');
//   } catch (e) {
//     console.warn('Brew migration: could not remove legacy brews/ directory:', e.message);
//   }
// }

// Run migration synchronously at module load
// migrateLegacyBrews();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read and parse brew-data.json. Returns [] if file does not exist. */
function readBrewData() {
  try {
    const raw = fs.readFileSync(BREW_DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Write the entries array back to brew-data.json. */
function writeBrewData(entries) {
  fs.writeFileSync(BREW_DATA_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all saved brew recipes.
 * @returns {Promise<Array<{name: string}>>}
 */
export async function listBrews() {
  const entries = readBrewData();
  return entries.map(e => ({ name: e.name }));
}

/**
 * Load a brew recipe by name.
 * @param {string} name
 * @returns {Promise<Object>} Parsed brew recipe
 */
export async function loadBrew(name) {
  const entries = readBrewData();
  const entry = entries.find(e => e.name === name);
  if (!entry) {
    const err = new Error(`Brew not found: ${name}`);
    err.code = 'ENOENT';
    throw err;
  }
  return entry.data;
}

/**
 * Save (create or overwrite) a brew recipe.
 * @param {string} name
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function saveBrew(name, data) {
  const entries = readBrewData();
  const idx = entries.findIndex(e => e.name === name);
  if (idx >= 0) {
    entries[idx] = { name, data };
  } else {
    entries.push({ name, data });
  }
  writeBrewData(entries);
}

/**
 * Delete a brew recipe by name.
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function deleteBrew(name) {
  const entries = readBrewData();
  const idx = entries.findIndex(e => e.name === name);
  if (idx < 0) {
    const err = new Error(`Brew not found: ${name}`);
    err.code = 'ENOENT';
    throw err;
  }
  entries.splice(idx, 1);
  writeBrewData(entries);
}
