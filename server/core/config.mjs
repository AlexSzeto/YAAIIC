/**
 * Configuration loader.
 * Reads config.json (creating it from config.default.json if absent)
 * and exposes the resulting object.
 */
import fs from 'fs';
import { CONFIG_PATH, DEFAULT_CONFIG_PATH } from './paths.mjs';

let _config = null;

/**
 * Load (or reload) the configuration from disk.
 * @returns {Object} The parsed config object.
 */
export function loadConfig() {
  // Create config.json from default if it does not exist
  if (!fs.existsSync(CONFIG_PATH)) {
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
      fs.copyFileSync(DEFAULT_CONFIG_PATH, CONFIG_PATH);
      console.log('Created config.json from config.default.json');
    } else {
      throw new Error('Neither config.json nor config.default.json found');
    }
  }

  _config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  console.log('Configuration loaded');
  return _config;
}

/**
 * Return the already-loaded config, or throw if loadConfig() has not been
 * called yet.
 * @returns {Object}
 */
export function getConfig() {
  if (!_config) {
    throw new Error('Config not loaded – call loadConfig() first');
  }
  return _config;
}
