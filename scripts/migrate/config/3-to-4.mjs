/**
 * config migration v3 → v4
 *
 * Adds workflowInputTemplates (array of extraInput template objects used by
 * the workflow editor's "Use template" feature). Seeds from config.default.json
 * so existing installs get the default templates; falls back to [] if the
 * default file is missing or malformed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'server', 'config.default.json');

function readDefaultTemplates() {
  try {
    const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
    const defaults = JSON.parse(raw);
    return Array.isArray(defaults.workflowInputTemplates)
      ? defaults.workflowInputTemplates
      : [];
  } catch {
    return [];
  }
}

export const fromVersion = 3;
export const toVersion = 4;

export function migrate(config) {
  if (!Array.isArray(config.workflowInputTemplates)) {
    return { ...config, workflowInputTemplates: readDefaultTemplates() };
  }
  return config;
}
