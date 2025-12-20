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
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = originalStyle; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

/**
 * Helper to imperatively show an image modal (backward compatibility)
 * @param {string} imageUrl 
 * @param {boolean} allowSelect - Not used in V2 modal logic directly but kept for signature compat
 * @param {string} title 
 * @param {Function} onSelect - Callback if a "Select" button/action is desired (legacy behavior)
 */
import { render } from 'preact';

export function createImageModal(imageUrl, allowSelect = false, title = null, onSelect = null) {
  // Create a container for the imperative modal
  const container = document.createElement('div');
  document.body.appendChild(container);

  const close = () => {
    render(null, container);
    container.remove();
  };
  
  const handleSelect = () => {
    if (onSelect) onSelect();
    close(); // Should we close? In legacy code, it seemed to imply closing.
  };

  // We need a wrapper component to manage 'isOpen' state if we want animation, 
  // but for simple imperative usage, we can just render it with isOpen=true 
  // and unmount on close.
  
  const ImperativeImageModal = () => {
    // If we want to use the footer for "Use as Input" button (legacy behavior)
    let footer = null;
    if (allowSelect && onSelect) {
        // Need to import Button? Or just use raw HTML to avoid circular deps if Button uses Modal?
        // Button doesn't use Modal. But let's avoid imports if possible or keep it simple.
        // We can just use standard buttons or reuse style classes.
        // Actually, we can just pass the button VNode.
        footer = html`
            <button class="btn-with-icon image-select-btn" onClick=${handleSelect}>
                <box-icon name='check' color='#ffffff'></box-icon>
                Use as Input
            </button>
        `;
    }

    return html`
      <${Modal} 
        isOpen=${true} 
        onClose=${close} 
        title=${title || 'Image Preview'} 
        size="large"
        footer=${footer}
      >
        <div style="display: flex; justify-content: center; align-items: center; background: #000; min-height: 200px;">
           <img 
             src=${imageUrl} 
             alt=${title || 'Preview'} 
             style="max-width: 100%; max-height: 80vh; object-fit: contain;" 
           />
        </div>
      <//>
    `;
  };

  render(html`<${ImperativeImageModal} />`, container);
}