/**
 * modal-base.mjs - Shared styled components for Modal and Dialog
 *
 * This module provides baseline styled components used by both Modal and Dialog
 * to ensure consistent styling and behavior.
 */

import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';
import { styled } from '../goober-setup.mjs';
import { H2 } from '../themed-base.mjs';

/**
 * BaseOverlay - Fixed overlay that covers the entire viewport.
 * Used as the backdrop for modals and dialogs.
 */
export const BaseOverlay = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${props => props.bgColor};
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/**
 * OverlayDismiss - Drop-in replacement for BaseOverlay that guards against
 * accidental dismissal caused by drag gestures starting inside the modal.
 *
 * The overlay closes only when BOTH the mousedown and the click (mouseup)
 * occurred directly on the overlay backdrop — not when a drag started inside
 * the modal content and the pointer was released over the backdrop.
 *
 * Usage: replace `<BaseOverlay onClick=${handleClose}>` with
 *        `<OverlayDismiss onClose=${handleClose}>`.  All other props are
 *        forwarded to the underlying BaseOverlay styled element.
 *
 * @param {Object}   props
 * @param {Function} props.onClose  - Called when the user clicks on the backdrop
 * @param {*}        props.children
 */
export function OverlayDismiss({ onClose, children, ...rest }) {
  // Track whether the most-recent mousedown landed directly on the backdrop
  // (not on a child element).  Only dismiss if both press and release are on it.
  const pressedOnBackdrop = useRef(false);

  return html`
    <${BaseOverlay}
      ...${rest}
      onMouseDown=${(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick=${(e) => {
        if (e.target === e.currentTarget && pressedOnBackdrop.current) onClose?.();
      }}
    >
      ${children}
    </${BaseOverlay}>
  `;
}

/**
 * BaseContainer - Styled container box for modal/dialog content
 * Provides consistent padding, shadows, and scrolling
 * Standard padding: 16px, no borders
 */
export const BaseContainer = styled('div')`
  background-color: ${props => props.bgColor};
  color: ${props => props.textColor};
  padding: 24px;
  border-radius: ${props => props.borderRadius};
  width: ${props => props.width || 'auto'};
  height: ${props => props.height || 'auto'};
  max-width: ${props => props.maxWidth};
  max-height: ${props => props.maxHeight};
  min-width: ${props => props.minWidth || 'auto'};
  overflow: auto;
  box-shadow: 0 4px 12px ${props => props.shadowColor};
`;

/**
 * BaseHeader - Styled header for modal/dialog title
 */
export const BaseHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.marginBottom};
`;

/**
 * BaseTitle - Styled title text
 */
export const BaseTitle = H2

/**
 * BaseContent - Styled content area
 */
export const BaseContent = styled('div')`
  margin-bottom: ${props => props.marginBottom};
  line-height: 1.5;
  color: ${props => props.color};
  font-family: ${props => props.fontFamily};
  font-size: ${props => props.fontSize};
  
  ${props => props.isEmpty ? `
    font-style: italic;
  ` : ''}
`;

/**
 * BaseFooter - Styled footer with button container
 */
export const BaseFooter = styled('div')`
  margin-top: ${props => props.marginTop};
  display: flex;
  justify-content: flex-end;
  gap: ${props => props.gap};
`;

/**
 * CloseButton - Styled close button for modal/dialog headers
 */
export const CloseButton = styled('button')`
  background: none;
  border: none;
  color: ${props => props.color};
  cursor: pointer;
  padding: 5px;
  transition: opacity ${props => props.transition};

  &:hover {
    opacity: 0.7;
  }

  &:focus {
    outline: none;
    opacity: 0.8;
  }
`;
