/**
 * config migration v4 → v5
 *
 * Adds sfxWorkflow to the anytale config block, seeding the value from
 * config.default.json so existing installs get the default workflow name.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'server', 'config.default.json');

function readDefaultSfxWorkflow() {
  try {
    const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
    const defaults = JSON.parse(raw);
    return defaults.anytale?.sfxWorkflow || '';
  } catch {
    return '';
  }
}

export const fromVersion = 4;
export const toVersion = 5;

export function migrate(config) {
  if (config.anytale && config.anytale.sfxWorkflow === undefined) {
    return {
      ...config,
      anytale: { ...config.anytale, sfxWorkflow: readDefaultSfxWorkflow() },
    };
  }
  return config;
}
