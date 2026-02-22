/**
 * Brew Service – Business logic for reading/writing ambient brew recipe JSON files.
 *
 * Brew files are stored as `{name}.json` in `server/database/brews/`.
 *
 * @module features/brew/service
 */
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { DATABASE_DIR } from '../../core/paths.mjs';

const BREWS_DIR = path.join(DATABASE_DIR, 'brews');

// Ensure the brews directory exists on module load
fs.mkdirSync(BREWS_DIR, { recursive: true });

/**
 * List all saved brew recipes.
 * @returns {Promise<Array<{name: string}>>}
 */
export async function listBrews() {
  const entries = await fsPromises.readdir(BREWS_DIR);
  return entries
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f.replace(/\.json$/, '') }));
}

/**
 * Load a brew recipe by name.
 * @param {string} name
 * @returns {Promise<Object>} Parsed brew recipe JSON
 */
export async function loadBrew(name) {
  const filePath = path.join(BREWS_DIR, `${name}.json`);
  const raw = await fsPromises.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Save (create or overwrite) a brew recipe.
 * @param {string} name
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function saveBrew(name, data) {
  const filePath = path.join(BREWS_DIR, `${name}.json`);
  await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Delete a brew recipe by name.
 * @param {string} name
 * @returns {Promise<void>}
 */
export async function deleteBrew(name) {
  const filePath = path.join(BREWS_DIR, `${name}.json`);
  await fsPromises.unlink(filePath);
}
