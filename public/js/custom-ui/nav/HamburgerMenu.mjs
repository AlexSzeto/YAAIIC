/**
 * HamburgerMenu.mjs – Generic navigation hamburger menu.
 *
 * An inline component (not fixed-position) that renders a `Button` trigger and
 * an animated dropdown of navigation links. Designed to be placed inside an
 * existing header layout, to the right of other action buttons.
 *
 * @module custom-ui/nav/HamburgerMenu
 */
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Icon } from '../layout/icon.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const MenuRoot = styled('div')`
  position: relative;
`;
MenuRoot.className = 'hamburger-menu-root';

const Dropdown = styled('div')`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  background-color: ${props => props.theme.colors.background.card};
  box-shadow: ${props => props.theme.shadow.elevated};
  overflow: hidden;
  z-index: 9000;
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
  background-color: ${props => props.active ? props.theme.colors.primary.background : 'transparent'};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-weight: ${props => props.active ? props.theme.typography.fontWeight.bold : props.theme.typography.fontWeight.normal};
  transition: background-color ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.active
      ? props.theme.colors.primary.background
      : props.theme.colors.background.hover};
  }
`;
NavItem.className = 'hamburger-nav-item';

// ============================================================================
// HamburgerMenu Component
// ============================================================================

/**
 * HamburgerMenu – Inline navigation menu for use inside a page header.
 *
 * @param {Object}   props
 * @param {Array}    props.items              - Navigation items: `[{ label, href, icon }]`
 * @param {string}   [props.title='Menu']     - Tooltip / aria-label for the trigger button
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${HamburgerMenu}
 *     items=${[{ label: 'Workflow Editor', href: '/workflow-editor.html', icon: 'cog' }]}
 *   />
 * `
 */
export function HamburgerMenu({ items = [], title = 'Menu' }) {
  const [theme, setTheme] = useState(currentTheme.value);
  const [open,  setOpen]  = useState(false);
  const rootRef           = useRef(null);

  useEffect(() => {
    const unsub = currentTheme.subscribe(setTheme);
    return () => unsub();
  }, []);

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

  const currentPath = window.location.pathname;

  return html`
    <${MenuRoot} ref=${rootRef}>
      <${Button}
        variant="large-icon"
        icon=${open ? 'x' : 'menu'}
        onClick=${() => setOpen(o => !o)}
        title=${title}
        aria-label=${title}
        aria-expanded=${open}
        aria-haspopup="true"
      />

      <${Dropdown} theme=${theme} open=${open}>
        ${items.map(item => {
          const active =
            currentPath === item.href ||
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
