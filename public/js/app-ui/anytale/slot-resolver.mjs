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

const DEBUG_RULES = true;

// ── resolveSlotStatuses ────────────────────────────────────────────────────

/**
 * Build the ground-truth slot status map by:
 *  1. All slots start as 'removed'.
 *  2. Each type on every active part is set to 'covering' (first occurrence wins).
 *  3. Page actions are replayed from page 0 through currentPageIndex.
 *
 * @param {Array}  activeParts      – Parts entering the slot system ({ config: { type: string[] } } or { type: string[] })
 * @param {Array}  plotPages        – Array of page objects ({ actions: [{ slot, status }] })
 * @param {number} currentPageIndex – Inclusive upper bound for action replay
 * @returns {Map<string, string>}   – Keys are lowercase slot strings; values are status strings
 */
export function resolveSlotStatuses(activeParts, plotPages, currentPageIndex) {
  const statuses = new Map();

  // Slots present in active parts start as 'covering'; all others remain absent (treated as 'removed')
  for (const part of (activeParts || [])) {
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

// ── checkPageRequirements ──────────────────────────────────────────────────

/**
 * Returns true if all of the page's requirements are satisfied by the current
 * slot statuses. A requirement string is satisfied when at least one part in
 * activeParts matches by name OR slot type, and has at least one slot type
 * present in statuses at a non-'removed' value.
 *
 * @param {Object} page        – Page object with optional `requirements: string[]`
 * @param {Map}    statuses    – Current slot status map
 * @param {Array}  activeParts – Parts to match requirements against
 * @returns {boolean}
 */
export function checkPageRequirements(page, statuses, activeParts) {
  const reqs = page?.requirements;
  if (!Array.isArray(reqs) || reqs.length === 0) return true;

  for (const req of reqs) {
    const reqLower = req.trim().toLowerCase();
    if (!reqLower) continue;

    const matchedParts = (activeParts || []).filter(part => {
      const name = (part.config?.name || '').toLowerCase();
      const types = Array.isArray(part.config?.type) ? part.config.type : [];
      return name === reqLower || types.some(t => t.trim().toLowerCase() === reqLower);
    });

    const satisfied = matchedParts.some(part => {
      const types = Array.isArray(part.config?.type) ? part.config.type : [];
      return types.some(t => {
        const key = t.trim().toLowerCase();
        const s = statuses.get(key);
        return s !== undefined && s !== 'removed';
      });
    });

    if (!satisfied) return false;
  }

  return true;
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
  if (!rulesText) {
    throw new Error('No rules text provided - DEBUG IMMEDIATELY');
  }
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
    const pass = cond.operator === 'is' ? matches : !matches;
    if (DEBUG_RULES) {
      console.log(`  condition: <${slotKey}> ${cond.operator} [${cond.status}] → actual=[${actual}] → ${pass ? 'PASS' : 'FAIL'}`);
    }
    if (!pass) return false;
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

  if (DEBUG_RULES) {
    console.group('[slot-resolver] applyRules');
    console.log('slot statuses:', Object.fromEntries(slotStatuses));
    console.log('rules count:', (rules || []).length);
  }
  if(!rules || rules.length === 0) {
    console.error('No rules provided - DEBUG IMMEDIATELY');
  }

  for (const rule of (rules || [])) {
    if (rule.type === 'standard') {
      if (DEBUG_RULES) console.group(`standard rule: ${rule.action} <${rule.target}>`);
      const passed = evaluateConditions(rule.conditions, slotStatuses);
      if (passed) {
        if (visibility.has(rule.target)) {
          visibility.set(rule.target, rule.action === 'show');
          if (DEBUG_RULES) console.log(`  → ${rule.action} <${rule.target}>`);
        } else {
          if (DEBUG_RULES) console.log(`  → target <${rule.target}> not in visibility map, ignored`);
        }
      } else {
        if (DEBUG_RULES) console.log('  → conditions failed, skipped');
      }
      if (DEBUG_RULES) console.groupEnd();
    } else if (rule.type === 'forEach') {
      if (DEBUG_RULES) console.group(`forEach rule: ${rule.action} {slot}`);
      for (const slot of visibility.keys()) {
        if (DEBUG_RULES) console.group(`  iterating slot: <${slot}>`);
        const passed = evaluateConditions(rule.conditions, slotStatuses, slot);
        if (passed) {
          visibility.set(slot, rule.action === 'show');
          if (DEBUG_RULES) console.log(`  → ${rule.action} <${slot}>`);
        } else {
          if (DEBUG_RULES) console.log('  → conditions failed, skipped');
        }
        if (DEBUG_RULES) console.groupEnd();
      }
      if (DEBUG_RULES) console.groupEnd();
    }
  }

  if (DEBUG_RULES) {
    console.log('final visibility:', Object.fromEntries(visibility));
    console.groupEnd();
  }

  return visibility;
}
