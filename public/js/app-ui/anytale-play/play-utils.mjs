/**
 * Play mode utility helpers — pure functions with no side effects.
 */
import { resolveSlotStatuses, checkPageRequirements, parseRules, applyRules } from '../anytale/slot-resolver.mjs';

/**
 * Controls how multi-slot parts are removed from the prompt based on slot status.
 *
 * true  (default): a part is excluded if ANY of its occupied slots has status 'removed'.
 * false (legacy):  a part is excluded only if ALL of its occupied slots have status 'removed'.
 *
 * Future: this may need to be applied on a per-part basis via part config.
 */
const PART_REMOVED_ON_ANY_SLOT = true;

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
 * @param {Map<string,string>|null} [initialStatuses=null] - when provided, overrides the active-parts
 *   initialisation and uses these slot statuses as the starting state (for cross-chapter continuity).
 * @returns {{ visibleIndices: number[], pageSlotStatuses: Map[] }}
 *   visibleIndices: actual plot page indices that are visible to the player
 *   pageSlotStatuses: Map[] indexed by actual plot page index; post-action slot statuses for prompt assembly
 */
export function computeVisiblePages(activeParts, plot, slotRulesText, initialStatuses = null) {
  const pages = (plot && Array.isArray(plot.pages)) ? plot.pages : [];
  const parsedRules = parseRules(slotRulesText || '');

  // Build initial statuses: use provided initial state (cross-chapter continuity) or compute from active parts.
  let currentStatuses = initialStatuses
    ? new Map(initialStatuses)
    : resolveSlotStatuses(activeParts, [], 0);

  // Requirements are always checked against the state at the start of this plot/chapter,
  // so a part removed mid-plot can still satisfy requirements on later pages.
  const requirementStatuses = new Map(currentStatuses);

  const visibleIndices = [];
  const pageSlotStatuses = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Check requirements against the start-of-chapter statuses (not the evolving mid-plot state)
    const isVisible = checkPageRequirements(page, requirementStatuses, activeParts);
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
    // Slot-status removal check (direct, before visibility rules).
    if (PART_REMOVED_ON_ANY_SLOT) {
      if (types.some(t => slotStatuses.get(t.trim().toLowerCase()) === 'removed')) return false;
    } else {
      if (types.every(t => (slotStatuses.get(t.trim().toLowerCase()) ?? 'removed') === 'removed')) return false;
    }
    // Visibility-rules check (show/hide from applyRules).
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

/**
 * Find all SFX records that match any tag in the given page tags string.
 *
 * Iterates page tags in order (left to right). For each tag, finds the first
 * SFX record (by array order) whose tags contain an exact case-insensitive
 * match. Each SFX uid is collected at most once — at the position of its
 * earliest matching page tag.
 *
 * @param {string} pageTagsString - Comma-separated prompt tags from a plot page
 * @param {Array<{ uid: string, name: string, tags: string[] }>} sfxList
 * @returns {Array<{ sfx: object, matchingTag: string }>}
 */
export function findAllMatchingSfx(pageTagsString, sfxList) {
  const tokens = (pageTagsString || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  const results = [];
  for (const token of tokens) {
    for (const sfx of sfxList) {
      if (seen.has(sfx.uid)) continue;
      if ((sfx.tags || []).some(tag => tag.trim().toLowerCase() === token)) {
        seen.add(sfx.uid);
        results.push({ sfx, matchingTag: token });
        break; // one SFX per token pass; move to next token
      }
    }
  }
  return results;
}

/**
 * Return the first SFX record that matches any tag in the page tags string,
 * or null if none match.
 *
 * @param {string} pageTagsString
 * @param {Array<{ uid: string, tags: string[] }>} sfxList
 * @returns {object|null}
 */
export function findMatchingSfx(pageTagsString, sfxList) {
  return findAllMatchingSfx(pageTagsString, sfxList)[0]?.sfx ?? null;
}

/**
 * Filter raw LLM dialog output before display and history storage.
 *
 * Step 0 — Instruction-block removal:
 *   If the model appended a `### Label: …` instruction block, remove it and
 *   everything that follows.  Only the first occurrence is matched.
 *   e.g. `Hello! ### Instruction: You look surprised.` → `Hello!`
 *
 * Step 1 — Quoted-speech extraction:
 *   If any double-quote character is present (" U+0022, " U+201C, " U+201D),
 *   extract only the content between quoted pairs and join with a space,
 *   discarding surrounding narrator text.
 *   e.g. `"Hello," she said, "goodbye."` → `Hello, goodbye.`
 *
 * Step 2 — Emote / inner-thought removal:
 *   Strip text wrapped in *asterisks* or (parentheses).
 *   e.g. `So, *smiles* and (thinks quietly) that's it.` → `So, and that's it.`
 *
 * Step 3 — Emoji removal:
 *   Remove all pictographic emoji (😉, 🎉, etc.) plus ZWJ/variation-selector
 *   characters used to build emoji sequences.
 *
 * Step 4 — Whitespace normalisation.
 *
 * @param {string} text
 * @returns {string}
 */
export function filterDialogText(text) {
  if (!text) return text;

  // Step 0: Strip any `### Label: …` instruction block appended by the model,
  // along with any whitespace immediately preceding the `###`.
  text = text.replace(/\s*###[^:]+:[\s\S]*/, '');

  // Step 1: Quote extraction — only when at least one quote character is present.
  if (/["“”]/.test(text)) {
    const segments = [];
    // Open: " (U+0022) or " (U+201C).  Close: " (U+0022) or " (U+201D).
    // Content may not contain another open/close quote.
    const re = /[“"]([^"”]*)[”"]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const seg = m[1].trim();
      if (seg) segments.push(seg);
    }
    if (segments.length > 0) text = segments.join(' ');
  }

  // Step 2: Remove *emote markers* and (inner-thought markers).
  text = text.replace(/\*[^*]+\*/g, '');
  text = text.replace(/\([^)]+\)/g, '');

  // Step 3: Remove emoji — covers pictographics, skin-tone modifiers, and flag
  // regional-indicator pairs.  The second pass removes sequence-building code
  // points that may be left behind: U+200D (ZWJ), U+FE0F (variation selector-16),
  // U+20E3 (combining keycap).
  text = text.replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}/gu, '');
  text = text.replace(/‍|️|⃣/g, '');

  // Step 4: Normalise whitespace.
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
