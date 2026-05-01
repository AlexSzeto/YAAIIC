/**
 * prompt-assembler.mjs – Assembles a prompt string from clothing items and rules.
 *
 * 1. Filter to worn items only
 * 2. For each worn item: collect attributes, state, relatedTags
 * 3. Evaluate outfit rules (AND-conditions)
 * 4. Append additionalPrompts
 * 5. Return comma-separated tag string
 */

/**
 * Assemble a prompt from clothing items and additional prompts.
 *
 * @param {Array}  clothingItems    – Full list of clothing items (worn + unworn)
 * @param {Array}  additionalPrompts – Array of { id, name, text, enabled } prompt items
 * @param {Array}  outfitRules       – Rules from outfit-rules.json
 * @returns {string} Comma-separated prompt string
 */
export function assemblePrompt(clothingItems, additionalPrompts, outfitRules) {
  const parts = [];

  // 1. Filter to worn items
  const wornItems = clothingItems.filter(item => item.worn);

  // 2. Collect tags from each worn item
  for (const item of wornItems) {
    // Attributes (array of strings)
    if (item.attributes && item.attributes.length > 0) {
      parts.push(...item.attributes);
    }
    // State (single string)
    if (item.state) {
      parts.push(item.state);
    }
    // Related tags (comma-separated string)
    if (item.relatedTags && item.relatedTags.trim()) {
      const related = item.relatedTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      parts.push(...related);
    }
  }

  // 3. Evaluate outfit rules
  if (outfitRules && Array.isArray(outfitRules)) {
    for (const rule of outfitRules) {
      if (!rule.conditions || !Array.isArray(rule.conditions)) continue;
      const allSatisfied = rule.conditions.every(cond => {
        return clothingItems.some(item =>
          item.worn === cond.worn &&
          item.layer === cond.layer &&
          item.bodyPart === cond.bodyPart
        );
      });
      if (allSatisfied) {
        parts.push(rule.tag);
      }
    }
  }

  // 4. Append additional prompts (array of { text, enabled })
  if (Array.isArray(additionalPrompts)) {
    for (const item of additionalPrompts) {
      if (!item.enabled || !item.text || !item.text.trim()) continue;
      const extra = item.text
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      parts.push(...extra);
    }
  }

  // 5. Deduplicate and join
  const seen = new Set();
  const unique = [];
  for (const tag of parts) {
    const key = tag.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(tag.trim());
    }
  }

  return unique.join(', ');
}
