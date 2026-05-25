/**
 * Play mode utility helpers — pure functions with no side effects.
 */

/**
 * Pick up to n random unique items from arr (Fisher-Yates partial shuffle).
 * @template T
 * @param {T[]} arr
 * @param {number} n
 * @returns {T[]}
 */
export function randomPickN(arr, n) {
  const copy = [...arr];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/**
 * Split a comma-separated options string into a trimmed, non-empty array.
 * @param {string} optionsString
 * @returns {string[]}
 */
export function splitOptions(optionsString) {
  if (!optionsString) return [];
  return optionsString.split(',').map(o => o.trim()).filter(o => o.length > 0);
}

/**
 * Compute slot state from a combined set of active character and outfit parts.
 *
 * Ranking: 'covered' > 'revealing' > 'removed'
 * A slot starts 'removed'; any active part with that slot type upgrades it.
 * A part where isRevealing=true contributes 'revealing'; otherwise 'covered'.
 *
 * @param {Array<{partUid: string, isRevealing?: boolean}>} activeParts
 * @param {Map<string, {type: string[]}>} partsMap - uid → PartConfig
 * @returns {{ [slotType: string]: 'covered'|'revealing' }}
 */
export function computeSlotState(activeParts, partsMap) {
  const rank = { removed: 0, revealing: 1, covered: 2 };
  const slotState = {};

  for (const part of activeParts) {
    const config = partsMap.get(part.partUid);
    if (!config) continue;
    const types = Array.isArray(config.type) ? config.type : [];
    const status = part.isRevealing ? 'revealing' : 'covered';
    for (const slotType of types) {
      if (!(slotType in slotState) || rank[status] > rank[slotState[slotType]]) {
        slotState[slotType] = status;
      }
    }
  }

  return slotState;
}

/**
 * Check if a plot's slotRequirements are satisfied by the current slotState.
 *
 * 'present' = slot is 'covered' or 'revealing' (any non-removed state)
 * 'absent'  = slot is missing from slotState (no part covers it)
 *
 * @param {{ [slotType: string]: string }} slotState
 * @param {{ [slotType: string]: 'present'|'absent' }} requirements
 * @returns {boolean}
 */
export function checkSlotRequirements(slotState, requirements) {
  if (!requirements || Object.keys(requirements).length === 0) return true;
  for (const [slot, req] of Object.entries(requirements)) {
    const state = slotState[slot];
    if (req === 'present' && (!state || state === 'removed')) return false;
    if (req === 'absent' && state && state !== 'removed') return false;
  }
  return true;
}

/**
 * Build a part object for use with assemblePrompt: { config, data }.
 *
 * @param {string} partUid
 * @param {{ [attrName: string]: string }} attributeValues
 * @param {Map<string, object>} partsMap - uid → PartConfig
 * @returns {{ config: object, data: { enabled: true, attributeValues: object } }|null}
 */
export function buildPartForPrompt(partUid, attributeValues, partsMap) {
  const config = partsMap.get(partUid);
  if (!config) return null;
  return { config, data: { enabled: true, attributeValues: attributeValues || {} } };
}
