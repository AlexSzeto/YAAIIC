/**
 * AnyTale Repository – Data access layer for the parts library and plot data.
 *
 * Reads and writes a flat JSON object: `server/database/anytale-data.json`
 * Shape: { "parts": [ ...partConfigs ], "plot": [ ...plotBlocks ] }
 *
 * Each part config is identified by its `uid` (lower-kebab string derived from name).
 * Each plot block is identified by its `uid`.
 */
import fs from 'fs';
import { ANYTALE_DATA_PATH } from '../../core/paths.mjs';

function readData() {
  try {
    const raw = fs.readFileSync(ANYTALE_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      parts: Array.isArray(parsed.parts) ? parsed.parts : [],
      plot: Array.isArray(parsed.plot) ? parsed.plot : [],
    };
  } catch {
    return { parts: [], plot: [] };
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
