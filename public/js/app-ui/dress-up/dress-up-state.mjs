/**
 * dress-up-state.mjs – localStorage persistence for the Dress-Up page.
 *
 * State shape:
 * {
 *   name: string,
 *   additionalPrompts: Array<{ id: string, name: string, text: string, enabled: boolean }>,
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
  name: '',
  additionalPrompts: [],
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

    // Migrate legacy string additionalPrompts to array shape
    let additionalPrompts;
    if (typeof parsed.additionalPrompts === 'string') {
      additionalPrompts = parsed.additionalPrompts.trim()
        ? [{ id: 'ap-1', name: '', text: parsed.additionalPrompts, enabled: true }]
        : [];
    } else {
      additionalPrompts = Array.isArray(parsed.additionalPrompts) ? parsed.additionalPrompts : [];
    }

    return {
      name: parsed.name ?? '',
      additionalPrompts,
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

/**
 * Create a new default additional prompt item.
 * @returns {Object}
 */
export function createDefaultPromptItem() {
  return {
    id: 'ap-' + Date.now(),
    name: '',
    text: '',
    enabled: true
  };
}
