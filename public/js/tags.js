// Tags Management Module
let tags = [];
let isLoaded = false;
let loadPromise = null;

/**
 * Load tags from the server
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
  
  // Create new load promise
  loadPromise = fetch('/tags')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      tags = data.tags || [];
      isLoaded = true;
      console.log('Tags loaded successfully:', tags.length, 'tags');
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
  console.log('Tags module: Auto-loading tags on page load');
  loadTags().catch(error => {
    console.warn('Tags module: Failed to auto-load tags:', error);
  });
});
