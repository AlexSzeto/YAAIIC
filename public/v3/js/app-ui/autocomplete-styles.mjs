// Autocomplete global styles - injected as a style tag to avoid glob() conflicts
import { getThemeValue } from '../custom-ui/theme.mjs';

// Inject global styles for autocomplete.js
// Uses a direct <style> tag injection to avoid conflicts with goober's glob()
export function injectAutocompleteStyles() {
  // Check if styles already injected
  if (document.getElementById('autocomplete-styles')) {
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.id = 'autocomplete-styles';
  styleTag.textContent = `
    #autoComplete_list_1 {
      background-color: ${getThemeValue('colors.background.secondary')} !important;
      border: 2px solid ${getThemeValue('colors.border.primary')} !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 6px ${getThemeValue('shadow.color')} !important;
      max-height: 200px;
      overflow-y: auto;
      position: fixed !important;
      z-index: 1000 !important;
      min-width: 200px;
      list-style: none !important;
      padding: 0 !important;
      margin: 0 !important;
      font-family: ${getThemeValue('typography.fontFamily')} !important;
      font-size: ${getThemeValue('typography.fontSize.medium')} !important;
    }

    #autoComplete_list_1 li {
      background-color: ${getThemeValue('colors.background.secondary')} !important;
      color: ${getThemeValue('colors.text.primary')} !important;
      padding: 8px 12px !important;
      border-bottom: 1px solid ${getThemeValue('colors.border.secondary')} !important;
      cursor: pointer;
      transition: background-color 0.2s ease;
      list-style: none !important;
      font-family: ${getThemeValue('typography.fontFamily')} !important;
      font-size: ${getThemeValue('typography.fontSize.medium')} !important;
    }

    #autoComplete_list_1 li:hover,
    #autoComplete_list_1 li[aria-selected="true"] {
      background-color: ${getThemeValue('colors.background.hover')} !important;
    }

    #autoComplete_list_1 li:last-child {
      border-bottom: none !important;
    }

    .no_result {
      color: ${getThemeValue('colors.text.muted')} !important;
      font-style: italic;
      padding: 10px 12px !important;
      font-family: ${getThemeValue('typography.fontFamily')} !important;
      font-size: ${getThemeValue('typography.fontSize.medium')} !important;
    }

    #autoComplete_list_1 li mark {
      background-color: ${getThemeValue('colors.primary.highlight')} !important;
      color: ${getThemeValue('colors.text.primary')} !important;
      padding: 0 2px;
      border-radius: 2px;
    }

    #autoComplete_list_1::-webkit-scrollbar {
      width: 8px;
    }

    #autoComplete_list_1::-webkit-scrollbar-track {
      background: ${getThemeValue('colors.scrollbar.track')};
      border-radius: 4px;
    }

    #autoComplete_list_1::-webkit-scrollbar-thumb {
      background: ${getThemeValue('colors.scrollbar.thumb')};
      border-radius: 4px;
    }

    #autoComplete_list_1::-webkit-scrollbar-thumb:hover {
      background: ${getThemeValue('colors.scrollbar.thumbHover')};
    }
  `;
  
  document.head.appendChild(styleTag);
}
