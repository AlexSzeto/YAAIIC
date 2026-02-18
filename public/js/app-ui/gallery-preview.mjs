import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { styled } from '../custom-ui/goober-setup.mjs'
import { createImageModal } from '../custom-ui/overlays/modal.mjs'
import { Checkbox } from '../custom-ui/io/checkbox.mjs'
import { Button } from '../custom-ui/io/button.mjs'
import { Panel } from '../custom-ui/layout/panel.mjs'
import { globalAudioPlayer } from '../custom-ui/global-audio-player.mjs'
import { currentTheme } from '../custom-ui/theme.mjs'

// Styled components
const GalleryItemContainer = styled('div')`
  aspect-ratio: 1;
  border: 1px solid ${() => currentTheme.value.colors.border.primary};
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
  background-color: ${() => currentTheme.value.colors.background.card};
  display: flex;
  flex-direction: column;
  position: relative;

  &:hover {
    transform: scale(1.05);
    border-color: ${() => currentTheme.value.colors.border.highlight};
  }

  ${props => props.disabled ? `
    opacity: 0.4;
    pointer-events: none;
  ` : ''}
`;
GalleryItemContainer.className = 'gallery-item-container';

const GalleryItemImage = styled('img')`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: ${() => currentTheme.value.colors.border.primary};

  ${props => (props.imageError || props.disabled) ? `
    cursor: default;
  ` : `
    cursor: pointer;
  `}
`;
GalleryItemImage.className = 'gallery-item-image';

const GalleryItemInfo = styled('div')`
  position: absolute;
  bottom: 8px;
  left: 8px;
  max-width: calc(100% - 16px);
  pointer-events: none;
`;
GalleryItemInfo.className = 'gallery-item-info';

const GalleryItemInfoContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: ${() => currentTheme.value.colors.text.primary};

  ${props => (props.hasAudio || props.hasViewButton) ? `
    flex-direction: row;
    gap: 8px;
    align-items: center;
  ` : ''}
`;
GalleryItemInfoContent.className = 'gallery-item-info-content';

const GalleryAudioButton = styled('div')`
  pointer-events: auto;
  flex-shrink: 0;
`;
GalleryAudioButton.className = 'gallery-audio-button';

const GalleryViewButton = styled('div')`
  pointer-events: auto;
  flex-shrink: 0;
`;
GalleryViewButton.className = 'gallery-view-button';

const GalleryItemTextContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;
GalleryItemTextContent.className = 'gallery-item-text-content';

const GalleryItemName = styled('div')`
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  font-size: 13px;
  color: ${() => currentTheme.value.colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
`;
GalleryItemName.className = 'gallery-item-name';

const GalleryItemDate = styled('div')`
  font-size: 11px;
  color: ${() => currentTheme.value.colors.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
`;
GalleryItemDate.className = 'gallery-item-date';

const GalleryItemCheckboxContainer = styled('div')`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
  margin: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
`;
GalleryItemCheckboxContainer.className = 'gallery-item-checkbox-container';

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
    
    // Stop audio if this preview's audio is currently playing
    const { item } = this.props;
    if (item && item.audioUrl && globalAudioPlayer.isPlaying(item.audioUrl)) {
      globalAudioPlayer.stop();
    }
  }

  handleKeyDown = (e) => {
    // Check if user is typing in an input field
    const target = e.target;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
    
    // Only handle keyboard events if:
    // 1. Not typing in an input field
    // 2. This component is actually connected to the DOM (gallery is visible)
    // 3. Component is being hovered over
    // 4. Selection is enabled
    if (e.code === 'Space' && 
        !isInputField && 
        this.containerRef && 
        this.containerRef.isConnected && 
        this.state.isHovering && 
        this.props.onSelect && 
        !this.props.disableCheckbox) {
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

  handleCardClick = (e) => {
    if (this.props.disabled) return;

    // Buttons and checkboxes handle their own clicks via stopPropagation; guard defensively
    const target = e.target;
    if (target.type === 'checkbox' || target.tagName === 'BUTTON' || target.closest('button')) return;

    const { item, onSelect, isSelected, onImageClick } = this.props;

    if (onSelect) {
      onSelect(item, !isSelected);
    } else if (onImageClick) {
      onImageClick(item);
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

  handleViewClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const { item } = this.props;
    if (item && item.imageUrl && !this.state.imageError) {
      createImageModal(item.imageUrl, false);
    }
  }

  render() {
    const { item, onSelect, isSelected, disableCheckbox = false, disabled = false } = this.props;
    const { imageError, isAudioPlaying } = this.state;
    const hasAudio = item && item.audioUrl;
    const hasViewButton = item && item.type !== 'audio';

    return html`
      <${GalleryItemContainer}
        disabled=${disabled}
        onMouseEnter=${this.handleMouseEnter}
        onMouseLeave=${this.handleMouseLeave}
      >
        ${onSelect && html`
          <${GalleryItemCheckboxContainer} onClick=${(e) => e.stopPropagation()}>
            <${Checkbox}
              checked=${isSelected || false}
              disabled=${disableCheckbox}
              onChange=${this.handleCheckboxChange}
              label=${null}
            />
          </${GalleryItemCheckboxContainer}>
        `}
        <${GalleryItemImage}
          src=${item.imageUrl || ''}
          alt=${item.name || 'Generated image'}
          imageError=${imageError}
          disabled=${disabled}
          onError=${this.handleImageError}
          onClick=${this.handleCardClick}
        >
          ${imageError && 'No image'}
        </${GalleryItemImage}>
        <${GalleryItemInfo}>
          <${Panel} variant="glass" style=${{ padding: '8px 8px' }}>
            <${GalleryItemInfoContent} hasAudio=${hasAudio} hasViewButton=${hasViewButton}>
              ${hasAudio && html`
                <${GalleryAudioButton} onClick=${this.handleAudioToggle}>
                  <${Button}
                    variant="small-icon"
                    icon=${isAudioPlaying ? 'stop' : 'play'}
                    title=${isAudioPlaying ? 'Stop' : 'Play'}
                  />
                </${GalleryAudioButton}>
              `}
              ${hasViewButton && html`
                <${GalleryViewButton} onClick=${this.handleViewClick}>
                  <${Button}
                    variant="small-icon"
                    icon="open_in_new"
                    title="View image"
                  />
                </${GalleryViewButton}>
              `}
              <${GalleryItemTextContent}>
                <${GalleryItemName}>
                  ${item.name || 'Unnamed'}
                </${GalleryItemName}>
                <${GalleryItemDate}>
                  ${this.formatDate(item.timestamp)}
                </${GalleryItemDate}>
              </${GalleryItemTextContent}>
            </${GalleryItemInfoContent}>
          </${Panel}>
        </${GalleryItemInfo}>
      </${GalleryItemContainer}>
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