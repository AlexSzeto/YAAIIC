/**
 * Play mode utility helpers — pure functions with no side effects.
 */
import { resolveSlotStatuses, checkPageRequirements, parseRules, applyRules } from '../anytale/slot-resolver.mjs';

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

/**
 * Build active parts array in slot-resolver format from a session's character and outfit.
 * Returns objects of shape { config: { type, isRevealing } } suitable for resolveSlotStatuses.
 *
 * @param {Object} session - play session object
 * @param {Object[]} outfitParts - outfit.parts array (may be [])
 * @param {Map<string, object>} partsMap - uid → PartConfig
 * @returns {Array}
 */
export function buildActiveParts(session, outfitParts, partsMap) {
  const charParts = (session.character?.parts || []).map(p => {
    const config = partsMap.get(p.partUid);
    return config ? { config: { ...config, isRevealing: false } } : null;
  }).filter(Boolean);

  const outParts = (outfitParts || []).map(p => {
    const config = partsMap.get(p.partUid);
    return config ? { config: { ...config, isRevealing: p.isRevealing ?? false } } : null;
  }).filter(Boolean);

  return [...charParts, ...outParts];
}

/**
 * Simulate page-by-page slot evolution to determine which pages are visible.
 *
 * For each page in the plot:
 *   1. Check requirements against current statuses (before this page's actions).
 *   2. If requirements pass, mark page as visible.
 *   3. Apply this page's actions to advance statuses.
 *   4. Record the post-action slot statuses as the snapshot for prompt assembly.
 *
 * @param {Array} activeParts - slot-resolver format parts (from buildActiveParts)
 * @param {Object} plot - full plot object with pages array
 * @param {string} slotRulesText - raw rules text from config.slotRules
 * @returns {{ visibleIndices: number[], pageSlotStatuses: Map[] }}
 *   visibleIndices: actual plot page indices that are visible to the player
 *   pageSlotStatuses: Map[] indexed by actual plot page index; post-action slot statuses for prompt assembly
 */
export function computeVisiblePages(activeParts, plot, slotRulesText) {
  const pages = (plot && Array.isArray(plot.pages)) ? plot.pages : [];
  const parsedRules = parseRules(slotRulesText || '');

  // Build initial statuses from active parts only (no page actions yet)
  let currentStatuses = resolveSlotStatuses(activeParts, [], 0);

  const visibleIndices = [];
  const pageSlotStatuses = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Check requirements against statuses BEFORE this page's actions
    const isVisible = checkPageRequirements(page, currentStatuses, activeParts);
    if (isVisible) visibleIndices.push(i);

    // Apply this page's actions to advance statuses for subsequent pages
    for (const action of (page.actions || [])) {
      const key = (action.slot || '').trim().toLowerCase();
      if (key && currentStatuses.has(key)) {
        currentStatuses.set(key, action.status);
      }
    }

    // Post-action snapshot used for prompt assembly on this page
    pageSlotStatuses.push(new Map(currentStatuses));
  }

  return { visibleIndices, pageSlotStatuses };
}

/**
 * Build the enabledParts array for assemblePrompt using per-page slot statuses.
 * Includes character parts, outfit parts (filtered by slot visibility), and the location part.
 *
 * @param {Object} session - play session
 * @param {Object[]} outfitParts - outfit.parts array
 * @param {Map<string, object>} partsMap - uid → PartConfig
 * @param {Map<string, string>} slotStatuses - post-action slot statuses for this page
 * @param {string} slotRulesText - raw rules text
 * @returns {{ enabledParts: Array, visibility: Map<string, boolean> }}
 */
export function buildEnabledPartsForPage(session, outfitParts, partsMap, slotStatuses, slotRulesText) {
  const parsedRules = parseRules(slotRulesText || '');
  const visibility = applyRules(slotStatuses, parsedRules);

  const rawParts = [
    ...(session.character?.parts || []).map(p =>
      buildPartForPrompt(p.partUid, p.attributeValues, partsMap)
    ),
    ...(outfitParts || []).map(p =>
      buildPartForPrompt(p.partUid, p.attributeValues, partsMap)
    ),
  ].filter(Boolean);

  const enabledParts = rawParts.filter(p => {
    const types = Array.isArray(p.config?.type) ? p.config.type : [];
    if (types.length === 0) return true;
    return types.some(t => visibility.get(t.trim().toLowerCase()) !== false);
  });

  // Location part: mark its slot types visible so assemblePrompt includes it
  if (session.location?.partUid) {
    const locConfig = partsMap.get(session.location.partUid);
    if (locConfig) {
      for (const t of (Array.isArray(locConfig.type) ? locConfig.type : [])) {
        visibility.set(t.trim().toLowerCase(), true);
      }
    }
    const locPart = buildPartForPrompt(session.location.partUid, session.location.attributeMap, partsMap);
    if (locPart) enabledParts.push(locPart);
  }

  return { enabledParts, visibility };
}
