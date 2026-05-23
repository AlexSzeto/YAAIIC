/**
 * anytale-state.mjs – sessionStorage persistence for the AnyTale page.
 *
 * State shape:
 * {
 *   name: string,        // preview image name
 *   activePlotPage: number,
 *   parts: Array<{
 *     id: string,
 *     config: {
 *       name: string,
 *       type: string[],
 *       previewBaseline: string,
 *       baseline: string,
 *       attributes: Array<{ name: string, options: string }>,
 *       isRevealing: boolean
 *     },
 *     data: {
 *       enabled: boolean,
 *       attributeValues: { [attributeName: string]: string },
 *       previewImageUrl: string
 *     }
 *   }>
 * }
 */

const STORAGE_KEY = 'anytale-state';

const DEFAULT_STATE = {
  name: '',
  activePlotPage: 0,
  parts: []
};

/**
 * Load persisted state from sessionStorage.
 * @returns {Object} The saved state, or the default empty state.
 */
export function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, parts: [] };
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name ?? '',
      activePlotPage: typeof parsed.activePlotPage === 'number' ? parsed.activePlotPage : 0,
      parts: Array.isArray(parsed.parts) ? parsed.parts.map(p => ({
        ...p,
        config: {
          ...p.config,
          isRevealing: typeof p.config?.isRevealing === 'boolean' ? p.config.isRevealing : false,
        },
      })) : []
    };
  } catch {
    return { ...DEFAULT_STATE, parts: [] };
  }
}

/**
 * Save state to sessionStorage.
 * @param {Object} state
 */
export function saveState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save anytale state:', err);
  }
}

/**
 * Clear persisted state.
 */
export function clearState() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Create a new default part.
 * @returns {Object}
 */
export function createDefaultPart() {
  return {
    id: 'part-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    config: {
      name: '',
      type: [],
      previewBaseline: '',
      baseline: '',
      attributes: [],
      isRevealing: false,
    },
    data: {
      enabled: true,
      attributeValues: {},
      previewImageUrl: '',
    },
  };
}

/**
 * Create a new default attribute.
 * @returns {Object}
 */
export function createDefaultAttribute() {
  return {
    name: '',
    options: '',
  };
}

// ── Plot State ────────────────────────────────────────────────────────────

const PLOT_STORAGE_KEY = 'anytale-plot';

/** @returns {Object} A blank plot block with one empty page. */
export function createBlankPlot() {
  return {
    uid: '',
    name: '',
    section: '',
    description: '',
    pages: [{ tags: '', dialogPrompt: '', actions: [], requirements: [] }],
    progressionSections: [],
    slotRequirements: {},
  };
}

/**
 * Load the active plot block from sessionStorage.
 * Falls back to a blank plot block if nothing is stored.
 * @returns {Object}
 */
export function loadPlot() {
  try {
    const raw = sessionStorage.getItem(PLOT_STORAGE_KEY);
    if (!raw) return createBlankPlot();
    const parsed = JSON.parse(raw);
    // Ensure at least one page
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      parsed.pages = [{ tags: '', dialogPrompt: '', actions: [] }];
    }
    // Defensively default per-page fields
    const pages = parsed.pages.map(p => ({
      ...p,
      dialogPrompt: typeof p.dialogPrompt === 'string' ? p.dialogPrompt : '',
      actions: Array.isArray(p.actions) ? p.actions : [],
      requirements: Array.isArray(p.requirements) ? p.requirements : [],
    }));
    return {
      uid: parsed.uid ?? '',
      name: parsed.name ?? '',
      section: parsed.section ?? '',
      description: parsed.description ?? '',
      pages,
      progressionSections: Array.isArray(parsed.progressionSections) ? parsed.progressionSections : [],
      slotRequirements: (parsed.slotRequirements && typeof parsed.slotRequirements === 'object' && !Array.isArray(parsed.slotRequirements))
        ? Object.fromEntries(Object.entries(parsed.slotRequirements).filter(([, v]) => v === 'present' || v === 'absent'))
        : {},
    };
  } catch {
    return createBlankPlot();
  }
}

/**
 * Persist the active plot block to sessionStorage.
 * @param {Object} plot
 */
export function savePlotState(plot) {
  try {
    sessionStorage.setItem(PLOT_STORAGE_KEY, JSON.stringify(plot));
  } catch (err) {
    console.error('Failed to save anytale plot state:', err);
  }
}

/**
 * Clear the active plot block from sessionStorage.
 */
export function clearPlotState() {
  sessionStorage.removeItem(PLOT_STORAGE_KEY);
}

// ── Character State ───────────────────────────────────────────────────────

const CHARACTER_STORAGE_KEY = 'anytale-character';

/** @returns {Object} A blank character with empty fields. */
export function createBlankCharacter() {
  return {
    uid: '',
    name: '',
    personality: '',
    portraitUrl: '',
    audioUrl: '',
    introTranscript: '',
    parts: [],
    preferredOutfits: [],
  };
}

/**
 * Load the active character from sessionStorage.
 * Falls back to a blank character if nothing is stored.
 * @returns {Object}
 */
export function loadCharacter() {
  try {
    const raw = sessionStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return createBlankCharacter();
    const parsed = JSON.parse(raw);
    return {
      uid: parsed.uid ?? '',
      name: parsed.name ?? '',
      personality: parsed.personality ?? '',
      portraitUrl: parsed.portraitUrl ?? '',
      audioUrl: parsed.audioUrl ?? '',
      introTranscript: parsed.introTranscript ?? '',
      parts: Array.isArray(parsed.parts) ? parsed.parts : [],
      preferredOutfits: Array.isArray(parsed.preferredOutfits) ? parsed.preferredOutfits : [],
    };
  } catch {
    return createBlankCharacter();
  }
}

/**
 * Persist the active character state to sessionStorage.
 * @param {Object} character
 */
export function saveCharacterState(character) {
  try {
    sessionStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(character));
  } catch (err) {
    console.error('Failed to save anytale character state:', err);
  }
}

/**
 * Clear the active character from sessionStorage.
 */
export function clearCharacterState() {
  sessionStorage.removeItem(CHARACTER_STORAGE_KEY);
}

// ── Outfit State ────────────────────────────────────────────────

const OUTFIT_STORAGE_KEY = 'anytale-outfit';

/** @returns {Object} A blank outfit with empty fields. */
export function createBlankOutfit() {
  return {
    uid: '',
    name: '',
    parts: [],
    preferredLocations: [],
    renderUrl: '',
  };
}

/**
 * Load the active outfit from sessionStorage.
 * Falls back to a blank outfit if nothing is stored.
 * @returns {Object}
 */
export function loadOutfit() {
  try {
    const raw = sessionStorage.getItem(OUTFIT_STORAGE_KEY);
    if (!raw) return createBlankOutfit();
    const parsed = JSON.parse(raw);
    return {
      uid: parsed.uid ?? '',
      name: parsed.name ?? '',
      parts: Array.isArray(parsed.parts) ? parsed.parts : [],
      preferredLocations: Array.isArray(parsed.preferredLocations) ? parsed.preferredLocations : [],
      renderUrl: parsed.renderUrl ?? '',
    };
  } catch {
    return createBlankOutfit();
  }
}

/**
 * Persist the active outfit state to sessionStorage.
 * @param {Object} outfit
 */
export function saveOutfitState(outfit) {
  try {
    sessionStorage.setItem(OUTFIT_STORAGE_KEY, JSON.stringify(outfit));
  } catch (err) {
    console.error('Failed to save anytale outfit state:', err);
  }
}

/**
 * Clear the active outfit from sessionStorage.
 */
export function clearOutfitState() {
  sessionStorage.removeItem(OUTFIT_STORAGE_KEY);
}
