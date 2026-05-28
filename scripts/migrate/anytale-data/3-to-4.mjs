export const fromVersion = 3;
export const toVersion = 4;

/**
 * @param {Object} data - Parsed anytale-data JSON
 * @returns {Object} The migrated data object
 */
export function migrate(data) {
  for (const plot of data.plots ?? []) {
    for (const page of plot.pages ?? []) {
      if (!Array.isArray(page.hiddenParts)) {
        page.hiddenParts = [];
      }
    }
  }
  return data;
}
