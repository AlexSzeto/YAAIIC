/**
 * AnyTale Repository – Data access layer for the parts library.
 *
 * Reads and writes a flat JSON object: `server/database/anytale-data.json`
 * Shape: { "parts": [ ...partConfigs ] }
 *
 * Each part config is identified by its `uid` (lower-kebab string derived from name).
 */
import fs from 'fs';
import { ANYTALE_DATA_PATH } from '../../core/paths.mjs';

function readData() {
  try {
    const raw = fs.readFileSync(ANYTALE_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.parts) ? parsed : { parts: [] };
  } catch {
    return { parts: [] };
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
