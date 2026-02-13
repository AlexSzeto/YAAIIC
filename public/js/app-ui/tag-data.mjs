// Tag Data Module
// Loads and provides access to tag data including definitions and category tree

import { fetchJson } from '../util.mjs';

let definitions = {};
let categoryTree = {};
let tags = [];
let isLoaded = false;
let loadPromise = null;

/**
 * Load tag data from the server (definitions, category tree, and tag list)
 * @returns {Promise<Object>} Promise that resolves when tag data is loaded
 */
export async function loadTagDefinitions() {
  // If already loaded, return cached data
  if (isLoaded) {
    return Promise.resolve({ definitions, categoryTree, tags });
  }
  
  // If currently loading, return the existing promise
  if (loadPromise) {
    return loadPromise;
  }
  
  // Create new load promise - fetch from /tags endpoint which includes all tag data
  loadPromise = fetchJson('/tags', {}, {
    maxRetries: 3,
    retryDelay: 1000,
    showUserFeedback: false,
    showSuccessFeedback: false
  })
    .then(data => {
      definitions = data.definitions || {};
      categoryTree = data.categoryTree || {};
      tags = data.tags || [];
      isLoaded = true;
      console.log('Tag data loaded successfully:', {
        definitions: Object.keys(definitions).length,
        categoryTreeEntries: Object.keys(categoryTree).length,
        tags: tags.length
      });
      return { definitions, categoryTree, tags };
    })
    .catch(error => {
      console.error('Error loading tag data:', error);
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
  
  // Try exact match first
  if (definitions[tagName]) {
    return definitions[tagName];
  }
  
  return null;
}

/**
 * Get the category tree
 * @returns {Object} The category tree object
 */
export function getCategoryTree() {
  return categoryTree;
}

/**
 * Format an internal tag name to a display-friendly name
 * @param {string} internalName - The internal tag name to format
 * @returns {string} The formatted display name
 * 
 * @example
 * formatTagDisplayName("sports_festival")     // Returns: "Sports Festival"
 * formatTagDisplayName("tag_groups/body")     // Returns: "Body"
 * formatTagDisplayName("tag_group:colors")    // Returns: "Colors"
 * formatTagDisplayName("long_hair")           // Returns: "Long Hair"
 */
export function formatTagDisplayName(internalName) {
  if (!internalName) return '';
  
  let name = internalName;
  
  // Remove "tag_groups:" or "tag_group:" prefix
  name = name.replace(/^tag_groups?:/, '');
  
  // Remove text before and including "/"
  const slashIndex = name.lastIndexOf('/');
  if (slashIndex !== -1) {
    name = name.substring(slashIndex + 1);
  }
  
  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');
  
  // Capitalize each word
  name = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name;
}

/**
 * Check if tag data is loaded
 * @returns {boolean} True if tag data is loaded
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

/**
 * Get all tag names
 * @returns {string[]} Array of all tag names
 */
export function getAllTagNames() {
  return Object.keys(definitions);
}
