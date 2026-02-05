/**
 * theme.mjs - Centralized theming system for custom UI components
 * 
 * This module provides a complete theming solution with:
 * - Spacing sub-theme for consistent sizing (small, medium)
 * - Light and dark color themes
 * - Reactive theme switching
 * - Helper functions for accessing theme values
 * 
 * ## Usage for non-custom-ui components:
 * 
 * ### Accessing current theme values:
 * ```javascript
 * import { currentTheme, getThemeValue } from './theme.mjs';
 * 
 * // Direct access to current theme
 * const bgColor = currentTheme.value.colors.background.primary;
 * 
 * // Or use helper function with dot notation
 * const textColor = getThemeValue('colors.text.primary');
 * ```
 * 
 * ### Subscribing to theme changes:
 * ```javascript
 * import { currentTheme } from './theme.mjs';
 * 
 * // In a Preact component using signals
 * const MyComponent = () => {
 *   const theme = currentTheme.value;
 *   return html`<div style="color: ${theme.colors.text.primary}">...</div>`;
 * };
 * 
 * // Or subscribe manually
 * currentTheme.subscribe((theme) => {
 *   document.body.style.backgroundColor = theme.colors.background.primary;
 * });
 * ```
 */

// ============================================================================
// Spacing Sub-Theme
// ============================================================================

const spacingSubTheme = {
  spacing: {
    small: {
      padding: '8px',
      buttonPadding: '0 8px',
      margin: '4px',
      borderRadius: '4px',
      gap: '8px'
    },
    medium: {
      padding: '16px',
      buttonPadding: '8px 16px',
      margin: '16px',
      borderRadius: '8px',
      gap: '16px'
    },
    large: {
      padding: '16px',
      buttonPadding: '16px 32px',
      margin: '16px',
      borderRadius: '16px',
      gap: '24px'
    }
  },
  border: {
    width: '2px',
    style: 'solid'
  },
  transitions: {
    fast: '0.15s ease',
    normal: '0.25s ease',
    slow: '0.4s ease'
  },
  sizing: {
    small: {
      width: '200px',
      height: '200px'
    },
    medium: {
      width: '400px',
      height: '400px'
    },
    large: {
      width: '800px',
      height: '800px'
    }
  }
};

// ============================================================================
// Typography Sub-Themes
// ============================================================================

const arialTypographySubTheme = {
  typography: {
    fontFamily: 'Arial, sans-serif',
    fontSize: {
      small: '12px',
      medium: '14px',
      large: '16px'
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      bold: '600'
    }
  }
};

const typographySubTheme = {
  typography: {
    fontFamily: '"Figtree", sans-serif',
    fontSize: {
      small: '12px',
      medium: '14px',
      large: '16px'
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      bold: '600'
    }
  }
};

// ============================================================================
// Monotype Sub-Theme
// ============================================================================

const monotypeSubTheme = {
  monotype: {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: {
      small: '11px',
      medium: '13px',
      large: '15px'
    }
  }
};

// ============================================================================
// Shadow Sub-Theme
// ============================================================================

const shadowSubTheme = {
  light: {
    shadow: {
      color: 'rgba(0, 0, 0, 0.15)',
      colorStrong: 'rgba(0, 0, 0, 0.25)',
      elevated: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15)'
    }
  },
  dark: {
    shadow: {
      color: 'rgba(0, 0, 0, 0.3)',
      colorStrong: 'rgba(0, 0, 0, 0.3)',
      elevated: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.3)'
    }
  }
};

// ============================================================================
// Color Themes
// ============================================================================

const lightColors = {
  // Primary Color Theme
  primary: {
    background: '#007bff',
    hover: '#0056b3',
    active: '#004085',
    focus: 'rgba(0, 123, 255, 0.5)',
    highlight: '#007acc',
    backgroundLight: '#e7f3ff',
    border: '#99ccff',
    text: '#ffffff'
  },
  // Secondary Color Theme
  secondary: {
    background: '#6c757d',
    hover: '#545b62',
    active: '#3d4449',
    focus: 'rgba(108, 117, 125, 0.5)',
    backgroundLight: '#e9ecef',
    border: '#ced4da',
    text: '#ffffff'
  },
  // Success Color Theme
  success: {
    background: '#28a745',
    hover: '#218838',
    active: '#1e7e34',
    focus: 'rgba(40, 167, 69, 0.5)',
    backgroundLight: '#d4edda',
    border: '#9fdfb0',
    text: '#ffffff'
  },
  // Danger Color Theme
  danger: {
    background: '#dc3545',
    hover: '#c82333',
    active: '#bd2130',
    border: '#dc3545',
    borderHover: '#c82333',
    backgroundLight: '#f8d7da',
    focus: 'rgba(220, 53, 69, 0.5)',
    text: '#ffffff'
  },
  // Background Colors
  background: {
    primary: '#ffffff',
    secondary: '#f8f9fa',
    tertiary: '#e9ecef',
    card: '#f8f9fa',
    hover: '#f1f1f1',
    disabled: '#e9ecef'
  },
  // Border Colors
  border: {
    primary: '#dee2e6',
    secondary: '#ced4da',
    focus: '#80bdff',
    highlight: '#007bff'
  },
  // Text Colors
  text: {
    primary: '#212529',
    secondary: '#495057',
    muted: '#6c757d',
    placeholder: '#adb5bd',
    disabled: '#868e96',
    inverse: '#ffffff'
  },
  // UI Component Colors
  overlay: {
    background: 'rgba(0, 0, 0, 0.5)',
    backgroundStrong: 'rgba(0, 0, 0, 0.8)',
    glass: 'rgba(255, 255, 255, 0.85)'
  },
  focus: {
    shadowPrimary: 'rgba(0, 123, 255, 0.25)',
    shadowWhite: 'rgba(255, 255, 255, 0.3)'
  },
  scrollbar: {
    track: '#f1f1f1',
    thumb: '#c1c1c1',
    thumbHover: '#a1a1a1'
  },
  // Loading spinner color (darker for light backgrounds)
  spinner: {
    color: '#333333'
  }
};

const darkColors = {
  // Primary Color Theme
  primary: {
    background: '#007bff',
    hover: '#0056b3',
    active: '#004085',
    focus: 'rgba(0, 123, 255, 0.5)',
    highlight: '#007acc',
    backgroundLight: '#1a3a52',
    border: '#2d5a8c',
    text: '#ffffff'
  },
  // Secondary Color Theme
  secondary: {
    background: '#6c757d',
    hover: '#545b62',
    active: '#3d4449',
    focus: 'rgba(108, 117, 125, 0.5)',
    backgroundLight: '#3a3f44',
    border: '#5a6268',
    text: '#ffffff'
  },
  // Success Color Theme
  success: {
    background: '#28a745',
    hover: '#218838',
    active: '#1e7e34',
    focus: 'rgba(40, 167, 69, 0.5)',
    backgroundLight: '#1e4d2b',
    border: '#2d7a3f',
    text: '#ffffff'
  },
  // Danger Color Theme
  danger: {
    background: '#dc3545',
    hover: '#c82333',
    active: '#bd2130',
    border: '#dc3545',
    borderHover: '#c82333',
    backgroundLight: '#4d1f23',
    focus: 'rgba(220, 53, 69, 0.5)',
    text: '#ffffff'
  },
  // Background Colors
  background: {
    primary: '#121212',
    secondary: '#1e1e1e',
    tertiary: '#2a2a2a',
    card: '#1e1e1e',
    hover: '#404040',
    disabled: '#2a2a2a'
  },
  // Border Colors
  border: {
    primary: '#333333',
    secondary: '#444444',
    focus: '#555555',
    highlight: '#ffffff'
  },
  // Text Colors
  text: {
    primary: '#ffffff',
    secondary: '#cccccc',
    muted: '#999999',
    placeholder: '#666666',
    disabled: '#888888',
    inverse: '#121212'
  },
  // UI Component Colors
  overlay: {
    background: 'rgba(0, 0, 0, 0.5)',
    backgroundStrong: 'rgba(0, 0, 0, 0.8)',
    glass: 'rgba(40, 40, 40, 0.6)'
  },
  focus: {
    shadowPrimary: 'rgba(255, 255, 255, 0.6)',
    shadowWhite: 'rgba(255, 255, 255, 0.3)'
  },
  scrollbar: {
    track: '#1e1e1e',
    thumb: '#555555',
    thumbHover: '#666666'
  },
  // Loading spinner color (lighter for dark backgrounds)
  spinner: {
    color: '#ffffff'
  }
};

// ============================================================================
// Merged Themes
// ============================================================================

export const themes = {
  light: { ...spacingSubTheme, ...typographySubTheme, ...monotypeSubTheme, ...shadowSubTheme.light, colors: lightColors, name: 'light' },
  dark: { ...spacingSubTheme, ...typographySubTheme, ...monotypeSubTheme, ...shadowSubTheme.dark, colors: darkColors, name: 'dark' }
};

// ============================================================================
// Reactive Theme Store
// ============================================================================

/**
 * Simple reactive store for current theme
 * Supports subscriptions for reactive updates
 */
function createThemeStore(initialTheme) {
  let value = initialTheme;
  const subscribers = new Set();

  return {
    get value() {
      return value;
    },
    set value(newValue) {
      value = newValue;
      subscribers.forEach(fn => fn(value));
    },
    subscribe(fn) {
      subscribers.add(fn);
      fn(value); // Call immediately with current value
      return () => subscribers.delete(fn);
    }
  };
}

/**
 * Current theme reactive store
 * Subscribe to get notified when the theme changes
 * Default theme is based on browser's preferred color scheme
 * 
 * @type {{ value: typeof themes.dark, subscribe: (fn: (theme: typeof themes.dark) => void) => () => void }}
 */
const getDefaultTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? themes.dark : themes.light;
  }
  return themes.dark; // Fallback to dark if matchMedia not available
};

export const currentTheme = createThemeStore(getDefaultTheme());

// ============================================================================
// Public API
// ============================================================================

/**
 * Set the current theme by name
 * 
 * @param {'light'|'dark'} themeName - Name of the theme to activate
 * @throws {Error} If theme name is not found
 * 
 * @example
 * setTheme('dark');
 * setTheme('light');
 */
export function setTheme(themeName) {
  if (!themes[themeName]) {
    throw new Error(`Theme "${themeName}" not found. Available themes: ${Object.keys(themes).join(', ')}`);
  }
  currentTheme.value = themes[themeName];
}

/**
 * Toggle between light and dark themes
 * 
 * @returns {string} The name of the newly active theme
 * 
 * @example
 * toggleTheme(); // Switches from dark to light or vice versa
 */
export function toggleTheme() {
  const newTheme = currentTheme.value.name === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  return newTheme;
}

/**
 * Get a specific value from the current theme using dot notation
 * 
 * @param {string} path - Dot-notation path to the theme value (e.g., 'colors.primary.background')
 * @returns {*} The theme value at the specified path, or undefined if not found
 * 
 * @example
 * getThemeValue('colors.primary.background'); // '#007bff'
 * getThemeValue('spacing.medium.padding'); // '8px 16px'
 * getThemeValue('colors.text.primary'); // '#ffffff' (in dark theme)
 */
export function getThemeValue(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], currentTheme.value);
}

/**
 * Get all available theme names
 * 
 * @returns {string[]} Array of available theme names
 * 
 * @example
 * getAvailableThemes(); // ['light', 'dark']
 */
export function getAvailableThemes() {
  return Object.keys(themes);
}
