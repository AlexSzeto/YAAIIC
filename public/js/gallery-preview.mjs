import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createImageModal } from './custom-ui/modal.mjs'
import { Checkbox } from './custom-ui/checkbox.mjs'
import { Button } from './custom-ui/button.mjs'
import { globalAudioPlayer } from './global-audio-player.mjs'

// Gallery Preview Component
export class GalleryPreview extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      imageError: false,
      isHovering: false,
      isAudioPlaying: false
    };
    
    this.containerRef = null;
    this.unsubscribeAudioPlayer = null;
  }

  componentDidMount() {
    // Add keyboard listener for spacebar
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Subscribe to audio player state changes
    this.unsubscribeAudioPlayer = globalAudioPlayer.subscribe(() => {
      const { item } = this.props;
      if (item && item.audioUrl) {
        this.setState({ isAudioPlaying: globalAudioPlayer.isPlaying(item.audioUrl) });
      }
    });
  }

  componentWillUnmount() {
    // Clean up keyboard listener
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Unsubscribe from audio player
    if (this.unsubscribeAudioPlayer) {
      this.unsubscribeAudioPlayer();
    }
  }

  handleKeyDown = (e) => {
    // Check if spacebar is pressed, component is hovering, and selection is enabled
    if (e.code === 'Space' && this.state.isHovering && this.props.onSelect && !this.props.disableCheckbox) {
      e.preventDefault(); // Prevent page scroll
      this.toggleSelection();
    }
  }

  handleMouseEnter = () => {
    this.setState({ isHovering: true });
  }

  handleMouseLeave = () => {
    this.setState({ isHovering: false });
  }

  toggleSelection = () => {
    const { item, onSelect, isSelected } = this.props;
    
    // Toggle the current selection state
    if (onSelect) {
      onSelect(item, !isSelected);
    }
  }

  handleImageError = () => {
    this.setState({ imageError: true });
  }

  handleAudioToggle = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const { item } = this.props;
    if (item && item.audioUrl) {
      globalAudioPlayer.toggle(item.audioUrl);
    }
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
    
    // Don't open modal if clicking on audio button
    if (e.target.closest('.gallery-audio-button')) {
      return;
    }
    
    const { item, onSelectAsInput } = this.props;
    
    // Don't open modal for audio items in gallery mode
    if (item && item.audioUrl && !this.props.onImageClick && !onSelectAsInput) {
      return;
    }
    
    // If a custom image click handler is provided, delegate to it
    if (this.props.onImageClick) {
      this.props.onImageClick(item);
      return;
    }
    if (item.imageUrl && !this.state.imageError) {
      // Pass item.name as title to modal, and onSelectAsInput as the select callback
      createImageModal(
        item.imageUrl, 
        !!onSelectAsInput, // allowSelect only if we have a handler
        item.name || null,
        onSelectAsInput ? () => onSelectAsInput(item) : null
      );
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
    const { imageError, isAudioPlaying } = this.state;
    const hasAudio = item && item.audioUrl;

    return html`
      <div 
        class="gallery-item ${disabled ? 'disabled' : ''}" 
        style=${{ position: 'relative' }}
        onMouseEnter=${this.handleMouseEnter}
        onMouseLeave=${this.handleMouseLeave}
      >
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
          } : disabled ? { cursor: 'default' } : (hasAudio ? { cursor: 'default' } : { cursor: 'pointer' })}
          onError=${this.handleImageError}
          onClick=${this.handleImageClick}
        >
          ${imageError && 'No image'}
        </img>
        <div class="gallery-item-info overlay-panel ${hasAudio ? 'has-audio' : ''}">
          ${hasAudio && html`
            <div class="gallery-audio-button" onClick=${this.handleAudioToggle}>
              <${Button}
                variant="icon"
                icon=${isAudioPlaying ? 'stop' : 'play'}
                title=${isAudioPlaying ? 'Stop' : 'Play'}
              />
            </div>
          `}
          <div class="gallery-item-text-content">
            <div class="gallery-item-name">
              ${item.name || 'Unnamed'}
            </div>
            <div class="gallery-item-date">
              ${this.formatDate(item.timestamp)}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// Factory function to create a gallery preview (for compatibility with existing code)
export function createGalleryPreview(item, onSelect, isSelected = false, disableCheckbox = false, onImageClick = null, disabled = false, onSelectAsInput = null) {
  const container = document.createElement('div');
  
  // Render the Preact component into the container
  render(html`<${GalleryPreview} 
    item=${item} 
    onSelect=${onSelect} 
    isSelected=${isSelected} 
    disableCheckbox=${disableCheckbox} 
    onImageClick=${onImageClick} 
    disabled=${disabled}
    onSelectAsInput=${onSelectAsInput}
  />`, container);
  
  // Return the first child element (the actual gallery item)
  return container.firstElementChild;
}