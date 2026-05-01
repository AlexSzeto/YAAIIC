/**
 * dress-up-state.mjs – localStorage persistence for the Dress-Up page.
 *
 * State shape:
 * {
 *   additionalPrompts: string,
 *   clothingItems: Array<{
 *     id: string,
 *     name: string,
 *     worn: boolean,
 *     layer: 'inner' | 'outer',
 *     bodyPart: 'head' | 'upper body' | 'lower body' | 'legs',
 *     attributes: string[],
 *     state: string,
 *     relatedTags: string
 *   }>
 * }
 */

const STORAGE_KEY = 'dressup-state';

const DEFAULT_STATE = {
  additionalPrompts: '',
  clothingItems: []
};

/**
 * Load persisted state from localStorage.
 * @returns {Object} The saved state, or the default empty state.
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, clothingItems: [] };
    const parsed = JSON.parse(raw);
    return {
      additionalPrompts: parsed.additionalPrompts ?? '',
      clothingItems: Array.isArray(parsed.clothingItems) ? parsed.clothingItems : []
    };
  } catch {
    return { ...DEFAULT_STATE, clothingItems: [] };
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
    console.error('Failed to save dress-up state:', err);
  }
}

/**
 * Clear persisted state.
 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Create a new default clothing item.
 * @returns {Object}
 */
export function createDefaultItem() {
  return {
    id: crypto.randomUUID(),
    name: '',
    worn: true,
    layer: 'outer',
    bodyPart: 'upper body',
    attributes: [],
    state: '',
    relatedTags: ''
  };
}
