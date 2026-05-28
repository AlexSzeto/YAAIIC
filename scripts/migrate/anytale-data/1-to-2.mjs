export const fromVersion = 1;
export const toVersion = 2;

export function migrate(data) {
  for (const part of (data.parts || [])) {
    delete part.isRevealing;
  }
  for (const outfit of (data.outfits || [])) {
    for (const part of (outfit.parts || [])) {
      part.isRevealing = false;
    }
  }
  return data;
}
