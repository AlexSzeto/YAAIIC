/**
 * Data domain registry.
 *
 * Maps each tracked data domain to its expected current version and file path.
 * When a migration is added for a domain, bump its `currentVersion` here
 * alongside the migration script in `scripts/migrate/<domain>/`.
 *
 * Domains with no "version" field in their data file are treated as version 0.
 * queue-data is excluded — it is transient and not schema-versioned.
 */
import path from 'path';
import { CONFIG_PATH, DATABASE_DIR, WORKFLOWS_PATH } from './paths.mjs';

export const DATA_DOMAINS = {
  'config':        { currentVersion: 0, filePath: CONFIG_PATH },
  'anytale-data':  { currentVersion: 3, filePath: path.join(DATABASE_DIR, 'anytale-data.json') },
  'media-data':    { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'media-data.json') },
  'brew-data':     { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'brew-data.json') },
  'sound-sources': { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'sound-sources.json') },
  'workflows':     { currentVersion: 1, filePath: WORKFLOWS_PATH },
};
