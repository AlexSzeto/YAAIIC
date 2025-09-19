import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createImageModal } from './reusable-ui/modal.js'

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

  handleImageClick = () => {
    const { item } = this.props;
    if (item.imageUrl && !this.state.imageError) {
      createImageModal(item.imageUrl); // Use default autoScale=true
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
    const { item } = this.props;
    const { imageError } = this.state;

    return html`
      <div class="gallery-item">
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
          } : { cursor: 'pointer' }}
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
export function createGalleryPreview(item) {
  const container = document.createElement('div');
  
  // Render the Preact component into the container
  render(html`<${GalleryPreview} item=${item} />`, container);
  
  // Return the first child element (the actual gallery item)
  return container.firstElementChild;
}