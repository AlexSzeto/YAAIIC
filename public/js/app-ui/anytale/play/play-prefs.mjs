/**
 * Play mode user preferences.
 *
 * Stored in a separate localStorage key from the session so they survive
 * session resets (new characters, new playthroughs, etc.).
 *
 * Key: anytale-play-prefs
 */

const PREFS_KEY = 'anytale-play-prefs';

const DEFAULT_PREFS = {
  muted: false,
  musicOn: true,
  sfxOn: true,
};

/** Load preferences, filling in missing keys with defaults. */
export function loadPrefs() {
  let stored = {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    stored = {};
  }
  const merged = {};
  for (const key of Object.keys(DEFAULT_PREFS)) {
    merged[key] = (key in stored && stored[key] !== null && stored[key] !== undefined)
      ? stored[key]
      : DEFAULT_PREFS[key];
  }
  return merged;
}

/** Replace the entire preferences object in localStorage. */
export function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Shallow-merge partial updates into the stored preferences. */
export function patchPrefs(updates) {
  savePrefs({ ...loadPrefs(), ...updates });
}
