// Tag Definitions Module
// Loads and provides access to Danbooru tag definitions

import { fetchJson } from '../../custom-ui/util.mjs';

let definitions = {};
let isLoaded = false;
let loadPromise = null;

/**
 * Load tag definitions from the server
 * @returns {Promise<Object>} Promise that resolves to the definitions dictionary
 */
export async function loadTagDefinitions() {
  // If already loaded, return the cached definitions
  if (isLoaded) {
    return Promise.resolve(definitions);
  }
  
  // If currently loading, return the existing promise
  if (loadPromise) {
    return loadPromise;
  }
  
  // Create new load promise - fetch from /tags endpoint which includes definitions
  loadPromise = fetchJson('/tags', {}, {
    maxRetries: 3,
    retryDelay: 1000,
    showUserFeedback: false,
    showSuccessFeedback: false
  })
    .then(data => {
      definitions = data.definitions || {};
      isLoaded = true;
      console.log('Tag definitions loaded successfully:', Object.keys(definitions).length, 'definitions');
      return definitions;
    })
    .catch(error => {
      console.error('Error loading tag definitions:', error);
      loadPromise = null; // Reset promise on error so it can be retried
      throw error;
    });
  
  return loadPromise;
}

/**
 * Get the definition for a tag
 * @param {string} tagName - The tag name to look up (with spaces, not underscores)
 * @returns {string|null} The definition if found, null otherwise
 */
export function getTagDefinition(tagName) {
  if (!tagName) return null;
  
  // Normalize the tag name (lowercase, trim whitespace)
  const normalizedName = tagName.toLowerCase().trim();
  
  // Try exact match first
  if (definitions[normalizedName]) {
    return definitions[normalizedName];
  }
  
  // Try case-insensitive search
  const lowerCaseKeys = Object.keys(definitions).map(k => k.toLowerCase());
  const index = lowerCaseKeys.indexOf(normalizedName);
  if (index !== -1) {
    const originalKey = Object.keys(definitions)[index];
    return definitions[originalKey];
  }
  
  return null;
}

/**
 * Check if tag definitions are loaded
 * @returns {boolean} True if definitions are loaded
 */
export function isTagDefinitionsLoaded() {
  return isLoaded;
}

/**
 * Get the count of loaded definitions
 * @returns {number} Number of loaded definitions
 */
export function getTagDefinitionsCount() {
  return Object.keys(definitions).length;
}
