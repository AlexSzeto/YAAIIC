/**
 * AnyTale Service – Business logic for the parts library, plot data, and characters.
 */
import { randomUUID } from 'crypto';
import { listParts, upsertPart, deletePart, listPlots, upsertPlot, deletePlot, listCharacters, upsertCharacter, deleteCharacter, listOutfits, upsertOutfit, deleteOutfit, listGenres, upsertGenre, deleteGenre, appendTrackToGenre, listSfx, upsertSfx, deleteSfx, updateSfxField, updatePlayState } from './repository.mjs';

export function getAllParts() {
  return listParts();
}

function stripPartFields({ isRevealing: _r, ...rest }) {
  return rest;
}

export function createPart(config) {
  const uid = randomUUID();
  return upsertPart(uid, { ...stripPartFields(config), uid });
}

export function savePart(uid, config) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertPart(uid, { ...stripPartFields(config), uid });
}

export function removePartByUid(uid) {
  // throws with code ENOENT if not found
  deletePart(uid);
}

// ── Plot ──────────────────────────────────────────────────────────────────

export function getAllPlots() {
  // Return lightweight summary objects for the play mode and editor autocomplete.
  // description is included so decision options can display it instead of the name.
  return listPlots().map(p => ({
    uid: p.uid,
    name: p.name,
    section: p.section ?? '',
    description: p.description ?? '',
    progressionSections: p.progressionSections ?? [],
    slotRequirements: p.slotRequirements ?? {},
  }));
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

export function createCharacter(character) {
  const uid = randomUUID();
  return upsertCharacter(uid, { ...character, uid });
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

export function updateCharacterField(uid, field, value) {
  const character = listCharacters().find(c => c.uid === uid);
  if (!character) throw new Error(`Character ${uid} not found`);
  upsertCharacter(uid, { ...character, [field]: value });
}

// ── Outfits ────────────────────────────────────────────────────────────────

export function getAllOutfits() {
  return listOutfits();
}

export function createOutfit(outfit) {
  const uid = randomUUID();
  return upsertOutfit(uid, { ...outfit, uid });
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

export function updateOutfitField(uid, field, value) {
  const outfit = listOutfits().find(o => o.uid === uid);
  if (!outfit) throw new Error(`Outfit ${uid} not found`);
  upsertOutfit(uid, { ...outfit, [field]: value });
}

// ── Genres ─────────────────────────────────────────────────────────────────

export function getAllGenres() {
  return listGenres();
}

export function createGenre(genre) {
  const uid = randomUUID();
  return upsertGenre(uid, { ...genre, uid, tracks: genre.tracks ?? [] });
}

export function saveGenre(uid, genre) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertGenre(uid, genre);
}

export function removeGenreByUid(uid) {
  // throws with code ENOENT if not found
  deleteGenre(uid);
}

export function addTrackToGenre(genreUid, track) {
  return appendTrackToGenre(genreUid, track);
}

export function setPlayIntroImageUrl(imageUrl) {
  return updatePlayState({ introImageUrl: imageUrl });
}

// ── SFX ────────────────────────────────────────────────────────────────────

export function getAllSfx() {
  return listSfx();
}

export function createSfx(record) {
  const uid = randomUUID();
  return upsertSfx(uid, { ...record, uid });
}

export function saveSfx(uid, record) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertSfx(uid, { ...record, uid });
}

export function removeSfxByUid(uid) {
  // throws with code ENOENT if not found
  deleteSfx(uid);
}

export function setSfxAudioUrl(uid, audioUrl) {
  return updateSfxField(uid, 'audioUrl', audioUrl);
}
