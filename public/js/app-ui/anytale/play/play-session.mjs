/**
 * Play mode session persistence.
 *
 * Uses localStorage (not sessionStorage) so the session survives tab close and
 * browser restart — deliberate exception to the site-wide sessionStorage convention.
 *
 * Key is distinct from editor keys: anytale-state, anytale-plot,
 * anytale-character, anytale-outfit.
 */

const STORAGE_KEY = 'anytale-play-session';

/**
 * @typedef {Object} CharacterSnapshot
 * @property {string} name
 * @property {string} personality
 * @property {string} portraitUrl
 * @property {Array} parts
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {string} plotUid
 * @property {string} startedAt - ISO timestamp
 * @property {number} pageCount - visible page count for this chapter
 * @property {Object} slotStateAtEntry - slot state snapshot when chapter was entered
 */

/**
 * @typedef {Object} AssetCacheEntry
 * @property {string|null} imageUrl
 * @property {string|null} imageTaskId
 * @property {string} imageStatus - 'pending'|'generating'|'ready'|'error'
 * @property {string|null} dialogText
 * @property {string} dialogStatus
 * @property {string|null} voiceUrl
 * @property {string} voiceStatus
 * @property {string|null} error
 * @property {string} generatedAt - ISO timestamp
 */

/**
 * @typedef {Object} PlaySession
 * @property {string} characterUid
 * @property {CharacterSnapshot} characterSnapshot
 * @property {string} outfitUid
 * @property {string} locationPartUid
 * @property {Object} locationAttributes - { [attrName]: selectedValue }
 * @property {Object} slotState - { [slotType]: 'covered'|'revealing'|'removed' }
 * @property {string} musicGenre
 * @property {Array<TimelineEntry>} timeline
 * @property {Object} assetCache - { [signatureKey]: AssetCacheEntry }
 * @property {string} currentPlotUid
 * @property {number} currentPageIndex
 * @property {string} uiPhase - 'intro'|'mood'|'character-picker'|'plot'|'end-of-chapter'|'end-screen'
 * @property {boolean} muted
 * @property {boolean} musicOn
 * @property {string} navigationMode - 'manual'|'autoplay'
 */

const DEFAULT_SESSION = {
  characterUid: '',
  characterSnapshot: { name: '', personality: '', portraitUrl: '', parts: [] },
  outfitUid: '',
  locationPartUid: '',
  locationAttributes: {},
  slotState: {},
  musicGenre: '',
  timeline: [],
  assetCache: {},
  currentPlotUid: '',
  currentPageIndex: 0,
  uiPhase: 'intro',
  muted: false,
  musicOn: true,
  navigationMode: 'manual',
};

/** Load session from localStorage; merge missing keys with defaults and write the repaired session back. */
export function load() {
  let stored = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    stored = {};
  }

  const merged = {};
  let repaired = false;
  for (const key of Object.keys(DEFAULT_SESSION)) {
    if (key in stored && stored[key] !== null && stored[key] !== undefined) {
      merged[key] = stored[key];
    } else {
      merged[key] = DEFAULT_SESSION[key];
      repaired = true;
    }
  }

  if (repaired) localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

/** Full save — replaces entire session object in localStorage. */
export function save(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/** Shallow-merge partial updates into the stored session. */
export function patch(updates) {
  const current = load();
  save({ ...current, ...updates });
}
