import { html } from 'htm/preact';
import { Component } from 'preact';
import { glob, styled } from '../goober-setup.mjs';
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
      background-color: ${theme.colors.background.page};
      color: ${theme.colors.text.primary};
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

    /* Material Symbols icon spin animation */
    @keyframes icon-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .icon-spin {
      animation: icon-spin 1s linear infinite;
    }
  `;
}

// Apply initial global styles
applyGlobalStyles(currentTheme.value);

// Subscribe to theme changes and reapply global styles
currentTheme.subscribe((theme) => {
  applyGlobalStyles(theme);
});

// Standard wrapper: centred column with padding, matching previous body styles.
const PageWrapper = styled('div')`
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px;
`;
PageWrapper.className = 'page-wrapper';

// Full-width wrapper: no padding or max-width constraint (used with noPadding=true).
const PageWrapperFull = styled('div')`
  width: 100%;
`;
PageWrapperFull.className = 'page-wrapper-full';

/**
 * Page - Root wrapper component providing global theme styles.
 *
 * Wraps children in a centred, padded container by default. Pass `noPadding`
 * to suppress the padding and max-width so the content can fill the viewport
 * (e.g. full-screen play mode on mobile).
 *
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children - App content (required)
 * @param {boolean} [props.noPadding=false] - When true, removes padding and max-width constraint
 * @returns {preact.VNode}
 *
 * @example
 * // Standard padded layout
 * <Page>
 *   <App />
 * </Page>
 *
 * @example
 * // Full-screen layout (e.g. play mode)
 * <Page noPadding>
 *   <PlayPage />
 * </Page>
 */
export class Page extends Component {
  render() {
    const { children, noPadding } = this.props;
    const Wrapper = noPadding ? PageWrapperFull : PageWrapper;
    return html`<${Wrapper}>${children}</${Wrapper}>`;
  }
}
