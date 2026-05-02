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
 *       type: string,
 *       previewBaseline: string,
 *       baseline: string,
 *       categoryAttributes: Array<{ name: string, category: string }>,
 *       customAttributes: Array<{ name: string, options: string }>
 *     },
 *     data: {
 *       enabled: boolean,
 *       categoryAttributeValues: { [index: number]: string },
 *       customAttributeValues: { [index: number]: string },
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
      type: '',
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
