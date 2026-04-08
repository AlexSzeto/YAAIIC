/**
 * tag-insertion-util.mjs - Utility for inserting tags into prompts
 * 
 * Provides helper functions for properly formatting and inserting tags
 * into prompt text with correct comma handling.
 */

/**
 * Extract the word at the cursor position in a textarea
 * The word is defined as text from the cursor position to the previous and next
 * comma, line break, or start/end of text.
 * 
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @returns {string} The word at the cursor position, or empty string if none
 * 
 * @example
 * // With text "girl, blue_eyes, long hair" and cursor at position 12 (in "blue_eyes")
 * extractWordAtCursor(textarea) // Returns: "blue_eyes"
 */
export function extractWordAtCursor(textarea) {
  if (!textarea) {
    return '';
  }
  
  const text = textarea.value;
  const cursorPos = textarea.selectionStart;
  
  if (cursorPos === undefined || cursorPos === null) {
    return '';
  }
  
  // Find the start of the word (search backwards for comma, newline, or start)
  let start = cursorPos;
  while (start > 0) {
    const char = text[start - 1];
    if (char === ',' || char === '\n' || char === '\r') {
      break;
    }
    start--;
  }
  
  // Find the end of the word (search forwards for comma, newline, or end)
  let end = cursorPos;
  while (end < text.length) {
    const char = text[end];
    if (char === ',' || char === '\n' || char === '\r') {
      break;
    }
    end++;
  }
  
  // Extract the word and trim whitespace
  const word = text.substring(start, end).trim();
  
  return word;
}

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
