let cachedData = null;

/**
 * Fetch all data needed for play mode in parallel. Result is cached
 * so subsequent calls return the same object without re-fetching.
 * @returns {Promise<{parts, plots, characters, outfits, config, genres}>}
 */
export async function loadPlayData() {
  if (cachedData) return cachedData;
  const [parts, plots, characters, outfits, config, genres] = await Promise.all([
    fetch('/anytale/parts').then(r => r.json()),
    fetch('/anytale/plot').then(r => r.json()),
    fetch('/anytale/characters').then(r => r.json()),
    fetch('/anytale/outfits').then(r => r.json()),
    fetch('/anytale/config').then(r => r.json()),
    fetch('/anytale/genres').then(r => r.json()),
  ]);
  cachedData = { parts, plots, characters, outfits, config, genres };
  return cachedData;
}

export function clearPlayDataCache() {
  cachedData = null;
}
