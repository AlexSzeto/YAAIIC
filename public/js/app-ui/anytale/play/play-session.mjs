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
 * @typedef {Object} SessionCharacter
 * @property {string} uid
 * @property {string} name
 * @property {string} personality
 * @property {string} portraitUrl
 * @property {import('../../server/features/anytale/repository.mjs').CharacterPart[]} parts
 */

/**
 * @typedef {Object} SessionLocation
 * @property {string} partUid
 * @property {{ [attrName: string]: string|null }} attributeMap
 */

/**
 * @typedef {Object} PlaySession
 * @property {SessionCharacter} character
 * @property {string} outfitUid
 * @property {SessionLocation} location
 * @property {{ genre: string }} music
 * @property {{ [slotType: string]: 'covered'|'revealing'|'removed' }} slotState
 * @property {string} preludePlotUid
 * @property {string} currentPlotUid - UID of the chapter plot currently being played
 * @property {number} pageIndex - 0-based index into the visible pages array for the current chapter
 * @property {string} phase - 'intro-main'|'intro-mood'|'character-pick'|'outfit-pick'|'location-pick'|'music-pick'|'plot'
 * @property {string|null} introImageUrl
 * @property {boolean} muted
 * @property {boolean} musicOn
 */

const DEFAULT_SESSION = {
  character: { uid: '', name: '', personality: '', portraitUrl: '', parts: [] },
  outfitUid: '',
  location: { partUid: '', attributeMap: {} },
  music: { genre: '' },
  slotState: {},
  preludePlotUid: '',
  currentPlotUid: '',
  pageIndex: 0,
  phase: 'intro-main',
  introImageUrl: null,
  muted: false,
  musicOn: true,
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

/** Clear the session from localStorage (triggers cold-start bootstrap on next load). */
export function clear() {
  localStorage.removeItem(STORAGE_KEY);
}
