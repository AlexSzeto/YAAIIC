/**
 * anytale-state.mjs – localStorage persistence for the AnyTale page.
 *
 * State shape:
 * {
 *   name: string,
 *   parts: Array<{
 *     id: string,
 *     config: {
 *       name: string,
 *       type: string[],
 *       previewBaseline: string,
 *       baseline: string,
 *       categoryAttributes: Array<{ name: string, category: string }>,
 *       customAttributes: Array<{ name: string, options: string }>
 *     },
 *     data: {
 *       enabled: boolean,
 *       categoryAttributeValues: { [attributeName: string]: string },
 *       customAttributeValues: { [attributeName: string]: string },
 *       previewImageUrl: string
 *     }
 *   }>
 * }
 */

const STORAGE_KEY = 'anytale-state';

const DEFAULT_STATE = {
  name: '',
  parts: []
};

/**
 * Load persisted state from localStorage.
 * @returns {Object} The saved state, or the default empty state.
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, parts: [] };
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name ?? '',
      parts: Array.isArray(parsed.parts) ? parsed.parts : []
    };
  } catch {
    return { ...DEFAULT_STATE, parts: [] };
  }
}

/**
 * Save state to localStorage.
 * @param {Object} state
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save anytale state:', err);
  }
}

/**
 * Clear persisted state.
 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Create a new default part.
 * @returns {Object}
 */
export function createDefaultPart() {
  return {
    id: 'part-' + Date.now(),
    config: {
      name: '',
      type: [],
      previewBaseline: '',
      baseline: '',
      categoryAttributes: [],
      customAttributes: [],
    },
    data: {
      enabled: true,
      categoryAttributeValues: {},
      customAttributeValues: {},
      previewImageUrl: '',
    },
  };
}

/**
 * Create a new default category attribute.
 * @returns {Object}
 */
export function createDefaultCategoryAttribute() {
  return {
    name: '',
    category: '',
  };
}

/**
 * Create a new default custom attribute.
 * @returns {Object}
 */
export function createDefaultCustomAttribute() {
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
    pages: [{ tags: '', dialogPrompt: '', hiddenParts: [] }],
    progressionSections: [],
    progressionDisabledParts: [],
  };
}

/**
 * Load the active plot block from localStorage.
 * Falls back to a blank plot block if nothing is stored.
 * @returns {Object}
 */
export function loadPlot() {
  try {
    const raw = localStorage.getItem(PLOT_STORAGE_KEY);
    if (!raw) return createBlankPlot();
    const parsed = JSON.parse(raw);
    // Ensure at least one page
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      parsed.pages = [{ tags: '', dialogPrompt: '', hiddenParts: [] }];
    }
    // Defensively default per-page fields
    const pages = parsed.pages.map(p => ({
      ...p,
      dialogPrompt: typeof p.dialogPrompt === 'string' ? p.dialogPrompt : '',
      hiddenParts: Array.isArray(p.hiddenParts) ? p.hiddenParts : [],
    }));
    return {
      uid: parsed.uid ?? '',
      name: parsed.name ?? '',
      section: parsed.section ?? '',
      pages,
      progressionSections: Array.isArray(parsed.progressionSections) ? parsed.progressionSections : [],
      progressionDisabledParts: Array.isArray(parsed.progressionDisabledParts) ? parsed.progressionDisabledParts : [],
    };
  } catch {
    return createBlankPlot();
  }
}

/**
 * Persist the active plot block to localStorage.
 * @param {Object} plot
 */
export function savePlotState(plot) {
  try {
    localStorage.setItem(PLOT_STORAGE_KEY, JSON.stringify(plot));
  } catch (err) {
    console.error('Failed to save anytale plot state:', err);
  }
}

/**
 * Clear the active plot block from localStorage.
 */
export function clearPlotState() {
  localStorage.removeItem(PLOT_STORAGE_KEY);
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
  };
}

/**
 * Load the active character from localStorage.
 * Falls back to a blank character if nothing is stored.
 * @returns {Object}
 */
export function loadCharacter() {
  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
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
    };
  } catch {
    return createBlankCharacter();
  }
}

/**
 * Persist the active character state to localStorage.
 * @param {Object} character
 */
export function saveCharacterState(character) {
  try {
    localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(character));
  } catch (err) {
    console.error('Failed to save anytale character state:', err);
  }
}

/**
 * Clear the active character from localStorage.
 */
export function clearCharacterState() {
  localStorage.removeItem(CHARACTER_STORAGE_KEY);
}
