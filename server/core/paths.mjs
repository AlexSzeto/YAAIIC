/**
 * Centralized path management for the server.
 * All other modules should import paths from here instead of computing them locally.
 */
import path from 'path';

// Resolve __dirname for ES modules, with Windows fix
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const fixedDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;

/** Root of the `server/` directory */
export const SERVER_DIR = path.resolve(fixedDirname, '..');

/** Root of the project (one level above `server/`) */
export const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');

/** Path to `server/database/` */
export const DATABASE_DIR = path.join(SERVER_DIR, 'database');

/** Path to `server/storage/` (generated media) */
export const STORAGE_DIR = path.join(SERVER_DIR, 'storage');

/** Path to `server/resource/` (workflow JSON files, CSV data) */
export const RESOURCE_DIR = path.join(SERVER_DIR, 'resource');

/** Path to `server/logs/` */
export const LOGS_DIR = path.join(SERVER_DIR, 'logs');

/** Path to `public/` (static front-end assets) */
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

/** Path to `config.json` */
export const CONFIG_PATH = path.join(SERVER_DIR, 'config.json');

/** Path to `config.default.json` */
export const DEFAULT_CONFIG_PATH = path.join(SERVER_DIR, 'config.default.json');

/** Path to `server/database/media-data.json` */
export const MEDIA_DATA_PATH = path.join(DATABASE_DIR, 'media-data.json');

/** Path to `server/resource/workflows/` (individual ComfyUI workflow JSON files) */
export const WORKFLOWS_DIR = path.join(RESOURCE_DIR, 'workflows');

/** Path to `server/resource/comfyui-workflows.json` */
export const WORKFLOWS_PATH = path.join(RESOURCE_DIR, 'comfyui-workflows.json');
