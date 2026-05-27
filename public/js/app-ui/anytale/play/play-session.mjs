/**
 * Play mode session persistence.
 *
 * Uses localStorage (not sessionStorage) so the session survives tab close and
 * browser restart — deliberate exception to the site-wide sessionStorage convention.
 *
 * Key is distinct from editor keys: anytale-state, anytale-plot,
 * anytale-character, anytale-outfit.
 *
 * User preferences (muted, musicOn) are intentionally NOT stored here —
 * they live in anytale-play-prefs (play-prefs.mjs) so they survive resets.
 */

import { loadPrefs } from './play-prefs.mjs';

const STORAGE_KEY = 'anytale-play-session';

/**
 * @typedef {Object} SessionCharacter
 * @property {string} uid
 * @property {string} name
 * @property {string} personality
 * @property {string} selfProfile
 * @property {string} portraitUrl
 * @property {string} voiceSampleUrl - URL to character's generated voice audio (used for TTS)
 * @property {string} introTranscript - Text spoken in the voice intro sample
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
 * @property {boolean} muted - sourced from play-prefs, not written here
 * @property {boolean} musicOn - sourced from play-prefs, not written here
 */

const DEFAULT_SESSION = {
  character: { uid: '', name: '', personality: '', selfProfile: '', portraitUrl: '', voiceSampleUrl: '', introTranscript: '', parts: [] },
  outfitUid: '',
  location: { partUid: '', attributeMap: {} },
  music: { genre: '' },
  slotState: {},
  preludePlotUid: '',
  currentPlotUid: '',
  pageIndex: 0,
  phase: 'intro-main',
  introImageUrl: null,
};

/** Load session from localStorage, merge missing keys with defaults, then overlay prefs. */
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

  // Preferences override session defaults — they survive resets independently.
  const prefs = loadPrefs();
  merged.muted = prefs.muted;
  merged.musicOn = prefs.musicOn;

  return merged;
}

/** Full save — replaces entire session object in localStorage (prefs keys are excluded). */
export function save(session) {
  // Strip pref-owned keys so they are never mixed into the session storage.
  const { muted, musicOn, ...rest } = session; // eslint-disable-line no-unused-vars
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
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
