/**
 * hamburger-menu.mjs – App-specific hamburger navigation menu.
 *
 * Wires the generic NavPanel with the project's navigation items:
 *   - Home (returns to index.html)
 *   - Workflow Editor (navigates to workflow-editor.html)
 *   - Change Theme (toggles between light and dark themes;
 *     icon reflects the theme that would be applied)
 *
 * @module app-ui/hamburger-menu
 */
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { currentTheme, toggleTheme } from '../custom-ui/theme.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { NavPanel } from '../custom-ui/nav/hamburger-menu.mjs';

/**
 * HamburgerMenu – App navigation trigger + dropdown.
 *
 * Drop this into any page header. It manages its own open/closed state.
 *
 * @returns {preact.VNode}
 */
export function HamburgerMenu() {
  const [open, setOpen]           = useState(false);
  const [themeName, setThemeName] = useState(currentTheme.value.name);

  // Keep themeName in sync so the icon updates when theme changes externally
  useEffect(() => {
    return currentTheme.subscribe((t) => setThemeName(t.name));
  }, []);

  const currentPath = window.location.pathname;

  const items = [
    {
      label: 'Home',
      href:  '/',
      // material symbol name used directly since NavPanel renders icons inline
      icon:  'home',
      active: currentPath === '/' || currentPath === '/index.html',
    },
    {
      label: 'Workflow Editor',
      href:  '/workflow-editor.html',
      icon:  'settings',
      active: currentPath === '/workflow-editor.html',
    },
    {
      label: 'Change Theme',
      // icon reflects the theme that WILL be applied after clicking
      icon:  themeName === 'dark' ? 'sunny' : 'bedtime',
      onClick: () => {
        toggleTheme();
        setThemeName(currentTheme.value.name);
      },
    },
  ];

  return html`
    <${NavPanel}
      open=${open}
      onClose=${() => setOpen(false)}
      items=${items}
    >
      <${Button}
        variant="large-icon"
        icon=${open ? 'x' : 'menu'}
        onClick=${() => setOpen(o => !o)}
        title="Navigation menu"
        aria-label="Navigation menu"
        aria-expanded=${open}
        aria-haspopup="true"
      />
    </${NavPanel}>
  `;
}
