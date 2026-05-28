/**
 * config migration v2 → v3
 *
 * Adds anytale.dialogPreview (preview character used by the plot page editor's
 * "Preview Dialog" button). Introduced alongside the dialog generator feature.
 */

export const fromVersion = 2;
export const toVersion = 3;

export function migrate(config) {
  const anytale = config.anytale ?? {};

  if (!anytale.dialogPreview) {
    anytale.dialogPreview = {
      name: 'Alice',
      location: 'Home',
      profile: 'A cheerful and good natured young woman.',
    };
  }

  return { ...config, anytale };
}
