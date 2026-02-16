/**
 * Barrel file – re-exports every core module so consumers can do:
 *   import { getConfig, loadMediaData, SERVER_DIR } from './core/index.mjs';
 */

export * from './paths.mjs';
export * from './config.mjs';
export * from './database.mjs';
