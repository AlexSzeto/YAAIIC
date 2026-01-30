import { html } from 'htm/preact';
import { Component } from 'preact';
import { glob } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

/**
 * Applies global styles to the document body and base elements.
 * Called on initial load and whenever the theme changes.
 * 
 * @param {Object} theme - The current theme object
 */
function applyGlobalStyles(theme) {
  glob`
    /* CSS Reset */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      min-height: 100vh;
    }

    body {
      font-family: ${theme.typography.fontFamily};
      font-size: ${theme.typography.fontSize.medium};
      line-height: 1.5;
      background-color: ${theme.colors.background.primary};
      color: ${theme.colors.text.primary};
      max-width: 1600px;
      margin: 0 auto;
      padding: 20px;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: ${theme.colors.scrollbar.track};
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: ${theme.colors.scrollbar.thumb};
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: ${theme.colors.scrollbar.thumbHover};
    }

    /* Selection styling */
    ::selection {
      background: ${theme.colors.primary.focus};
      color: ${theme.colors.text.primary};
    }

    /* Link defaults */
    a {
      color: ${theme.colors.primary.background};
      text-decoration: none;
      transition: color ${theme.transitions.fast};
    }

    a:hover {
      color: ${theme.colors.primary.hover};
      text-decoration: underline;
    }

    /* Heading styles */
    h1, h2, h3, h4, h5, h6 {
      font-weight: ${theme.typography.fontWeight.bold};
      line-height: 1.25;
      color: ${theme.colors.text.primary};
    }

    h1 { font-size: 2rem; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    h4 { font-size: 1rem; }

    /* Code/pre styling using monotype */
    code, pre {
      font-family: ${theme.monotype.fontFamily};
      font-size: ${theme.monotype.fontSize.medium};
    }

    code {
      background: ${theme.colors.background.tertiary};
      padding: 2px 6px;
      border-radius: ${theme.spacing.small.borderRadius};
    }

    pre {
      background: ${theme.colors.background.tertiary};
      padding: ${theme.spacing.medium.padding};
      border-radius: ${theme.spacing.medium.borderRadius};
      overflow-x: auto;
    }

    pre code {
      background: none;
      padding: 0;
    }
  `;
}

// Apply initial global styles
applyGlobalStyles(currentTheme.value);

// Subscribe to theme changes and reapply global styles
currentTheme.subscribe((theme) => {
  applyGlobalStyles(theme);
});

/**
 * Page - Root wrapper component providing global theme styles
 * 
 * This component ensures global styles are applied and provides a simple
 * pass-through wrapper for app content. The actual styling is applied to
 * the document body via goober's glob function.
 * 
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children - App content (required)
 * @returns {preact.VNode}
 * 
 * @example
 * <Page>
 *   <App />
 * </Page>
 */
export class Page extends Component {
  render() {
    const { children } = this.props;
    // Simply render children - global styles are applied to body via glob
    return children;
  }
}
