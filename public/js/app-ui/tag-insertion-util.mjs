/**
 * tag-insertion-util.mjs - Utility for inserting tags into prompts
 * 
 * Provides helper functions for properly formatting and inserting tags
 * into prompt text with correct comma handling.
 */

/**
 * Insert a tag into a prompt string with proper comma handling
 * 
 * @param {string} existingPrompt - The current prompt text
 * @param {string} tag - The tag to insert
 * @returns {string} The new prompt with the tag inserted
 * 
 * @example
 * insertTagIntoPrompt('', 'blue_eyes') // Returns: 'blue_eyes'
 * insertTagIntoPrompt('girl', 'blue_eyes') // Returns: 'girl, blue_eyes'
 * insertTagIntoPrompt('girl,', 'blue_eyes') // Returns: 'girl, blue_eyes'
 * insertTagIntoPrompt('girl, ', 'blue_eyes') // Returns: 'girl, blue_eyes'
 */
export function insertTagIntoPrompt(existingPrompt, tag) {
  // Handle empty prompt
  if (!existingPrompt || existingPrompt.trim() === '') {
    return tag;
  }
  
  // Trim the prompt
  const trimmedPrompt = existingPrompt.trim();
  
  // Check if prompt ends with comma
  const endsWithComma = trimmedPrompt.endsWith(',');
  
  // Add separator if needed
  const separator = endsWithComma ? ' ' : ', ';
  
  return trimmedPrompt + separator + tag;
}

/**
 * Create a tag selection handler for use with TagSelectorPanel
 * 
 * @param {Function} getCurrentValue - Function that returns the current prompt value
 * @param {Function} setValue - Function to update the prompt value: (newValue) => void
 * @param {Function} [onClose] - Optional callback to call after insertion
 * @returns {Function} Handler function that accepts a tag name
 * 
 * @example
 * const handleTagSelect = createTagSelectionHandler(
 *   () => formState.description || '',
 *   (newValue) => onFieldChange('description', newValue),
 *   () => setShowTagPanel(false)
 * );
 * 
 * // Use with TagSelectorPanel
 * <TagSelectorPanel onSelect={handleTagSelect} ... />
 */
export function createTagSelectionHandler(getCurrentValue, setValue, onClose) {
  return (tagName) => {
    // Get current prompt value
    const currentPrompt = getCurrentValue();
    
    // Insert tag with proper formatting
    const newPrompt = insertTagIntoPrompt(currentPrompt, tagName);
    
    // Update the value
    setValue(newPrompt);
    
    // Call onClose if provided
    if (onClose) {
      onClose();
    }
  };
}
