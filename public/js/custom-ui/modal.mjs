import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';

/**
 * Modal Component
 * Declarative modal that renders via Portal to document.body
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.title
 * @param {string} [props.size='medium'] - 'small', 'medium', 'large', 'full'
 * @param {VNode|string} [props.footer] - Optional footer content (buttons)
 * @param {VNode} props.children
 */
export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  size = 'medium', 
  children, 
  footer,
  className = ''
}) {
  if (!isOpen) return null;

  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'modal-sm';
      case 'large': return 'modal-lg';
      case 'full': return 'modal-full';
      default: return ''; // medium is default
    }
  };

  const modalContent = html`
    <div 
      class="dialog-overlay" 
      onClick=${handleOverlayClick} 
      ref=${overlayRef}
      style="display: flex;"
    >
      <div 
        class="dialog-box ${getSizeClass()} ${className}" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="modal-title"
      >
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 id="modal-title" class="dialog-title" style="margin: 0;">${title}</h3>
          <button 
            onClick=${onClose}
            style="background: none; border: none; color: var(--dark-text-secondary); cursor: pointer; padding: 5px;"
            aria-label="Close"
          >
            <box-icon name='x' color='var(--dark-text-secondary)'></box-icon>
          </button>
        </div>
        
        <div class="dialog-content" style="margin-bottom: ${footer ? '20px' : '0'};">
          ${children}
        </div>

        ${footer && html`
          <div class="dialog-buttons" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            ${footer}
          </div>
        `}
      </div>
    </div>
  `;

  return createPortal(modalContent, document.body);
}