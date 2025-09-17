// Autocomplete Setup Module
import { loadTags, getTags, isTagsLoaded } from './tags.js';

let autoCompleteJS = null;

// Function to get current description text
export function getCurrentDescription() {
  const textarea = document.getElementById('description');
  return textarea ? textarea.value : '';
}

// Helper function to find the start and end indices of the current tag at cursor position
function getCurrentTextareaTagStartEnd(textarea) {
  const cursorPos = textarea.selectionStart;
  const text = textarea.value;
  
  // Find the boundaries of the current tag (between commas or start/end of text)
  let startPos = 0;
  let endPos = text.length;
  
  // Find the last comma before cursor
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === ',' || text[i] === '\n') {
      startPos = i + 1;
      break;
    }
  }
  
  // Find the next comma after cursor
  for (let i = cursorPos; i < text.length; i++) {
    if (text[i] === ',' || text[i] === '\n') {
      endPos = i;
      break;
    }
  }
  
  return [startPos, endPos];
}

function initAutoComplete() {
  const textarea = document.getElementById('description');
  const tags = getTags();
  
  if (tags.length === 0) {
    console.warn('No tags available for autocomplete');
    return;
  }

  // Add keydown event listener to handle tab key behavior (ESC is handled via events config)
  textarea.addEventListener('keydown', function(event) {
    // Check if tab key is pressed and autocomplete list is open
    if (event.key === 'Tab' && autoCompleteJS && autoCompleteJS.isOpen) {
      event.preventDefault();
      
      // If no item is currently selected (cursor is -1), select the first item
      if (autoCompleteJS.cursor < 0) {
        autoCompleteJS.goTo(0);
      }
      
      // Let autoComplete.js handle the tab selection
    }
  });

  // Initialize autoComplete.js
  autoCompleteJS = new autoComplete({
    selector: "#description",
    placeHolder: "Type to search for tags...",
    query: (input) => {
      // Check if autocomplete is disabled for the current workflow
      if (textarea.hasAttribute('data-autocomplete-disabled')) {
        return null; // Return null to prevent autocomplete from showing
      }
      
      // Get current cursor position and text boundaries
      const [startPos, endPos] = getCurrentTextareaTagStartEnd(textarea);
      const text = textarea.value;
      
      // Extract and trim the current tag being typed
      const currentTag = text.substring(startPos, endPos).trim();
      return currentTag;
    },
    data: {
      src: tags,
      cache: true,
    },
    resultsList: {
      tabSelect: true,
      maxResults: 30,
    },
    resultItem: {
      highlight: true
    },
    events: {
      input: {
        // Override the default keydown handler to fix ESC key clearing input
        keydown: (event) => {
            // Check if autocomplete is disabled for the current workflow
            if (textarea.hasAttribute('data-autocomplete-disabled')) {
              return; // Don't handle any autocomplete keys if disabled
            }
            
            if(autoCompleteJS && !autoCompleteJS.isOpen) return;            
          // Import navigate function behavior but fix ESC handling
          switch (event.keyCode) {
            // Down/Up arrow
            case 40:
            case 38:              
              event.preventDefault();
              // Move cursor based on pressed key
              event.keyCode === 40 ? autoCompleteJS.next() : autoCompleteJS.previous();
              break;
            // Enter
            case 13:
              if (!autoCompleteJS.submit) event.preventDefault();
              if (autoComplete && autoCompleteJS.isOpen && autoCompleteJS.cursor < 0 ) {
                autoCompleteJS.goTo(0);
              }
              // If cursor moved
              if (autoCompleteJS.cursor >= 0) autoCompleteJS.select();
              break;
            // Tab
            case 9:
              // Select on Tab if enabled
              if (autoCompleteJS.resultsList.tabSelect && autoCompleteJS.cursor >= 0) {
                autoCompleteJS.select();
              }
              break;
            // Esc - FIXED: Don't clear input, just close the list
            case 27:
              // Just close the list without clearing input
              autoCompleteJS.close();
              break;
          }
        },
        open: (event) => {
          // Check if autocomplete is disabled for the current workflow
          if (textarea.hasAttribute('data-autocomplete-disabled')) {
            // Close the autocomplete immediately if it somehow opened when disabled
            autoCompleteJS.close();
            return;
          }
          
          // Position the results list at cursor position using textarea-caret-position library
          const caretPos = getCaretCoordinates(textarea, textarea.selectionStart);
          const list = autoCompleteJS.list;
          const textareaRect = textarea.getBoundingClientRect();
          
          list.style.position = 'fixed';
          list.style.left = (textareaRect.left + caretPos.left) + 'px';
          list.style.top = (textareaRect.top + caretPos.top + caretPos.height) + 'px';
          list.style.zIndex = '1000';
        },
        selection: (event) => {
          // Check if autocomplete is disabled for the current workflow
          if (textarea.hasAttribute('data-autocomplete-disabled')) {
            return; // Don't handle selection if disabled
          }
          
          const selection = event.detail.selection.value;
          const currentText = textarea.value;
          
          // Find the boundaries of the current tag using helper function
          const [startPos, endPos] = getCurrentTextareaTagStartEnd(textarea);
          
          // Replace only the current tag with the selected tag
          const textBefore = currentText.substring(0, startPos);
          const textAfter = currentText.substring(endPos);
          textarea.value = textBefore + (textBefore === '' ? '' : ' ') + selection + ', ' + textAfter.replace(/^,\s?/, '');

          // Move cursor position after the inserted tag and comma
          const newCursorPos = startPos + selection.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    }
  });
}

// Initialize autocomplete when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Wait for tags to be loaded (they should auto-load, but ensure they're ready)
    await loadTags();
    console.log('Autocomplete: Tags ready, initializing autocomplete');
    initAutoComplete();
  } catch (error) {
    console.error('Autocomplete: Error loading tags:', error);
  }
});
