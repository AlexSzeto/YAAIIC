/**
 * Brew Service – Business logic for reading/writing ambient brew recipes.
 *
 * All brews are stored in a single flat JSON file: `server/database/brew-data.json`.
 * The file contains an array of { uid, name, data } entries.
 *
 * UIDs are stable numeric timestamps (Date.now()) assigned on first save.
 * Existing entries without a uid are migrated automatically on the first read.
 *
 * @module features/brew/service
 */
import fs from 'fs';
import { BREW_DATA_PATH } from '../../core/paths.mjs';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse brew-data.json.
 * Auto-migrates entries that are missing a uid (legacy format).
 * Returns [] if the file does not exist.
 */
function readBrewData() {
  let entries;
  try {
    const raw = fs.readFileSync(BREW_DATA_PATH, 'utf8');
    entries = JSON.parse(raw);
  } catch {
    return [];
  }

  // Migration: assign stable UIDs to entries that predate the uid field.
  let changed = false;
  let nextUid = Date.now();
  entries.forEach(e => {
    if (!e.uid) {
      e.uid = nextUid++;
      changed = true;
    }
  });
  if (changed) writeBrewData(entries);

  return entries;
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
 * @returns {Promise<Array<{uid: number, name: string}>>}
 */
export async function listBrews() {
  const entries = readBrewData();
  return entries.map(e => ({ uid: e.uid, name: e.name }));
}

/**
 * Load a brew recipe by uid.
 * Injects the entry's uid into the returned data so the client can track it.
 * @param {number} uid
 * @returns {Promise<Object>} Parsed brew recipe (includes uid field)
 */
export async function loadBrew(uid) {
  const entries = readBrewData();
  const entry = entries.find(e => e.uid === uid);
  if (!entry) {
    const err = new Error(`Brew not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  // Inject uid so the client always has it even when loading legacy data.
  return { ...entry.data, uid: entry.uid };
}

/**
 * Save (create or overwrite) a brew recipe, identified by uid.
 * @param {number} uid
 * @param {string} name  – display name (may differ from data.label if renamed)
 * @param {Object} data  – the full brew recipe object
 * @returns {Promise<void>}
 */
export async function saveBrew(uid, name, data) {
  const entries = readBrewData();
  const idx = entries.findIndex(e => e.uid === uid);
  if (idx >= 0) {
    entries[idx] = { uid, name, data };
  } else {
    entries.push({ uid, name, data });
  }
  writeBrewData(entries);
}

/**
 * Delete a brew recipe by uid.
 * @param {number} uid
 * @returns {Promise<void>}
 */
export async function deleteBrew(uid) {
  const entries = readBrewData();
  const idx = entries.findIndex(e => e.uid === uid);
  if (idx < 0) {
    const err = new Error(`Brew not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  entries.splice(idx, 1);
  writeBrewData(entries);
}
