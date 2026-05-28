/**
 * play-cache.mjs – Per-page generated asset cache for play mode.
 *
 * Cache entries are stored in localStorage, keyed by a composite signature so
 * that changing character/outfit/location/slot-state automatically invalidates
 * entries without any explicit clearing logic.
 *
 * Cache entry shape:
 *   {
 *     imageUrl, imageTaskId, imageStatus,
 *     dialogText, dialogStatus,
 *     voiceUrl, voiceTaskId, voiceStatus,
 *     generatedAt
 *   }
 *   where *Status = 'pending'|'generating'|'complete'|'error'|'skipped'
 */

const KEY_PREFIX = 'anytale-play-cache:';

/**
 * Stable djb2 hash of a JSON-serialised object (keys sorted for consistency).
 * @param {object} obj
 * @returns {string}
 */
function hashObj(obj) {
  const str = JSON.stringify(obj, Object.keys(obj || {}).sort());
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * Build the localStorage key for a specific page's generated assets.
 *
 * @param {Object} p
 * @param {string} p.plotUid
 * @param {number} p.pageIndex - actual plot page array index (not visible-page index)
 * @param {string} p.characterUid
 * @param {string} p.outfitUid
 * @param {string} p.locationPartUid
 * @param {Object} p.locationAttributeMap
 * @param {Map|Object} p.slotStatuses - slot status map for this page (from slot-resolver)
 * @returns {string}
 */
export function buildCacheKey({ plotUid, pageIndex, characterUid, outfitUid, locationPartUid, locationAttributeMap, slotStatuses }) {
  const locHash = hashObj(locationAttributeMap || {});
  const ssObj = slotStatuses instanceof Map ? Object.fromEntries(slotStatuses) : (slotStatuses || {});
  const ssHash = hashObj(ssObj);
  return `${KEY_PREFIX}${plotUid}:${pageIndex}:${characterUid}:${outfitUid}:${locationPartUid}:${locHash}:${ssHash}`;
}

/**
 * Read a cache entry by key.
 * @param {string} key
 * @returns {Object|null}
 */
export function getCacheEntry(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Write a cache entry.
 * @param {string} key
 * @param {Object} entry - partial or full entry; `generatedAt` is set automatically
 */
export function setCacheEntry(key, entry) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...entry, generatedAt: Date.now() }));
  } catch {
    // localStorage full — silently swallow
  }
}

/**
 * Shallow-merge updates into an existing cache entry (or create a new one).
 * @param {string} key
 * @param {Object} updates
 */
export function updateCacheEntry(key, updates) {
  const existing = getCacheEntry(key) || {};
  setCacheEntry(key, { ...existing, ...updates });
}

/**
 * Remove every play-mode cache entry from localStorage.
 * Call on session reset so stale generated assets never resurface.
 */
export function clearAllCache() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
}
