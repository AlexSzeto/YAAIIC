/**
 * AnyTale Service – Business logic for the parts library, plot data, and characters.
 */
import { listParts, upsertPart, deletePart, listPlots, upsertPlot, deletePlot, listCharacters, upsertCharacter, deleteCharacter, listOutfits, upsertOutfit, deleteOutfit } from './repository.mjs';

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
  return listPlots().map(p => ({ uid: p.uid, name: p.name, section: p.section ?? '' }));
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

// ── Characters ────────────────────────────────────────────────────────────

export function getAllCharacters() {
  return listCharacters();
}

export function saveCharacter(uid, character) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertCharacter(uid, character);
}

export function removeCharacterByUid(uid) {
  // throws with code ENOENT if not found
  deleteCharacter(uid);
}

// ── Outfits ────────────────────────────────────────────────────────────────

export function getAllOutfits() {
  return listOutfits();
}

export function saveOutfit(uid, outfit) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertOutfit(uid, outfit);
}

export function removeOutfitByUid(uid) {
  // throws with code ENOENT if not found
  deleteOutfit(uid);
}
