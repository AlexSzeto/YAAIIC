/**
 * slot-resolver.mjs – Slot pool, status resolution, rules parsing, and visibility derivation.
 *
 * Exported functions:
 *   resolveSlotStatuses(libraryParts, plotPages, currentPageIndex)
 *     → Map<string, 'covering'|'revealing'|'removed'>
 *
 *   parseRules(rulesText)
 *     → Array<StandardRule|ForEachRule>
 *
 *   applyRules(slotStatuses, rules)
 *     → Map<string, boolean>
 */

// ── resolveSlotStatuses ────────────────────────────────────────────────────

/**
 * Build the ground-truth slot status map by:
 *  1. Collecting all unique types from libraryParts as available slots (status: 'covering').
 *  2. Replaying page actions from page 0 through currentPageIndex.
 *
 * @param {Array}  libraryParts     – All parts from the library ({ config: { type: string[] } } or { type: string[] })
 * @param {Array}  plotPages        – Array of page objects ({ actions: [{ slot, status }] })
 * @param {number} currentPageIndex – Inclusive upper bound for action replay
 * @returns {Map<string, string>}   – Keys are lowercase slot strings; values are status strings
 */
export function resolveSlotStatuses(libraryParts, plotPages, currentPageIndex) {
  const statuses = new Map();

  // Build slot pool from all library parts
  for (const part of (libraryParts || [])) {
    const types = Array.isArray(part.config?.type) ? part.config.type
      : Array.isArray(part.type) ? part.type : [];
    for (const t of types) {
      const key = t.trim().toLowerCase();
      if (key && !statuses.has(key)) statuses.set(key, 'covering');
    }
  }

  // Replay page actions up to and including currentPageIndex
  const pages = plotPages || [];
  const limit = Math.min(currentPageIndex, pages.length - 1);
  for (let i = 0; i <= limit; i++) {
    for (const action of (pages[i]?.actions || [])) {
      const key = (action.slot || '').trim().toLowerCase();
      if (key && statuses.has(key)) {
        statuses.set(key, action.status);
      }
    }
  }

  return statuses;
}

// ── parseRules ─────────────────────────────────────────────────────────────

const SLOT_RE = /<([^>]+)>/g;
const STATUS_RE = /\[([^\]]+)\]/g;
const FOR_EACH_PREFIX = /^check\s+each\s+\{slot\}/i;

/**
 * Parse a single condition fragment: `<slot> is [status]` or `<slot> is not [status]`
 * (or `{slot}` variants for forEach rules).
 *
 * @param {string} fragment
 * @param {boolean} isForEach – if true, accept `{slot}` as the slot sentinel
 * @returns {{ slot: string, operator: 'is'|'is not', status: string }|null}
 */
function parseCondition(fragment, isForEach) {
  const slotMatch = isForEach
    ? fragment.match(/\{slot\}/i)
    : fragment.match(/<([^>]+)>/)
  ;
  const slot = isForEach
    ? (slotMatch ? '{slot}' : null)
    : (slotMatch ? slotMatch[1].trim().toLowerCase() : null);

  if (!slot) return null;

  const statusMatch = fragment.match(/\[([^\]]+)\]/);
  if (!statusMatch) return null;
  const status = statusMatch[1].trim().toLowerCase();

  const operator = /\bis\s+not\b/i.test(fragment) ? 'is not' : 'is';

  return { slot, operator, status };
}

/**
 * Parse a rules text document into an array of rule objects.
 *
 * Standard rule:
 *   if <slot> is [status] (and <slot> is [not] [status])* then show|hide <slot>
 *
 * forEach rule:
 *   check each {slot} if {slot} is [status] (and {slot} is [not] [status])* then show|hide {slot}
 *
 * @param {string} rulesText
 * @returns {Array}
 */
export function parseRules(rulesText) {
  const rules = [];
  if (!rulesText) return rules;

  for (const rawLine of rulesText.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const isForEach = FOR_EACH_PREFIX.test(line);

    // Determine if it's a recognised rule type
    if (!isForEach && !/^if\b/i.test(line)) continue;

    // Strip the forEach prefix before further parsing
    const workLine = isForEach ? line.replace(FOR_EACH_PREFIX, '').trim() : line;

    // Split on "then" (case-insensitive)
    const thenIdx = workLine.search(/\bthen\b/i);
    if (thenIdx === -1) continue;

    const conditionsPart = workLine.slice(0, thenIdx).trim();
    const actionPart = workLine.slice(thenIdx + 4).trim();

    // Parse action: show|hide <slot> or show|hide {slot}
    const actionMatch = isForEach
      ? actionPart.match(/^(show|hide)\s+\{slot\}/i)
      : actionPart.match(/^(show|hide)\s+<([^>]+)>/i);

    if (!actionMatch) continue;
    const action = actionMatch[1].toLowerCase();
    const target = isForEach ? '{slot}' : actionMatch[2].trim().toLowerCase();

    // Parse conditions: strip leading "if", split by "and"
    const conditionsRaw = conditionsPart.replace(/^if\b/i, '').trim();
    const condFragments = conditionsRaw.split(/\band\b/i);
    const conditions = [];
    let valid = true;
    for (const frag of condFragments) {
      const cond = parseCondition(frag.trim(), isForEach);
      if (!cond) { valid = false; break; }
      conditions.push(cond);
    }
    if (!valid || conditions.length === 0) continue;

    if (isForEach) {
      rules.push({ type: 'forEach', conditions, action, target });
    } else {
      rules.push({ type: 'standard', conditions, action, target });
    }
  }

  return rules;
}

// ── applyRules ─────────────────────────────────────────────────────────────

/**
 * Evaluate a set of AND conditions against a slot status map.
 *
 * @param {Array}  conditions   – [{ slot, operator, status }]
 * @param {Map}    slotStatuses – Map<string, string>
 * @param {string} [boundSlot]  – If provided, substitute for '{slot}' references
 * @returns {boolean}
 */
function evaluateConditions(conditions, slotStatuses, boundSlot) {
  for (const cond of conditions) {
    const slotKey = cond.slot === '{slot}' ? boundSlot : cond.slot;
    const actual = slotStatuses.get(slotKey) ?? 'removed';
    const matches = actual === cond.status;
    if (cond.operator === 'is' && !matches) return false;
    if (cond.operator === 'is not' && matches) return false;
  }
  return true;
}

/**
 * Apply a parsed ruleset to derive per-slot visibility.
 *
 * All available slots (those in slotStatuses) start visible.
 * Rules are processed in order; each rule may mutate the visibility map.
 * forEach rules iterate over every available slot.
 *
 * @param {Map}   slotStatuses – Map<string, string> from resolveSlotStatuses
 * @param {Array} rules        – Parsed rules from parseRules
 * @returns {Map<string, boolean>}
 */
export function applyRules(slotStatuses, rules) {
  // All available slots start visible
  const visibility = new Map();
  for (const slot of slotStatuses.keys()) {
    visibility.set(slot, true);
  }

  for (const rule of (rules || [])) {
    if (rule.type === 'standard') {
      if (!evaluateConditions(rule.conditions, slotStatuses)) continue;
      if (visibility.has(rule.target)) {
        visibility.set(rule.target, rule.action === 'show');
      }
    } else if (rule.type === 'forEach') {
      for (const slot of visibility.keys()) {
        if (!evaluateConditions(rule.conditions, slotStatuses, slot)) continue;
        visibility.set(slot, rule.action === 'show');
      }
    }
  }

  return visibility;
}
