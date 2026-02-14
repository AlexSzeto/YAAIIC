import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Panel } from '../layout/panel.mjs';
import { Icon } from '../layout/icon.mjs';
import { 
  BaseOverlay, 
  BaseContainer, 
  BaseHeader, 
  BaseTitle, 
  BaseContent, 
  BaseFooter,
  CloseButton 
} from './modal-base.mjs';

/**
 * Modal Component - Declarative modal that renders via Portal to document.body
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open (required)
 * @param {Function} props.onClose - Callback when modal is closed (required)
 * @param {string} [props.title] - Modal title text (required if showHeader is true)
 * @param {boolean} [props.showHeader=true] - Whether to show the header with title and close button
 * @param {string} [props.size='medium'] - Size variant: 'small', 'medium', 'large', 'full'
 * @param {string} [props.width] - Exact width (overrides size-based width)
 * @param {string} [props.height] - Exact height (overrides size-based height)
 * @param {preact.ComponentChildren} [props.children] - Modal body content
 * @param {preact.VNode|string} [props.footer] - Optional footer content (typically buttons)
 * @param {string} [props.className=''] - Additional CSS class name
 * @returns {preact.VNode|null}
 * 
 * @example
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   size="small"
 *   footer={html`
 *     <${Button} variant="secondary" onClick=${onCancel}>Cancel</${Button}>
 *     <${Button} variant="primary" onClick=${onConfirm}>Confirm</${Button}>
 *   `}
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 */
export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  showHeader = true,
  size = 'medium', 
  width,
  height,
  children, 
  footer,
  className = ''
}) {
  const overlayRef = useRef(null);
  const theme = currentTheme.value;

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
    // Check if click was directly on the overlay element (not bubbled from children)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Size-based max widths
  const getSizeMaxWidth = () => {
    // Use exact width if provided
    if (width) return width;
    
    switch (size) {
      case 'small': return '400px';
      case 'large': return '800px';
      case 'full': return '95vw';
      default: return '500px'; // medium
    }
  };

  const getSizeMaxHeight = () => {
    // Use exact height if provided
    if (height) return height;
    
    switch (size) {
      case 'full': return '95vh';
      default: return '80vh';
    }
  };

  const modalContent = html`
    <${BaseOverlay}
      bgColor=${theme.colors.overlay.background}
      onClick=${handleOverlayClick}
      ref=${overlayRef}
    >
      <${BaseContainer}
        bgColor=${theme.colors.background.card}
        textColor=${theme.colors.text.primary}
        borderRadius=${theme.spacing.medium.borderRadius}
        width=${width}
        height=${height}
        maxWidth=${!width ? getSizeMaxWidth() : undefined}
        maxHeight=${!height ? getSizeMaxHeight() : undefined}
        shadowColor=${theme.shadow.colorStrong}
        class=${className}
        role="dialog" 
        aria-modal="true" 
        aria-labelledby=${showHeader ? "modal-title" : undefined}
      >
        ${showHeader && html`
          <${BaseHeader} marginBottom="16px">
            <${BaseTitle} 
              id="modal-title" 
              color=${theme.colors.text.primary}
              fontFamily=${theme.typography.fontFamily}
              fontWeight=${theme.typography.fontWeight.bold}
            >
              ${title}
            </${BaseTitle}>
            <${CloseButton}
              onClick=${onClose}
              color=${theme.colors.text.secondary}
              transition=${theme.transitions.fast}
              aria-label="Close"
            >
              <${Icon} name='x' color=${theme.colors.text.secondary} />
            </${CloseButton}>
          </${BaseHeader}>
        `}
        
        <${BaseContent}
          marginBottom=${footer ? '20px' : '0'}
          color=${theme.colors.text.secondary}
          fontFamily=${theme.typography.fontFamily}
          fontSize=${theme.typography.fontSize.medium}
        >
          ${children}
        </${BaseContent}>

        ${footer && html`
          <${BaseFooter}
            marginTop="20px"
            gap=${theme.spacing.medium.gap}
          >
            ${footer}
          </${BaseFooter}>
        `}
      </${BaseContainer}>
    </${BaseOverlay}>
  `;

  return createPortal(modalContent, document.body);
}

/**
 * Helper to imperatively show an image modal (backward compatibility)
 * @param {string} imageUrl - URL of the image to display
 * @param {boolean} [allowSelect=false] - Show a select/action button
 * @param {string} [title=null] - Optional title overlay on the image
 * @param {Function} [onSelect=null] - Callback when select button is clicked
 * @param {string} [selectButtonText='View'] - Custom text for the select button
 */
import { render } from 'preact';
import { styled } from '../goober-setup.mjs';

const ImageModalWrapper = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  padding-bottom: ${props => props.hasActionButton ? '60px' : '0'};
`;
ImageModalWrapper.className = 'image-modal-wrapper';

const ImageModalContent = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;
ImageModalContent.className = 'image-modal-content';

const ImageModalPreview = styled('img')`
  max-width: 100%;
  max-height: ${props => props.maxHeight};
  display: block;
  object-fit: contain;
  border-radius: ${props => props.borderRadius};
`;
ImageModalPreview.className = 'image-modal-preview';

const ImageModalTitleWrapper = styled('div')`
  position: absolute;
  bottom: 8px;
  left: 8px;
  max-width: ${props => props.hasActionButton ? 'calc(100% - 140px)' : 'calc(100% - 20px)'};
`;
ImageModalTitleWrapper.className = 'image-modal-title-wrapper';

const ImageModalActionArea = styled('div')`
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;
ImageModalActionArea.className = 'image-modal-action-area';

export function createImageModal(imageUrl, allowSelect = false, title = null, onSelect = null, selectButtonText = 'View') {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const close = () => {
    render(null, container);
    container.remove();
    document.body.style.overflow = '';
  };
  
  // Lock body scroll
  document.body.style.overflow = 'hidden';
  
  const handleSelect = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect();
    close();
  };

  const ImperativeImageModal = () => {
    const theme = currentTheme.value;

    const handleOverlayClick = (e) => {
      // Check if click was directly on the overlay element (not bubbled from children)
      if (e.target === e.currentTarget) {
        close();
      }
    };
    
    // Handle Escape
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    return html`
      <${BaseOverlay}
        bgColor=${theme.colors.overlay.backgroundStrong}
        onClick=${handleOverlayClick}
      >
        <${BaseContainer}
          bgColor=${theme.colors.background.secondary}
          textColor=${theme.colors.text.primary}
          borderRadius=${theme.spacing.medium.borderRadius}
          maxWidth="calc(100vw - 40px)"
          maxHeight="calc(100vh - 40px)"
          shadowColor=${theme.shadow.colorStrong}
        >
          <${ImageModalWrapper} hasActionButton=${allowSelect && onSelect}>
            <${ImageModalContent}>
            <${ImageModalPreview}
              src=${imageUrl}
              alt=${title || 'Preview'}
              maxHeight=${allowSelect && onSelect ? 'calc(100vh - 120px)' : 'calc(100vh - 60px)'}
              borderRadius=${theme.spacing.medium.borderRadius}
              shadowColor=${theme.shadow.colorStrong}
            />
            
            ${title && html`
              <${ImageModalTitleWrapper} hasActionButton=${allowSelect && onSelect}>
                <${Panel} variant="glass">
                  ${title}
                </>
              </>
            `}
          </${ImageModalTitleWrapper}>

            ${allowSelect && onSelect && html`
              <${ImageModalActionArea}>
                <${Button}
                  variant="medium-text"
                  color="secondary"
                  onClick=${handleSelect}
                >
                  ${selectButtonText}
                </${Button}>
              </${ImageModalActionArea}>
            `}
          </${ImageModalWrapper}>
        </${BaseContainer}>
      </${BaseOverlay}>
    `;
  };

  render(html`<${ImperativeImageModal} />`, container);
}

/**
 * showModal - Shows a modal dialog imperatively
 * 
 * A convenience function that creates and renders a Modal component.
 * Returns a promise that resolves when the modal is closed.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.title - Modal title (required)
 * @param {preact.VNode|string} options.content - Modal body content (required)
 * @param {preact.VNode|Array<Object>} [options.footer] - Footer content or button configs
 *   - If array: [{ label: 'OK', color: 'primary', onClick: () => {...} }, ...]
 *   - If VNode: Custom footer content
 * @param {string} [options.size='medium'] - Size variant: 'small', 'medium', 'large', 'full'
 * @param {Function} [options.onClose] - Callback when modal closes
 * 
 * @returns {Object} Control object with close() method
 * 
 * @example
 * // Basic modal
 * const modal = showModal({
 *   title: 'Confirmation',
 *   content: html`<p>Are you sure?</p>`
 * });
 * 
 * @example
 * // Modal with buttons
 * showModal({
 *   title: 'Delete Item',
 *   content: 'This action cannot be undone.',
 *   footer: [
 *     { label: 'Cancel', color: 'secondary', onClick: () => console.log('Cancelled') },
 *     { label: 'Delete', color: 'danger', onClick: () => console.log('Deleted') }
 *   ]
 * });
 * 
 * @example
 * // Manually close
 * const modal = showModal({ title: 'Loading', content: 'Please wait...' });
 * setTimeout(() => modal.close(), 2000);
 */
export function showModal(options) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let isOpen = true;

  const cleanup = () => {
    render(null, container);
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    isOpen = false;
  };

  const handleClose = () => {
    if (options.onClose) {
      options.onClose();
    }
    cleanup();
  };

  // Convert footer array to VNode if needed
  let footerContent = options.footer;
  if (Array.isArray(options.footer)) {
    footerContent = html`
      ${options.footer.map(btn => html`
        <${Button}
          key=${btn.label}
          variant="medium-text"
          color=${btn.color || 'primary'}
          onClick=${() => {
            if (btn.onClick) btn.onClick();
            if (btn.close !== false) handleClose();
          }}
        >
          ${btn.label}
        </${Button}>
      `)}
    `;
  }

  // Render modal
  const ModalWrapper = () => {
    return html`
      <${Modal}
        isOpen=${isOpen}
        onClose=${handleClose}
        title=${options.title}
        size=${options.size || 'medium'}
        footer=${footerContent}
      >
        ${options.content}
      </${Modal}>
    `;
  };

  render(html`<${ModalWrapper} />`, container);

  return {
    close: handleClose
  };
}
