/**
 * hamburger-menu.mjs – Generic navigation dropdown panel.
 *
 * Provides a floating panel of navigation links that can be positioned relative
 * to any trigger. Designed to be used by an app-specific wrapper that supplies
 * the trigger button and the items list.
 *
 * Can also be repurposed as a context menu by passing arbitrary onClick items
 * instead of href items.
 *
 * @module custom-ui/nav/hamburger-menu
 */
import { html } from 'htm/preact';
import { useEffect, useRef, useCallback } from 'preact/hooks';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const MenuRoot = styled('div')`
  position: relative;
`;
MenuRoot.className = 'nav-panel-root';

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
Dropdown.className = 'nav-panel-dropdown';

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
  cursor: pointer;
  transition: background-color ${props => props.theme.transitions.fast};

  &:hover {
    text-decoration: none;
    color: ${props => props.active ? props.theme.colors.primary.text : props.theme.colors.text.primary};
    background-color: ${props => props.active
      ? props.theme.colors.primary.background
      : props.theme.colors.background.hover};
  }
`;
NavItem.className = 'nav-panel-item';

// ============================================================================
// NavPanel Component
// ============================================================================

/**
 * NavPanel – Generic floating dropdown panel of navigation / action items.
 *
 * Renders inline (position: relative on root) so it attaches to whatever
 * element wraps it. The trigger button lives outside this component in the
 * app-specific wrapper.
 *
 * @param {Object}   props
 * @param {boolean}  props.open            - Whether the panel is visible.
 * @param {Function} props.onClose         - Called when the user clicks outside.
 * @param {Array}    props.items           - Navigation items:
 *   `[{ label, href?, onClick?, icon?, active? }]`
 *   - `href`    → rendered as `<a href>` navigation
 *   - `onClick` → rendered as `<a>` with click handler (no href)
 * @param {preact.ComponentChildren} [props.children] - Trigger element (button).
 * @returns {preact.VNode}
 */
export function NavPanel({ open, onClose, items = [], children }) {
  const theme   = currentTheme.value;
  const rootRef = useRef(null);

  const handleDocumentClick = useCallback((e) => {
    if (rootRef.current && !rootRef.current.contains(e.target)) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleDocumentClick);
    } else {
      document.removeEventListener('mousedown', handleDocumentClick);
    }
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [open, handleDocumentClick]);

  return html`
    <${MenuRoot} ref=${rootRef}>
      ${children}

      <${Dropdown} theme=${theme} open=${open}>
        ${items.map(item => html`
          <${NavItem}
            key=${item.label}
            href=${item.href}
            theme=${theme}
            active=${item.active || false}
            onClick=${(e) => {
              if (item.onClick) {
                e.preventDefault();
                item.onClick();
              }
              onClose();
            }}
          >
            ${item.icon && html`
              <span class="material-symbols-outlined" style="font-size:18px;color:${item.active ? theme.colors.primary.text : theme.colors.text.secondary}">
                ${item.icon}
              </span>
            `}
            ${item.label}
          </${NavItem}>
        `)}
      </${Dropdown}>
    </${MenuRoot}>
  `;
}
