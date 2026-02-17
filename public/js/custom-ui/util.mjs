// Utility functions for common operations

/**
 * Configuration for fetch with retry functionality
 */
const DEFAULT_FETCH_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
  retryDelayMultiplier: 2, // exponential backoff
  timeout: 30000, // 30 seconds
  showUserFeedback: true
};

/**
 * Enhanced fetch with retry mechanism, timeout, and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} config - Configuration for retry logic
 * @returns {Promise<Response>} - Enhanced fetch response
 */
export async function fetchWithRetry(url, options = {}, config = {}) {
  const finalConfig = { ...DEFAULT_FETCH_CONFIG, ...config };
  let lastError = null;
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      // Show loading feedback for user
      if (finalConfig.showUserFeedback && attempt === 0 && window.showInfoToast) {
        window.showInfoToast('Loading data...', 2000);
      }
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);
      
      // Make the fetch request
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      // Clear timeout if request completes
      clearTimeout(timeoutId);
      
      // Check if response is ok
      if (!response.ok) {
        throw new FetchError(`HTTP ${response.status}: ${response.statusText}`, response.status, response);
      }
      
      // Success - clear any error feedback
      return response;
      
    } catch (error) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error);
      
      // Don't retry for certain errors
      if (error.name === 'AbortError') {
        throw new FetchError('Request timeout - please try again', 408, null, error);
      }
      
      if (error instanceof FetchError && error.status >= 400 && error.status < 500) {
        // Don't retry client errors (except 408 timeout)
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === finalConfig.maxRetries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = finalConfig.retryDelay * Math.pow(finalConfig.retryDelayMultiplier, attempt);
      console.log(`Retrying in ${delay}ms... (attempt ${attempt + 2}/${finalConfig.maxRetries + 1})`);
      
      // Show retry feedback to user
      if (finalConfig.showUserFeedback && window.showInfoToast) {
        window.showInfoToast(`Retrying request... (${attempt + 2}/${finalConfig.maxRetries + 1})`, delay);
      }
      
      await sleep(delay);
    }
  }
  
  // All retries failed
  const errorMessage = getUserFriendlyErrorMessage(lastError);
  if (finalConfig.showUserFeedback && window.showErrorToast) {
    window.showErrorToast(errorMessage);
  }
  
  throw new FetchError(errorMessage, lastError?.status || 0, null, lastError);
}

/**
 * Enhanced fetch for JSON data with built-in error handling and retry
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} config - Configuration for retry logic
 * @returns {Promise<any>} - Parsed JSON data
 */
export async function fetchJson(url, options = {}, config = {}) {
  try {
    const response = await fetchWithRetry(url, options, config);
    const data = await response.json();
    
    // Show success feedback if configured
    if (config.showSuccessFeedback && window.showSuccessToast) {
      window.showSuccessToast(config.successMessage || 'Data loaded successfully');
    }
    
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // JSON parsing error
      const message = 'Invalid response format received';
      if (config.showUserFeedback && window.showErrorToast) {
        window.showErrorToast(message);
      }
      throw new FetchError(message, 0, null, error);
    }
    throw error;
  }
}

/**
 * Custom error class for fetch operations
 */
export class FetchError extends Error {
  constructor(message, status = 0, response = null, originalError = null) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.response = response;
    this.originalError = originalError;
  }
}

/**
 * Convert technical errors into user-friendly messages
 * @param {Error} error - The error to convert
 * @returns {string} - User-friendly error message
 */
function getUserFriendlyErrorMessage(error) {
  if (!error) return 'An unknown error occurred';
  
  if (error.name === 'AbortError') {
    return 'Request timed out. Please check your connection and try again.';
  }
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Unable to connect to server. Please check your internet connection.';
  }
  
  if (error instanceof FetchError) {
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please refresh the page and try again.';
      case 403:
        return 'Access denied. You do not have permission to access this resource.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'Request timeout. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return error.message || 'An error occurred while fetching data.';
    }
  }
  
  return error.message || 'An unexpected error occurred.';
}

/**
 * Utility function to sleep/wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

/**
 * Parse URL query parameters
 * @param {string} param - The parameter name to retrieve
 * @returns {string|null} - The parameter value or null if not found
 */
export function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Extract a human-readable name from a filename
 * Handles various case formats: camelCase, PascalCase, snake_case, kebab-case, and "Title Case With Spaces"
 * @param {string} filename - The filename to parse (with or without extension)
 * @returns {string|null} - The extracted name in title case with spaces, or null if extraction fails
 */
export function extractNameFromFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }
  
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // If the name is empty after removing extension, return null
  if (!nameWithoutExt) {
    return null;
  }
  
  let words = [];
  
  // Check if it's snake_case or kebab-case (contains _ or -)
  if (nameWithoutExt.includes('_') || nameWithoutExt.includes('-')) {
    // Split by underscores and hyphens
    words = nameWithoutExt.split(/[_-]+/);
  }
  // Check if it's already space-separated
  else if (nameWithoutExt.includes(' ')) {
    words = nameWithoutExt.split(/\s+/);
  }
  // Otherwise, assume it's camelCase or PascalCase
  else {
    // Split on capital letters, keeping the capital with the following word
    // This regex matches: capital letter preceded by lowercase, OR capital letter followed by lowercase and preceded by another capital
    words = nameWithoutExt.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  }
  
  // Filter out empty strings and convert each word to title case
  words = words
    .filter(word => word && word.trim())
    .map(word => {
      word = word.trim().toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  
  // If no valid words were extracted, return null
  if (words.length === 0) {
    return null;
  }
  
  // Join words with spaces
  return words.join(' ');
}

/**
 * Suppresses the default browser context menu on an element and calls a custom handler.
 * 
 * @param {HTMLElement} element - The element to attach the context menu listener to
 * @param {Function} handler - Callback function called when right-click occurs
 *                             Receives object with { x, y, event } properties
 * @returns {Function} Cleanup function to remove the listener
 * 
 * @example
 * const textarea = document.getElementById('my-textarea');
 * const cleanup = suppressContextMenu(textarea, ({ x, y, event }) => {
 *   console.log(`Right-clicked at position: ${x}, ${y}`);
 *   // Show custom menu at cursor position
 *   showCustomMenu(x, y);
 * });
 * 
 * // Later, to remove the listener:
 * cleanup();
 */
export function suppressContextMenu(element, handler) {
  const listener = (event) => {
    event.preventDefault();
    handler({ x: event.clientX, y: event.clientY, event });
  };
  
  element.addEventListener('contextmenu', listener);
  
  return () => element.removeEventListener('contextmenu', listener);
}

/**
 * PageTitleManager - Manages dynamic page title updates
 */
export class PageTitleManager {
  constructor(defaultTitle = '') {
    this.defaultTitle = defaultTitle;
    this.currentTitle = defaultTitle;
  }
  
  /**
   * Update page title with custom text
   * @param {string} title - The title text to display
   */
  update(title) {
    if (!title) return;
    this.currentTitle = `${title} - ${this.defaultTitle}`;
    document.title = this.currentTitle;
  }
  
  /**
   * Reset page title to default
   */
  reset() {
    this.currentTitle = this.defaultTitle;
    document.title = this.defaultTitle;
  }
  
  /**
   * Get the current title
   * @returns {string}
   */
  getTitle() {
    return this.currentTitle;
  }
}

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

/**
 * Set a cookie value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (default: 365)
 */
export function setCookie(name, value, days = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}
