// Tags Management Module
import { fetchJson } from '../../custom-ui/util.mjs';

let tags = [];
let isLoaded = false;
let loadPromise = null;

/**
 * Load tags from the server with enhanced error handling
 * @returns {Promise<Array>} Promise that resolves to the tags array
 */
export async function loadTags() {
  // If already loaded, return the cached tags
  if (isLoaded) {
    return Promise.resolve(tags);
  }
  
  // If currently loading, return the existing promise
  if (loadPromise) {
    return loadPromise;
  }
  
  // Create new load promise with enhanced fetch
  loadPromise = fetchJson('/tags', {}, {
    maxRetries: 3,
    retryDelay: 1000,
    showUserFeedback: false, // Tags load in background, don't show feedback
    showSuccessFeedback: false
  })
    .then(data => {
      tags = data.tags || [];
      isLoaded = true;
      return tags;
    })
    .catch(error => {
      console.error('Error loading tags:', error);
      loadPromise = null; // Reset promise on error so it can be retried
      throw error;
    });
  
  return loadPromise;
}

/**
 * Get the current tags array
 * @returns {Array} The current tags array (may be empty if not loaded)
 */
export function getTags() {
  return [...tags]; // Return a copy to prevent external modification
}

/**
 * Check if a tag exists in the autocomplete list (the same list TagInput uses).
 * Case-insensitive; spaces and underscores are treated as equivalent.
 * @param {string} tagName
 * @returns {boolean}
 */
export function tagExists(tagName) {
  if (!tagName) return false;
  const normalized = tagName.trim().toLowerCase().replace(/\s+/g, '_');
  return tags.some(t => t.toLowerCase().replace(/\s+/g, '_') === normalized);
}

/**
 * Check if tags are loaded
 * @returns {boolean} True if tags are loaded
 */
export function isTagsLoaded() {
  return isLoaded;
}

/**
 * Get tags count
 * @returns {number} Number of loaded tags
 */
export function getTagsCount() {
  return tags.length;
}

// Auto-load tags when the module is imported and DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadTags().catch(error => {
    console.warn('Tags module: Failed to auto-load tags:', error);
  });
});
