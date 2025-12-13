import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createImageModal } from './custom-ui/modal.mjs'

// Gallery Preview Component
export class GalleryPreview extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      imageError: false
    };
    
    this.imageRef = null;
  }

  /**
   * Check if a URL points to an animated image
   * @param {string} url - Image URL to check
   * @returns {boolean} True if the URL ends with .gif or .webp
   */
  isAnimatedImage(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp');
  }

  handleImageError = () => {
    this.setState({ imageError: true });
  }

  handleImageClick = (e) => {
    // Don't open modal if disabled
    if (this.props.disabled) {
      return;
    }
    
    // Don't open modal if clicking on checkbox or checkbox container
    if (e.target.type === 'checkbox' || 
        e.target.closest('.gallery-item-checkbox-container')) {
      return;
    }
    
    const { item } = this.props;
    // If a custom image click handler is provided, delegate to it
    if (this.props.onImageClick) {
      this.props.onImageClick(item);
      return;
    }
    if (item.imageUrl && !this.state.imageError) {
      // Pass item.name as title to modal
      createImageModal(item.imageUrl, true, item.name || null);
    }
  }

  handleCheckboxChange = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    
    const { item, onSelect } = this.props;
    const isSelected = e.target.checked;
    
    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(item, isSelected);
    }
  }

  formatDate(timestamp) {
    if (timestamp) {
      const date = new Date(timestamp);
      return date.toISOString().split('T')[0];
    }
    return 'No date';
  }

  render() {
    const { item, onSelect, isSelected, disableCheckbox = false, disabled = false } = this.props;
    const { imageError } = this.state;
    
    // Check if this is an animated image for freezeframe
    const isAnimated = this.isAnimatedImage(item.imageUrl);
    const imageClass = `gallery-item-image${isAnimated ? ' freezeframe' : ''}`;

    return html`
      <div class="gallery-item ${disabled ? 'disabled' : ''}" style=${{ position: 'relative' }}>
        ${onSelect && html`
          <div class="gallery-item-checkbox-container">
            <input
              type="checkbox"
              class="gallery-item-checkbox shared-checkbox"
              checked=${isSelected || false}
              disabled=${disableCheckbox}
              onChange=${this.handleCheckboxChange}
            />
          </div>
        `}
        <img
          class=${imageClass}
          src=${item.imageUrl || ''}
          alt=${item.name || 'Generated image'}
          style=${imageError ? {
            backgroundColor: '#333333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999999',
            fontSize: '10px',
            cursor: 'default'
          } : disabled ? { cursor: 'not-allowed' } : { cursor: 'pointer' }}
          onError=${this.handleImageError}
          onClick=${this.handleImageClick}
          ref=${(el) => { this.imageRef = el; }}
        >
          ${imageError && 'No image'}
        </img>
        <div class="gallery-item-info">
          <div class="gallery-item-name">
            ${item.name || 'Unnamed'}
          </div>
          <div class="gallery-item-date">
            ${this.formatDate(item.timestamp)}
          </div>
        </div>
      </div>
    `;
  }
}

// Factory function to create a gallery preview (for compatibility with existing code)
export function createGalleryPreview(item, onSelect, isSelected = false, disableCheckbox = false, onImageClick = null, disabled = false) {
  const container = document.createElement('div');
  
  // Render the Preact component into the container
  render(html`<${GalleryPreview} item=${item} onSelect=${onSelect} isSelected=${isSelected} disableCheckbox=${disableCheckbox} onImageClick=${onImageClick} disabled=${disabled} />`, container);
  
  // Return the first child element (the actual gallery item)
  return container.firstElementChild;
}