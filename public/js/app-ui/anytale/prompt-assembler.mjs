/**
 * prompt-assembler.mjs – Assembles prompt strings from Parts data.
 *
 * Two modes:
 *   1. assemblePrompt(parts) – Final image prompt from all enabled parts.
 *      Collects baseline + category/custom attribute values. Excludes previewBaseline.
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
 * Assemble the final image prompt from all enabled parts.
 *
 * Collects: baseline + categoryAttributeValues + customAttributeValues
 * Excludes: previewBaseline
 *
 * @param {Array} parts – Array of part objects ({ config, data })
 * @returns {string} Comma-separated prompt string
 */
export function assemblePrompt(parts) {
  const tags = [];

  const enabledParts = (parts || []).filter(p => p.data && p.data.enabled);

  for (const part of enabledParts) {
    // Baseline tags
    tags.push(...splitTags(part.config.baseline));

    // Category attribute selected values
    tags.push(...collectValues(part.data.categoryAttributeValues));

    // Custom attribute selected values
    tags.push(...collectValues(part.data.customAttributeValues));
  }

  return deduplicate(tags).join(', ');
}

/**
 * Assemble a preview prompt for a single part.
 *
 * Collects: previewBaseline + baseline + categoryAttributeValues + customAttributeValues
 *
 * @param {Object} part – A single part object ({ config, data })
 * @returns {string} Comma-separated prompt string
 */
export function assemblePartPreviewPrompt(part) {
  if (!part || !part.config) return '';

  const tags = [];

  // Preview baseline tags (preview only)
  tags.push(...splitTags(part.config.previewBaseline));

  // Baseline tags
  tags.push(...splitTags(part.config.baseline));

  // Category attribute selected values
  tags.push(...collectValues(part.data?.categoryAttributeValues));

  // Custom attribute selected values
  tags.push(...collectValues(part.data?.customAttributeValues));

  return deduplicate(tags).join(', ');
}
