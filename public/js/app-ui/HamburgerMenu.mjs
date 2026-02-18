/**
 * HamburgerMenu.mjs - Global navigation hamburger menu
 *
 * Fixed-position menu button in the top-right corner of every page.
 * Clicking it toggles a dropdown nav menu with links to all pages.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Icon } from '../custom-ui/layout/icon.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const MenuRoot = styled('div')`
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 9000;
`;
MenuRoot.className = 'hamburger-menu-root';

const MenuButton = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${props => props.theme.spacing.small.borderRadius};
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  background-color: ${props => props.theme.colors.background.card};
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
  transition: background-color ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.background.hover};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.border};
  }
`;
MenuButton.className = 'hamburger-menu-button';

const Dropdown = styled('div')`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  background-color: ${props => props.theme.colors.background.card};
  box-shadow: ${props => props.theme.shadow.elevated};
  overflow: hidden;
  opacity: ${props => props.open ? '1' : '0'};
  transform: translateY(${props => props.open ? '0' : '-6px'});
  pointer-events: ${props => props.open ? 'auto' : 'none'};
  transition: opacity ${props => props.theme.transitions.fast},
              transform ${props => props.theme.transitions.fast};
`;
Dropdown.className = 'hamburger-dropdown';

const NavItem = styled('a')`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  text-decoration: none;
  color: ${props => props.active ? props.theme.colors.primary.text : props.theme.colors.text.primary};
  background-color: ${props => props.active ? props.theme.colors.primary.backgroundLight : 'transparent'};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-weight: ${props => props.active ? props.theme.typography.fontWeight.bold : props.theme.typography.fontWeight.normal};
  transition: background-color ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.background.hover};
  }
`;
NavItem.className = 'hamburger-nav-item';

// ============================================================================
// Navigation items
// ============================================================================

const NAV_ITEMS = [
  { label: 'Generator',       href: '/',                     icon: 'image' },
  { label: 'Inpaint',         href: '/inpaint.html',         icon: 'paint-program' },
  { label: 'Workflow Editor', href: '/workflow-editor.html', icon: 'cog' },
];

// ============================================================================
// HamburgerMenu Component
// ============================================================================

/**
 * HamburgerMenu - Fixed-position navigation menu shown on all pages.
 *
 * Renders a hamburger icon button in the top-right corner. Clicking it opens a
 * dropdown with links to the main pages of the application.
 *
 * @returns {preact.VNode}
 */
export function HamburgerMenu() {
  const [theme, setTheme]   = useState(currentTheme.value);
  const [open,  setOpen]    = useState(false);
  const rootRef             = useRef(null);

  useEffect(() => {
    const unsub = currentTheme.subscribe(setTheme);
    return () => unsub();
  }, []);

  // Close on outside click
  const handleDocumentClick = useCallback((e) => {
    if (rootRef.current && !rootRef.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleDocumentClick);
    } else {
      document.removeEventListener('mousedown', handleDocumentClick);
    }
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [open, handleDocumentClick]);

  // Determine the current page path for active highlighting
  const currentPath = window.location.pathname;

  return html`
    <${MenuRoot} ref=${rootRef}>
      <${MenuButton}
        theme=${theme}
        onClick=${() => setOpen(o => !o)}
        title="Navigation menu"
        aria-label="Navigation menu"
        aria-expanded=${open}
      >
        <${Icon}
          name=${open ? 'x' : 'menu'}
          size="20px"
          color=${theme.colors.text.primary}
        />
      </${MenuButton}>

      <${Dropdown} theme=${theme} open=${open}>
        ${NAV_ITEMS.map(item => {
          const active = currentPath === item.href ||
            (item.href === '/' && currentPath === '/index.html');
          return html`
            <${NavItem}
              key=${item.href}
              href=${item.href}
              theme=${theme}
              active=${active}
              onClick=${() => setOpen(false)}
            >
              <${Icon}
                name=${item.icon}
                size="18px"
                color=${active ? theme.colors.primary.text : theme.colors.text.secondary}
              />
              ${item.label}
            </${NavItem}>
          `;
        })}
      </${Dropdown}>
    </${MenuRoot}>
  `;
}
