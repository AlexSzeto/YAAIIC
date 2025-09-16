// Utility functions for common operations

/**
 * Send text to the clipboard with fallback support for older browsers
 * @param {string} text - Text to copy to clipboard
 * @param {string} [successMessage] - Optional message to show on success
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function sendToClipboard(text, successMessage = null) {
  if (!text) {
    console.warn('No content provided to copy to clipboard');
    return false;
  }

  try {
    // Try modern clipboard API first
    await navigator.clipboard.writeText(text);
    console.log('Successfully copied to clipboard:', text);
    
    // Show success message if provided
    if (successMessage && window.showToast) {
      window.showToast(successMessage);
    }
    
    return true;
  } catch (error) {
    console.error('Modern clipboard API failed, trying fallback:', error);
    
    // Fallback for older browsers
    return fallbackCopyToClipboard(text, successMessage);
  }
}

/**
 * Fallback copy method for older browsers using document.execCommand
 * @param {string} text - Text to copy
 * @param {string} [successMessage] - Optional message to show on success
 * @returns {boolean} - True if successful, false otherwise
 */
function fallbackCopyToClipboard(text, successMessage = null) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      console.log('Fallback copy successful');
      
      // Show success message if provided
      if (successMessage && window.showToast) {
        window.showToast(successMessage);
      }
      
      return true;
    } else {
      console.error('Fallback copy failed');
      return false;
    }
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}