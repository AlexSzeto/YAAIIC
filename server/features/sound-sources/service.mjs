/**
 * Sound Sources Service – Business logic for the global sound source list.
 *
 * All global sources are stored in a single flat JSON file:
 * `server/database/sound-sources.json`. The file contains an array of source
 * objects, each with at minimum a `label` field used as the unique key.
 *
 * @module features/sound-sources/service
 */
import fs from 'fs';
import { SOUND_SOURCES_PATH } from '../../core/paths.mjs';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read and parse sound-sources.json. Returns [] if file does not exist. */
function readSourceData() {
  try {
    const raw = fs.readFileSync(SOUND_SOURCES_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Write the entries array back to sound-sources.json. */
function writeSourceData(entries) {
  fs.writeFileSync(SOUND_SOURCES_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all global sound sources.
 * @returns {Promise<Array<Object>>}
 */
export async function listSources() {
  return readSourceData();
}

/**
 * Upsert a sound source by name (label). If a source with the same label
 * exists it is overwritten; otherwise it is appended.
 * @param {Object} source - Source object (must have a `label` string field)
 * @returns {Promise<void>}
 */
export async function upsertSource(source) {
  if (!source || typeof source.label !== 'string') {
    const err = new Error('source.label is required');
    err.code = 'EINVAL';
    throw err;
  }
  const entries = readSourceData();
  const idx = entries.findIndex(e => e.label === source.label);
  if (idx >= 0) {
    entries[idx] = source;
  } else {
    entries.push(source);
  }
  writeSourceData(entries);
}

/**
 * Delete a global sound source by label (name).
 * @param {string} label
 * @returns {Promise<void>}
 */
export async function deleteSource(label) {
  const entries = readSourceData();
  const idx = entries.findIndex(e => e.label === label);
  if (idx < 0) {
    const err = new Error(`Source not found: ${label}`);
    err.code = 'ENOENT';
    throw err;
  }
  entries.splice(idx, 1);
  writeSourceData(entries);
}
