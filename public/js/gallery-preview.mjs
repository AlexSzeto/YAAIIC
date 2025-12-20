import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createImageModal } from './custom-ui/modal.mjs'
import { Checkbox } from './custom-ui/checkbox.mjs'

// Gallery Preview Component
export class GalleryPreview extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      imageError: false
    };
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

    return html`
      <div class="gallery-item ${disabled ? 'disabled' : ''}" style=${{ position: 'relative' }}>
        ${onSelect && html`
          <div class="gallery-item-checkbox-container" onClick=${(e) => e.stopPropagation()}>
            <${Checkbox}
              checked=${isSelected || false}
              disabled=${disableCheckbox}
              onChange=${this.handleCheckboxChange}
              label=${null}
              className="gallery-item-checkbox"
            />
          </div>
        `}
        <img
          class="gallery-item-image"
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