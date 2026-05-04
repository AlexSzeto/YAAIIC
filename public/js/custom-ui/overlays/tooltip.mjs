/**
 * tooltip.mjs – Custom tooltip system using context/provider pattern.
 *
 * Renders a single shared tooltip portal anchored to the cursor position
 * captured at hover-start. The tooltip appears after a 600ms delay and
 * stays fixed at that position (no cursor follow).
 *
 * Usage:
 *   Wrap your app in <TooltipProvider>. Consume via useTooltip() hook or
 *   read TooltipContext directly (e.g. in class components via contextType).
 *
 * @module custom-ui/overlays/tooltip
 */
import { html } from 'htm/preact';
import { createContext } from 'preact';
import { useContext, useState, useCallback, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const TooltipBox = styled('div')`
  position: fixed;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  z-index: 20000;
  pointer-events: none;
  max-width: 300px;
  padding: ${props => props.theme.spacing.small.padding};
  border-radius: ${props => props.theme.border.radius || props.theme.spacing.small.borderRadius};
  background-color: ${props => props.theme.colors.overlay.glass};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: ${props => `${props.theme.border.width} ${props.theme.border.style} ${props.theme.colors.border.secondary}`};
  box-shadow: ${props => props.theme.shadow.elevated};
  font-family: ${props => props.theme.typography.fontFamily};
  font-size: ${props => props.theme.typography.fontSize.small};
  color: ${props => props.theme.colors.text.primary};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
`;
TooltipBox.className = 'tooltip-box';

// ============================================================================
// Context
// ============================================================================

export const TooltipContext = createContext(null);

/**
 * TooltipProvider – Wraps the app and provides the tooltip show/hide API.
 *
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children
 * @returns {preact.VNode}
 *
 * @example
 * html`
 *   <${TooltipProvider}>
 *     <${App} />
 *   </${TooltipProvider}>
 * `
 */
export function TooltipProvider({ children }) {
  const [tooltip, setTooltip] = useState(null); // { text, x, y } | null
  const timerRef = useRef(null);
  const theme = currentTheme.value;

  const show = useCallback((text, anchorX, anchorY) => {
    if (!text) return;
    // Clear any pending show
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTooltip({ text, x: anchorX + 12, y: anchorY + 16 });
      timerRef.current = null;
    }, 600);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTooltip(null);
  }, []);

  const value = { show, hide };

  return html`
    <${TooltipContext.Provider} value=${value}>
      ${children}
      ${tooltip && createPortal(html`
        <${TooltipBox}
          x=${tooltip.x}
          y=${tooltip.y}
          theme=${theme}
        >
          ${tooltip.text}
        </${TooltipBox}>
      `, document.body)}
    </${TooltipContext.Provider}>
  `;
}

/**
 * useTooltip – Hook to access the tooltip context.
 *
 * @returns {{ show: Function, hide: Function }}
 *
 * @example
 * const tooltip = useTooltip();
 * // In an element:
 * // onMouseEnter=${(e) => tooltip.show('Hello!', e.clientX, e.clientY)}
 * // onMouseLeave=${() => tooltip.hide()}
 */
export function useTooltip() {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('useTooltip must be used within a TooltipProvider');
  return ctx;
}
