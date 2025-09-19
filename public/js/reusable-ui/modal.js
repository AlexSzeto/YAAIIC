import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createPortal } from 'preact/compat'

/**
 * Reusable CustomModal component using Preact
 * Provides a consistent modal structure with proper event handling and portal rendering
 */
export class CustomModal extends Component {
  constructor(props) {
    super(props);
    
    // Validate props
    if (props.onClose && typeof props.onClose !== 'function') {
      throw new Error('onClose must be a function');
    }
    
    // Initialize state
    this.state = {
      isVisible: !!props.isVisible,
      lock: !!props.lock,
      isClosing: false
    };
    
    // Create portal container immediately
    this.portalContainer = document.createElement('div');
    document.body.appendChild(this.portalContainer);
    
    console.log('CustomModal initialized:', { 
      isVisible: this.state.isVisible, 
      lock: this.state.lock 
    });
  }
  
  componentDidMount() {
    // Set up keyboard listener
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Focus close button for accessibility when modal opens
    if (this.state.isVisible) {
      this.focusCloseButton();
    }
  }
  
  componentDidUpdate(prevProps) {
    // Handle visibility prop changes
    if (prevProps.isVisible !== this.props.isVisible) {
      this.setState({ isVisible: !!this.props.isVisible });
    }
    
    // Handle lock prop changes
    if (prevProps.lock !== this.props.lock) {
      this.setState({ lock: !!this.props.lock });
    }
    
    // Focus close button when modal becomes visible
    if (!prevProps.isVisible && this.props.isVisible) {
      this.focusCloseButton();
    }
  }
  
  componentWillUnmount() {
    // Clean up event listener
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Clean up portal container
    if (this.portalContainer && this.portalContainer.parentNode) {
      document.body.removeChild(this.portalContainer);
    }
    
    console.log('CustomModal unmounted');
  }
  
  /**
   * Focus the close button with a small delay for proper rendering
   */
  focusCloseButton() {
    setTimeout(() => {
      if (this.closeButtonRef) {
        this.closeButtonRef.focus();
      }
    }, 100);
  }
  
  /**
   * Handle keyboard events
   */
  handleKeyDown = (e) => {
    if (e.key === 'Escape' && this.state.isVisible && !this.state.lock) {
      this.closeModal();
    }
  }
  
  /**
   * Handle overlay click
   */
  handleOverlayClick = (e) => {
    if (e.target.classList.contains('image-modal-overlay') && !this.state.lock) {
      this.closeModal();
    }
  }
  
  /**
   * Handle close button click
   */
  handleCloseClick = () => {
    if (!this.state.lock) {
      this.closeModal();
    }
  }
  
  /**
   * Close the modal with proper cleanup
   */
  closeModal() {
    if (this.state.isClosing) return;
    
    this.setState({ isClosing: true });
    
    // Call onClose event handler
    if (this.props.onClose) {
      this.props.onClose();
    }
    
    // Reset closing state after animation
    setTimeout(() => {
      this.setState({ isClosing: false });
    }, 300);
    
    console.log('CustomModal closed');
  }
  
  /**
   * Set modal lock state
   * @param {boolean} lock - Whether to disable close mechanisms
   */
  setModalLock(lock) {
    this.setState({ lock: !!lock });
    console.log('CustomModal lock state changed:', !!lock);
  }
  
  /**
   * Render the modal content
   */
  renderModalContent() {
    const { children, size = 'default' } = this.props;
    const { lock, isClosing } = this.state;
    
    const overlayClass = `image-modal-overlay${isClosing ? ' modal-closing' : ''}`;
    const closeButtonDisabled = lock;
    
    return html`
      <div 
        class=${overlayClass}
        onClick=${this.handleOverlayClick}
        style=${{ pointerEvents: lock ? 'none' : 'auto' }}
      >
        <div class="image-modal-wrapper">
          <div class="image-modal-container ${size}">
            ${children}
          </div>
          <button 
            class="image-modal-close"
            onClick=${this.handleCloseClick}
            disabled=${closeButtonDisabled}
            style=${{ 
              opacity: closeButtonDisabled ? 0.5 : 1,
              cursor: closeButtonDisabled ? 'not-allowed' : 'pointer'
            }}
            aria-label="Close modal"
            ref=${(ref) => { this.closeButtonRef = ref; }}
          >
            ×
          </button>
        </div>
      </div>
    `;
  }
  
  render() {
    const { isVisible } = this.state;
    
    console.log('CustomModal render called:', { 
      isVisible, 
      hasPortalContainer: !!this.portalContainer 
    });
    
    // Don't render anything if not visible or portal container not ready
    if (!isVisible || !this.portalContainer) {
      console.log('CustomModal not rendering:', { isVisible, portalContainer: !!this.portalContainer });
      return null;
    }
    
    // Use createPortal to render the modal content to document.body
    const modalContent = this.renderModalContent();
    console.log('CustomModal rendering with portal:', modalContent);
    
    return createPortal(modalContent, this.portalContainer);
  }
}

/**
 * ImageModalComponent - Pure Preact component for displaying images in modals
 */
export class ImageModalComponent extends Component {
  constructor(props) {
    super(props);
    
    // Validate props
    if (!props.imageUrl) {
      throw new Error('imageUrl is required for ImageModalComponent');
    }
    
    this.state = {
      imageLoaded: false,
      imageError: false,
      scaledDimensions: null
    };
    
    console.log('ImageModalComponent initialized:', props.imageUrl);
  }
  
  componentDidMount() {
    console.log('ImageModalComponent mounted');
  }
  
  componentWillUnmount() {
    console.log('ImageModalComponent unmounted');
  }
  
  /**
   * Handle image load success
   */
  handleImageLoad = (e) => {
    const image = e.target;
    const { autoScale = true } = this.props;
    
    this.setState({ imageLoaded: true, imageError: false });
    
    if (autoScale) {
      this.calculateScaling(image);
    }
    
    console.log('Image loaded successfully:', this.props.imageUrl);
  }
  
  /**
   * Handle image load error
   */
  handleImageError = () => {
    this.setState({ imageLoaded: false, imageError: true });
    console.error('Failed to load image:', this.props.imageUrl);
  }
  
  /**
   * Calculate scaling for auto-scale mode
   */
  calculateScaling(image) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 40; // 20px padding on each side
    const maxWidth = windowWidth - padding;
    const maxHeight = windowHeight - padding;
    
    const imageAspectRatio = image.naturalWidth / image.naturalHeight;
    const windowAspectRatio = maxWidth / maxHeight;
    
    let scaledWidth, scaledHeight;
    
    if (imageAspectRatio > windowAspectRatio) {
      // Image is wider relative to window
      scaledWidth = Math.min(maxWidth, image.naturalWidth);
      scaledHeight = scaledWidth / imageAspectRatio;
    } else {
      // Image is taller relative to window
      scaledHeight = Math.min(maxHeight, image.naturalHeight);
      scaledWidth = scaledHeight * imageAspectRatio;
    }
    
    this.setState({
      scaledDimensions: {
        width: scaledWidth,
        height: scaledHeight
      }
    });
  }
  
  render() {
    const { imageUrl, autoScale = true } = this.props;
    const { imageError, imageLoaded, scaledDimensions } = this.state;
    
    // Show error state
    if (imageError) {
      return html`
        <div class="image-modal-error">
          Failed to load image
        </div>
      `;
    }
    
    // Determine image styles
    let imageStyles = {};
    let containerStyles = {};
    
    if (autoScale && scaledDimensions) {
      imageStyles = {
        width: scaledDimensions.width + 'px',
        height: scaledDimensions.height + 'px'
      };
      containerStyles = {
        overflow: 'visible'
      };
    } else if (!autoScale && imageLoaded) {
      // Original size mode - enable scrolling if needed
      containerStyles = {
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto'
      };
    }
    
    return html`
      <div style=${containerStyles}>
        <img
          src=${imageUrl}
          alt="Modal Image"
          class=${autoScale ? 'image-modal-autoscale' : 'image-modal-original'}
          style=${imageStyles}
          onLoad=${this.handleImageLoad}
          onError=${this.handleImageError}
        />
      </div>
    `;
  }
}

/**
 * DialogModalComponent - Pure Preact component for displaying dialog content
 */
export class DialogModalComponent extends Component {
  constructor(props) {
    super(props);
    
    console.log('DialogModalComponent initialized');
  }
  
  componentDidMount() {
    console.log('DialogModalComponent mounted');
  }
  
  componentWillUnmount() {
    console.log('DialogModalComponent unmounted');
  }
  
  render() {
    const { text = '', title = 'Generate Image' } = this.props;
    
    // Determine content text
    const hasContent = text.trim();
    const contentText = hasContent 
      ? `Description text: "${text}"` 
      : 'No description text provided.';
    
    return html`
      <div class="dialog-box">
        <h3 class="dialog-title">${title}</h3>
        <p class="dialog-content ${hasContent ? '' : 'empty'}">
          ${contentText}
        </p>
        <button 
          class="dialog-close-button"
          onClick=${this.props.onClose}
          ref=${(ref) => { 
            // Focus the close button for accessibility
            if (ref) {
              setTimeout(() => ref.focus(), 100);
            }
          }}
        >
          Close
        </button>
      </div>
    `;
  }
}

/**
 * Create a dialog modal using CustomModal and DialogModalComponent
 * Replaces the showDialog function from dialog.js
 * @param {string} text - The main content text to display in the dialog body
 * @param {string} title - The title to display in the dialog header (default: 'Generate Image')
 * @returns {Object} API object with methods to control the dialog
 */
export function createDialogModal(text, title = 'Generate Image') {
  let modalContainer = null;
  let modalRef = null;
  
  // Create container for the modal
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  // Handle modal close
  const handleClose = () => {
    // Clean up the modal
    if (container && container.parentNode) {
      render(null, container);
      document.body.removeChild(container);
    }
    modalRef = null;
    modalContainer = null;
    console.log('Dialog modal closed and cleaned up');
  };
  
  // Render the modal with DialogModalComponent as children
  render(
    html`<${CustomModal}
      isVisible=${true}
      lock=${false}
      onClose=${handleClose}
      ref=${(ref) => { modalRef = ref; }}
    >
      <${DialogModalComponent} 
        text=${text}
        title=${title}
        onClose=${handleClose}
      />
    </${CustomModal}>`,
    container
  );
  
  console.log('Dialog modal created with CustomModal:', title);
  
  // Return a simple API for manual control (if needed)
  return {
    close: handleClose
  };
}

// Backward compatibility alias for existing showDialog function
export function showDialog(text, title = 'Generate Image') {
  return createDialogModal(text, title);
}

// Refactored createImageModal function using CustomModal
export function createImageModal(url, autoScale = true) {
  if (!url) {
    throw new Error('URL is required for createImageModal');
  }
  
  let modalContainer = null;
  let modalRef = null;
  
  // Create container for the modal
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  // Handle modal close
  const handleClose = () => {
    // Clean up the modal
    if (container && container.parentNode) {
      render(null, container);
      document.body.removeChild(container);
    }
    modalRef = null;
    modalContainer = null;
    console.log('Image modal closed and cleaned up');
  };
  
  // Render the modal with ImageModalComponent as children
  render(
    html`<${CustomModal}
      isVisible=${true}
      lock=${false}
      onClose=${handleClose}
      ref=${(ref) => { modalRef = ref; }}
    >
      <${ImageModalComponent} 
        imageUrl=${url}
        autoScale=${autoScale}
      />
    </${CustomModal}>`,
    container
  );
  
  console.log('Image modal created with CustomModal:', url);
  
  // Return a simple API for manual control (if needed)
  return {
    close: handleClose
  };
}