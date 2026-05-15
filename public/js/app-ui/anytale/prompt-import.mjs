/**
 * prompt-import.mjs – Parse image prompts and match comma-separated tags to library parts.
 */

/**
 * Normalize a tag for case-insensitive comparison.
 * Underscores and runs of whitespace are treated as a single space so
 * prompt tags like `red_hair` match library options like `red hair`.
 * @param {string} tag
 * @returns {string}
 */
export function normalizeTag(tag) {
  return (tag || '')
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function tagsMatch(a, b) {
  return normalizeTag(a) === normalizeTag(b);
}

/**
 * Split a prompt string into trimmed comma-separated tags.
 * @param {string} prompt
 * @returns {string[]}
 */
export function parsePromptTags(prompt) {
  if (!prompt || !prompt.trim()) return [];
  return prompt.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

/**
 * Extract the raw generation prompt from a media item.
 * @param {Object|null} item
 * @returns {string}
 */
export function extractImagePrompt(item) {
  if (!item) return '';
  return (item.prompt || item.positivePrompt || item.description || '').trim();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function splitCommaTags(text) {
  if (!text || !text.trim()) return [];
  return text.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Build empty attribute value map keyed by attribute name.
 * @param {Object} libraryPart
 * @returns {Object<string, string>}
 */
export function buildEmptyAttributeValues(libraryPart) {
  const values = {};
  for (const attr of libraryPart.attributes || []) {
    if (attr?.name) values[attr.name] = '';
  }
  return values;
}

/**
 * Find the first library part where the tag matches baseline or an attribute option.
 * @param {string} tag
 * @param {Array} libraryParts
 * @returns {{ libraryPart: Object, matchKind: 'baseline'|'attribute', attributeName?: string, matchedValue?: string }|null}
 */
export function findTagMatch(tag, libraryParts) {
  const norm = normalizeTag(tag);
  if (!norm) return null;

  for (const part of libraryParts) {
    for (const baselineTag of splitCommaTags(part.baseline)) {
      if (tagsMatch(baselineTag, tag)) {
        return { libraryPart: part, matchKind: 'baseline', matchedValue: baselineTag };
      }
    }
    for (const attr of part.attributes || []) {
      if (!attr?.name) continue;
      for (const opt of splitCommaTags(attr.options)) {
        if (tagsMatch(opt, tag)) {
          return {
            libraryPart: part,
            matchKind: 'attribute',
            attributeName: attr.name,
            matchedValue: opt,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Match parsed prompt tags against the library and build list payloads.
 * @param {Object} options
 * @param {string[]} options.tags
 * @param {Array} options.libraryParts
 * @param {string[]} [options.recommendedCharacterPartTypes]
 * @param {string[]} [options.recommendedOutfitPartTypes]
 * @param {'parts-plot'|'character-only'|'outfit-only'} options.mode
 * @param {Function} options.createDefaultPart
 * @returns {{ parts: Array, characterParts: Array, outfitParts: Array, skipped: string[] }}
 */
export function processPromptImport({
  tags,
  libraryParts,
  recommendedCharacterPartTypes = [],
  recommendedOutfitPartTypes = [],
  mode,
  createDefaultPart,
}) {
  const skipped = [];
  const partsPlotMap = new Map();
  const characterMap = new Map();
  const outfitMap = new Map();

  for (const rawTag of tags) {
    const match = findTagMatch(rawTag, libraryParts);
    if (!match) {
      skipped.push(rawTag);
      continue;
    }

    const { libraryPart, matchKind, attributeName, matchedValue } = match;
    const uid = libraryPart.uid;
    const attributeValue = matchKind === 'attribute' && matchedValue
      ? matchedValue
      : rawTag.trim();

    if (mode === 'parts-plot') {
      let part = partsPlotMap.get(uid);
      if (!part) {
        part = createDefaultPart();
        part.config = { ...libraryPart };
        part.data = {
          enabled: true,
          attributeValues: buildEmptyAttributeValues(libraryPart),
          previewImageUrl: '',
        };
        partsPlotMap.set(uid, part);
      }
      if (matchKind === 'attribute' && attributeName) {
        part.data.attributeValues[attributeName] = attributeValue;
      }
      continue;
    }

    const partTypes = (libraryPart.type || []).map(t => t.toLowerCase());
    const isCharType = recommendedCharacterPartTypes.some(t => partTypes.includes(t.toLowerCase()));
    const isOutfitType = recommendedOutfitPartTypes.some(t => partTypes.includes(t.toLowerCase()));
    const targetMaps = [];
    if (mode === 'character-only') {
      if (isCharType || (!isCharType && !isOutfitType)) targetMaps.push(characterMap);
    } else if (mode === 'outfit-only') {
      if (isOutfitType || (!isCharType && !isOutfitType)) targetMaps.push(outfitMap);
    }

    for (const map of targetMaps) {
      let entry = map.get(uid);
      if (!entry) {
        entry = {
          partUid: uid,
          attributeValues: buildEmptyAttributeValues(libraryPart),
          previewImageUrl: '',
        };
        map.set(uid, entry);
      }
      if (matchKind === 'attribute' && attributeName) {
        entry.attributeValues[attributeName] = attributeValue;
      }
    }
  }

  return {
    parts: Array.from(partsPlotMap.values()),
    characterParts: Array.from(characterMap.values()),
    outfitParts: Array.from(outfitMap.values()),
    skipped,
  };
}
