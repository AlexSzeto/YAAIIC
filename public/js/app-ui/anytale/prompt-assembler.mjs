/**
 * prompt-assembler.mjs – Assembles prompt strings from Parts data.
 *
 * Two modes:
 *   1. assemblePrompt(parts, activePage, slotVisibility) – Final image prompt from visible parts.
 *      Collects baseline + attribute values. Excludes previewBaseline.
 *   2. assemblePartPreviewPrompt(part) – Per-part preview prompt.
 *      Collects previewBaseline + baseline + attribute values from a single part.
 *
 * Both deduplicate (case-insensitive) and return a comma-separated string.
 */

/**
 * Collect tags from a comma-separated string.
 * @param {string} text
 * @returns {string[]}
 */
function splitTags(text) {
  if (!text || !text.trim()) return [];
  return text.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

/**
 * Collect attribute values from a values map (keyed by index).
 * @param {Object} valuesMap - { [index]: 'selected_tag' }
 * @returns {string[]}
 */
function collectValues(valuesMap) {
  if (!valuesMap || typeof valuesMap !== 'object') return [];
  return Object.values(valuesMap).filter(v => typeof v === 'string' && v.trim().length > 0);
}

/**
 * Deduplicate tags case-insensitively, preserving first occurrence casing.
 * @param {string[]} tags
 * @returns {string[]}
 */
function deduplicate(tags) {
  const seen = new Set();
  const unique = [];
  for (const tag of tags) {
    const key = tag.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(tag.trim());
    }
  }
  return unique;
}

/**
 * Expand template tokens `{{type name}}` in a tags string using enabled parts.
 *
 * Algorithm per comma/newline-separated segment:
 *  1. Scan for `{{...}}` tokens.
 *  2. For each token, find enabled parts whose config.type matches (case-insensitive).
 *  3. If any token has zero matches → drop the segment.
 *  4. Expand via cartesian product across all matched sets, substituting part names.
 *  5. Segments without tokens are included verbatim.
 *
 * @param {string} tagsString   – Raw tags string (may contain template tokens)
 * @param {Array}  enabledParts – Enabled part objects ({ config })
 * @returns {string[]} Fully expanded flat tag array
 */
export function expandPageTags(tagsString, enabledParts) {
  if (!tagsString || !tagsString.trim()) return [];

  // Split by comma or newline into segments
  const segments = tagsString.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
  const result = [];

  for (const segment of segments) {
    const tokenMatches = [...segment.matchAll(/\{\{([^}]+)\}\}/g)];
    if (tokenMatches.length === 0) {
      // No tokens — include verbatim
      result.push(segment);
      continue;
    }

    // For each token, gather matching part names
    const matchSets = tokenMatches.map(m => {
      const tokenType = m[1].trim().toLowerCase();
      return enabledParts
        .filter(p => {
          const types = Array.isArray(p.config?.type) ? p.config.type : [];
          return types.some(t => t.trim().toLowerCase() === tokenType);
        })
        .map(p => p.config?.referenceTag || '');
    });

    // If any token has no matches, drop the segment
    if (matchSets.some(set => set.length === 0)) continue;

    // Cartesian product across all match sets
    let combinations = [''];
    for (let i = 0; i < tokenMatches.length; i++) {
      const newCombinations = [];
      for (const prefix of combinations) {
        for (const name of matchSets[i]) {
          newCombinations.push(prefix + '\x00' + name);
        }
      }
      combinations = newCombinations;
    }

    // Substitute tokens back into the segment for each combination
    for (const combo of combinations) {
      const names = combo.split('\x00').slice(1); // drop the leading empty prefix
      let expanded = segment;
      for (let i = 0; i < tokenMatches.length; i++) {
        expanded = expanded.replace(tokenMatches[i][0], names[i]);
      }
      result.push(expanded.trim());
    }
  }

  return result;
}

/**
 * Expand template tokens `{{slot type}}` in a dialog prompt string using enabled parts.
 *
 * For each `{{slot type}}` token, finds enabled parts whose config.type includes that
 * slot type (case-insensitive), collects their config.name display values, and substitutes
 * the token with those names joined by " and ". If no parts match a token, substitutes
 * an empty string. Text outside tokens is left unchanged.
 *
 * Unlike expandPageTags (which produces a cartesian product for image prompts), this
 * replaces each token once with all matching names concatenated — suitable for natural
 * language dialog prompts.
 *
 * @param {string} promptText   – Raw dialog prompt (may contain `{{slot type}}` tokens)
 * @param {Array}  enabledParts – Enabled part objects ({ config: { type, name } })
 * @returns {string} The expanded prompt string
 */
export function expandDialogPrompt(promptText, enabledParts) {
  if (!promptText) return promptText || '';
  if (!enabledParts || enabledParts.length === 0) return promptText;

  return promptText.replace(/\{\{([^}]+)\}\}/g, (_match, slotName) => {
    const slotType = slotName.trim().toLowerCase();
    const matchingNames = (enabledParts)
      .filter(p => {
        const types = Array.isArray(p.config?.type) ? p.config.type : [];
        return types.some(t => t.trim().toLowerCase() === slotType);
      })
      .map(p => (p.config?.name || '').trim())
      .filter(n => n.length > 0);
    return matchingNames.join(' and ');
  });
}

/**
 * Assemble the final image prompt from visible parts.
 *
 * Collects: baseline + attributeValues
 * Excludes: previewBaseline
 *
 * When `activePage` is provided, appends the page's `tags` (expanded via expandPageTags).
 * When `slotVisibility` is provided, only parts whose config.type includes at least one
 * visible slot are included. If `slotVisibility` is omitted, all parts are included.
 *
 * @param {Array}  parts           – Array of part objects ({ config, data })
 * @param {Object} [activePage]    – Optional page object from the active plot block
 * @param {Map}    [slotVisibility] – Map<string, boolean> from applyRules; keys are lowercase slot strings
 * @returns {string} Comma-separated prompt string
 */
export function assemblePrompt(parts, activePage, slotVisibility) {
  const tags = [];

  const hiddenSet = new Set(Array.isArray(activePage?.hiddenParts) ? activePage.hiddenParts : []);
  const visibleParts = (parts || []).filter(p => {
    if (!p.config) return false;
    if (p.data?.enabled === false) return false;
    if (hiddenSet.has(p.config.uid)) return false;
    if (!slotVisibility) return true;
    const types = Array.isArray(p.config.type) ? p.config.type : [];
    if (types.length === 0) return true; // Typeless parts don't participate in slot rules — always include
    return types.some(t => slotVisibility.get(t.trim().toLowerCase()) === true);
  });

  // Append the page-level tags, expanded to resolve {{type}} tokens
  if (activePage && activePage.tags) {
    tags.push(...expandPageTags(activePage.tags, visibleParts));
  }

  for (const part of visibleParts) {
    // Attribute values
    const attrValues = part.data?.attributeValues || {};
    const attrValueList = collectValues(attrValues);

    // Baseline tags: excluded only when an attribute value references the reference tag
    const partName = (part.config.referenceTag || '').toLowerCase();
    const attrReferencesPartName = partName && attrValueList.some(v => v.toLowerCase().includes(partName));
    if (!attrReferencesPartName) {
      tags.push(...splitTags(part.config.baseline));
    }

    tags.push(...attrValueList);
  }

  return deduplicate(tags).join(', ');
}

/**
 * Assemble a preview prompt for a single part.
 *
 * Collects: previewBaseline + baseline + attributeValues
 *
 * @param {Object} part – A single part object ({ config, data })
 * @returns {string} Comma-separated prompt string
 */
export function assemblePartPreviewPrompt(part) {
  if (!part || !part.config) return '';

  const tags = [];

  // Preview baseline tags (always included for preview)
  tags.push(...splitTags(part.config.previewBaseline));

  // Attribute values
  const attrValues = part.data?.attributeValues || {};
  const attrValueList = collectValues(attrValues);

  // Baseline tags: excluded only when an attribute value references the reference tag
  const partName = (part.config.referenceTag || '').toLowerCase();
  const attrReferencesPartName = partName && attrValueList.some(v => v.toLowerCase().includes(partName));
  if (!attrReferencesPartName) {
    tags.push(...splitTags(part.config.baseline));
  }

  tags.push(...attrValueList);

  return deduplicate(tags).join(', ');
}
