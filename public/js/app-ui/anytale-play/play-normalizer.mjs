/**
 * play-normalizer.mjs
 *
 * Normalizes raw data fetched from the server for play mode consumption,
 * filling in missing fields with safe defaults so downstream code can
 * assume a consistent shape.
 */

// ── Per-record normalizers ────────────────────────────────────────────────────

export function normalizeCharacter(c) {
  return {
    ...c,
    name:             c.name             ?? '',
    personality:      c.personality      ?? '',
    selfProfile:      c.selfProfile      ?? '',
    voiceProfile:     c.voiceProfile     ?? '',
    parts:            Array.isArray(c.parts)            ? c.parts            : [],
    preferredOutfits: Array.isArray(c.preferredOutfits) ? c.preferredOutfits : [],
    portraitUrl:      c.portraitUrl      ?? '',
    voiceSampleUrl:   c.voiceSampleUrl   ?? c.audioUrl ?? '',
    introTranscript:  c.introTranscript  ?? '',
  };
}

export function normalizePart(p) {
  return {
    ...p,
    name:             p.name             ?? '',
    referenceTag:     p.referenceTag     ?? '',
    baseline:         p.baseline         ?? '',
    previewBaseline:  p.previewBaseline  ?? '',
    attributes:       Array.isArray(p.attributes) ? p.attributes : [],
  };
}

export function normalizeOutfit(o) {
  const parts = Array.isArray(o.parts) ? o.parts.map(op => ({
    ...op,
    isRevealing: op.isRevealing ?? false,
  })) : [];
  return {
    ...o,
    name:        o.name        ?? '',
    description: o.description ?? '',
    parts,
    previewUrl:  o.previewUrl  ?? '',
  };
}

export function normalizeGenre(g) {
  return {
    ...g,
    disabled: g.disabled ?? false,
  };
}

export function normalizePage(pg) {
  return {
    ...pg,
    actions:      Array.isArray(pg.actions)      ? pg.actions      : [],
    requirements: Array.isArray(pg.requirements) ? pg.requirements : [],
    hiddenParts:  Array.isArray(pg.hiddenParts)  ? pg.hiddenParts  : [],
  };
}

export function normalizePlot(p) {
  return {
    ...p,
    pages:               Array.isArray(p.pages)               ? p.pages.map(normalizePage)     : [],
    section:             p.section             ?? '',
    progressionSections: Array.isArray(p.progressionSections) ? p.progressionSections           : [],
    slotRequirements:    (p.slotRequirements && typeof p.slotRequirements === 'object' && !Array.isArray(p.slotRequirements))
      ? p.slotRequirements : {},
  };
}

// ── Bulk normalizers ──────────────────────────────────────────────────────────

export function normalizePlayData({ parts, plots, characters, outfits, genres, config }) {
  return {
    parts:      (parts      || []).map(normalizePart),
    plots:      (plots      || []).map(normalizePlot),
    characters: (characters || []).map(normalizeCharacter),
    outfits:    (outfits    || []).map(normalizeOutfit),
    genres:     (genres     || []).map(normalizeGenre),
    config:     config || {},
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Check whether all the prerequisites for play mode are satisfied.
 *
 * @param {{ parts, plots, characters, outfits, config }} data - Normalized play data
 * @returns {{ ready: boolean, missing: string[] }}
 */
export function validatePlayRequirements(data) {
  const { parts, plots, characters, config } = data;
  const missing = [];

  if (!characters || characters.length === 0) {
    missing.push('at least one character');
  }

  const hasLocation = (parts || []).some(p => {
    const types = Array.isArray(p.type) ? p.type : [];
    return types.some(t => typeof t === 'string' && t.toLowerCase().includes('location'));
  });
  if (!hasLocation) {
    missing.push('at least one location part');
  }

  const hasPrelude = (plots || []).some(p => p.section?.toLowerCase() === 'prelude');
  if (!hasPrelude) {
    missing.push('at least one prelude plot');
  }

  const hasEpilogue = (plots || []).some(p => p.section?.toLowerCase() === 'epilogue');
  if (!hasEpilogue) {
    missing.push('epilogue plot');
  }

  const introName = config?.introductionPlotName;
  if (introName) {
    const hasIntro = (plots || []).some(p => p.name === introName);
    if (!hasIntro) {
      missing.push(`introduction plot ("${introName}")`);
    }
  }

  return { ready: missing.length === 0, missing };
}
