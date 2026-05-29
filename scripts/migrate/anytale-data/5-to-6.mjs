export const fromVersion = 5;
export const toVersion = 6;

/**
 * @param {Object} data - Parsed anytale-data JSON (do not set data.version — the migrator handles that)
 * @returns {Object} The migrated data object
 */
export function migrate(data) {
  // Add the SFX library array
  if (!Array.isArray(data.sfx)) {
    data.sfx = [];
  }
  return data;
}
