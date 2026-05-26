export const fromVersion = 4;
export const toVersion = 5;

/**
 * @param {Object} data - Parsed anytale-data JSON
 * @returns {Object} The migrated data object
 */
export function migrate(data) {
  // Parts: rename name → referenceTag, add display name field
  if (Array.isArray(data.parts)) {
    data.parts = data.parts.map(p => {
      const { name, ...rest } = p;
      return { ...rest, referenceTag: name ?? '', name: '' };
    });
  }
  // Characters: add selfProfile and voiceProfile
  if (Array.isArray(data.characters)) {
    data.characters = data.characters.map(c => ({
      ...c,
      selfProfile: c.selfProfile ?? '',
      voiceProfile: c.voiceProfile ?? '',
    }));
  }
  // Outfits: add description
  if (Array.isArray(data.outfits)) {
    data.outfits = data.outfits.map(o => ({
      ...o,
      description: o.description ?? '',
    }));
  }
  // Genres: add disabled flag
  if (Array.isArray(data.genres)) {
    data.genres = data.genres.map(g => ({
      ...g,
      disabled: g.disabled ?? false,
    }));
  }
  return data;
}
