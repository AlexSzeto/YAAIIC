/**
 * AnyTale Service – Business logic for the parts library and plot data.
 */
import { listParts, upsertPart, deletePart, listPlots, upsertPlot, deletePlot } from './repository.mjs';

export function getAllParts() {
  return listParts();
}

export function savePart(uid, config) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertPart(uid, config);
}

export function removePartByUid(uid) {
  // throws with code ENOENT if not found
  deletePart(uid);
}

// ── Plot ──────────────────────────────────────────────────────────────────

export function getAllPlots() {
  // Return lightweight summary objects for autocomplete
  return listPlots().map(p => ({ uid: p.uid, name: p.name }));
}

export function getPlotByUid(uid) {
  const plot = listPlots().find(p => p.uid === uid);
  if (!plot) {
    const err = new Error(`Plot not found: ${uid}`);
    err.code = 'ENOENT';
    throw err;
  }
  return plot;
}

export function savePlot(uid, plotBlock) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertPlot(uid, plotBlock);
}

export function removePlotByUid(uid) {
  // throws with code ENOENT if not found
  deletePlot(uid);
}
