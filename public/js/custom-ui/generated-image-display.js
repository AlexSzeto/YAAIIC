import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { sendToClipboard } from '../util.js'
import { createImageModal } from './modal.js'

/**
 * Pure Preact component for displaying generated image data
 * Replaces the imperative GeneratedImageDisplay class
 */
export class GeneratedImageDisplayComponent extends Component {
  constructor(props) {
    super(props);
    
    // Validate props
    if (props.onUseField && typeof props.onUseField !== 'function') {
      throw new Error('onUseField must be a function');
    }
    
    // Initialize state
    this.state = {
      imageLoaded: false,
      imageError: false,
      isVisible: !!props.imageData
    };
    
    console.log('GeneratedImageDisplayComponent initialized');
  }
  
  componentDidMount() {
    console.log('GeneratedImageDisplayComponent mounted');
  }
  
  componentDidUpdate(prevProps) {
    // Handle imageData prop changes
    if (prevProps.imageData !== this.props.imageData) {
      // Reset image states when data changes
      this.setState({
        imageLoaded: false,
        imageError: false,
        isVisible: !!this.props.imageData
      });
      
      console.log('GeneratedImageDisplayComponent data updated:', this.props.imageData);
    }
  }
  
  componentWillUnmount() {
    console.log('GeneratedImageDisplayComponent unmounted');
  }
  
  /**
   * Handle image load success
   */
  handleImageLoad = () => {
    this.setState({ imageLoaded: true, imageError: false });
    console.log('Generated image loaded successfully');
  }
  
  /**
   * Handle image load error
   */
  handleImageError = () => {
    this.setState({ imageLoaded: false, imageError: true });
    console.error('Failed to load generated image');
  }
  
  /**
   * Handle image click to open modal
   */
  handleImageClick = () => {
    const { imageData } = this.props;
    if (imageData && imageData.imageUrl && this.state.imageLoaded && !this.state.imageError) {
      createImageModal(imageData.imageUrl, false); // autoScale=false for original size
    }
  }
  
  /**
   * Handle copy button clicks
   */
  handleCopyField = async (fieldName) => {
    const { imageData } = this.props;
    
    if (!imageData) {
      console.warn('No image data available for copy');
      return;
    }
    
    let value = '';
    
    switch(fieldName) {
      case 'workflow':
        value = imageData.workflow || '';
        break;
      case 'name':
        value = imageData.name || '';
        break;
      case 'tags':
        value = imageData.prompt || '';
        break;
      case 'description':
        value = imageData.description || '';
        break;
      case 'seed':
        value = imageData.seed || '';
        break;
      default:
        console.error('Unknown field for copy:', fieldName);
        return;
    }
    
    if (!value) {
      console.warn(`No content to copy for field: ${fieldName}`);
      return;
    }
    
    const successMessage = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} copied to clipboard`;
    await sendToClipboard(value, successMessage);
  }
  
  /**
   * Handle use button clicks
   */
  handleUseField = (fieldName) => {
    const { imageData, onUseField } = this.props;
    
    if (!imageData) {
      console.warn('No image data available for use');
      return;
    }
    
    let value = '';
    
    switch(fieldName) {
      case 'workflow':
        value = imageData.workflow || '';
        break;
      case 'name':
        value = imageData.name || '';
        break;
      case 'tags':
        value = imageData.prompt || '';
        break;
      case 'description':
        value = imageData.description || '';
        break;
      case 'seed':
        value = imageData.seed || '';
        break;
      default:
        console.error('Unknown field for use:', fieldName);
        return;
    }
    
    if (!value) {
      console.warn(`No content to use for field: ${fieldName}`);
      return;
    }
    
    // Call the required callback function
    if (onUseField) {
      onUseField(fieldName, value);
    } else {
      console.warn('No onUseField callback provided');
    }
  }
  
  /**
   * Render field with copy and use buttons
   */
  renderField(fieldName, label, value, isTextarea = false) {
    const inputProps = {
      value: value || '',
      readonly: true,
      class: `info-${fieldName}`
    };
    
    return html`
      <div class="info-row">
        <label class="info-label">${label}:</label>
        <div class="info-input-container">
          ${isTextarea ? 
            html`<textarea ...${inputProps}></textarea>` :
            html`<input type="text" ...${inputProps} />`
          }
          <div class="info-buttons">
            <button 
              class="copy-btn btn-with-icon"
              data-field=${fieldName}
              onClick=${() => this.handleCopyField(fieldName)}
              title=${`Copy ${label}`}
            >
              <box-icon name="copy" color="#ffffff"></box-icon>
            </button>
            <button 
              class="use-btn btn-with-icon"
              data-field=${fieldName}
              onClick=${() => this.handleUseField(fieldName)}
              title=${`Use ${label}`}
            >
              <box-icon name="upload" color="#ffffff"></box-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  render() {
    const { imageData } = this.props;
    const { imageError, imageLoaded, isVisible } = this.state;
    
    // Hide component if no data
    if (!isVisible || !imageData) {
      return html`
        <div class="generated-image-display" style=${{ display: 'none' }}>
        </div>
      `;
    }
    
    return html`
      <div class="generated-image-display">
        <div class="generated-image-container">
          <div class="image-column">
            ${imageError ? 
              html`<div class="generated-image-error">Failed to load image</div>` :
              html`<img
                class="generated-image"
                src=${imageData.imageUrl || ''}
                alt=${imageData.name || 'Generated image'}
                style=${{ cursor: imageLoaded ? 'pointer' : 'default' }}
                onLoad=${this.handleImageLoad}
                onError=${this.handleImageError}
                onClick=${this.handleImageClick}
              />`
            }
          </div>
          <div class="info-column">
            ${this.renderField('workflow', 'Workflow', imageData.workflow)}
            ${this.renderField('name', 'Name', imageData.name)}
            ${this.renderField('tags', 'Tags', imageData.prompt, true)}
            ${this.renderField('description', 'Description', imageData.description || 'No description available', true)}
            ${this.renderField('seed', 'Seed', imageData.seed)}
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Factory function for backward compatibility
 * Creates and renders a GeneratedImageDisplayComponent
 * @param {HTMLElement} container - Container element to render into
 * @param {Function} onUseField - Event handler for field use actions
 * @returns {Object} API object with methods to control the component
 */
export function createGeneratedImageDisplay(container, onUseField = null) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('container must be a valid HTML element');
  }
  
  let componentRef = null;
  let currentData = null;
  
  // Initial render
  const renderComponent = (imageData) => {
    render(
      html`<${GeneratedImageDisplayComponent} 
        imageData=${imageData}
        onUseField=${onUseField}
        ref=${(ref) => { componentRef = ref; }}
      />`, 
      container
    );
  };
  
  // Initial render with no data
  renderComponent(null);
  
  // Return API object that mimics the original GeneratedImageDisplay class
  return {
    /**
     * Update the display with new image data
     * @param {Object|null} data - Image data object
     */
    setData(data) {
      currentData = data;
      renderComponent(data);
    },
    
    /**
     * Blank out the display (set to null data)
     */
    blankDisplay() {
      currentData = null;
      renderComponent(null);
    },
    
    /**
     * Get current data (for compatibility)
     */
    getCurrentData() {
      return currentData;
    },
    
    /**
     * Destroy the component and clean up
     */
    destroy() {
      if (container && container.firstChild) {
        render(null, container);
      }
      componentRef = null;
      currentData = null;
      console.log('GeneratedImageDisplayComponent destroyed');
    }
  };
}