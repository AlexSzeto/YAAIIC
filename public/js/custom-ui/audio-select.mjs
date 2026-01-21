import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { Button } from './button.mjs';
import { Panel } from './panel.mjs';
import { globalAudioPlayer } from '../global-audio-player.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 200px;
`;

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
`;

const SelectArea = styled('div')`
  position: relative;
  width: 152px;
  height: 152px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: ${props => props.border};
  border-radius: ${props => props.borderRadius};
  background-color: ${props => props.backgroundColor};
  cursor: ${props => props.cursor};
  transition: ${props => props.transition};
  opacity: ${props => props.opacity};
  background-image: ${props => props.backgroundImage};
  background-size: ${props => props.backgroundSize};
  background-position: ${props => props.backgroundPosition};
  
  &:hover {
    border-color: ${props => props.hoverBorderColor};
  }
`;

const Header = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: ${props => props.gap};
  padding: ${props => props.padding};
  background: ${props => props.background};
`;

const AudioName = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
`;

const OverlayWrapper = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  opacity: 0;
  padding: ${props => props.padding};
  transition: ${props => props.transition};
  
  ${SelectArea}:hover & {
    opacity: 1;
  }
`;

const OverlayContent = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${props => props.gap};
`;

const EmptyState = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${props => props.gap};
`;

const EmptyText = styled('div')`
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
`;

/**
 * AudioSelect Component
 * A reusable component for selecting audio files via gallery.
 * Displays a preview area with album art background, audio name header,
 * and overlay controls for clearing, playing/pausing, and replacing audio.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the select area
 * @param {string|Object} [props.value] - Current audio value (URL string or media data object with audioUrl, name, and imageUrl)
 * @param {Function} [props.onChange] - Called with null when audio is cleared: (null) => void
 * @param {Function} [props.onSelectFromGallery] - Called when user wants to select from gallery
 * @param {boolean} [props.disabled=false] - Disables all interactions
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic usage with URL
 * <AudioSelect 
 *   label="Background Music"
 *   value={audioUrl}
 *   onChange={(url) => setAudioUrl(url)}
 *   onSelectFromGallery={() => openAudioGallery()}
 * />
 * 
 * @example
 * // With media data object (includes album art)
 * <AudioSelect 
 *   label="Audio Track"
 *   value={{ audioUrl: '/audio.mp3', name: 'Track Name', imageUrl: '/album.jpg' }}
 *   onChange={handleChange}
 *   onSelectFromGallery={() => openGalleryModal()}
 * />
 */
export class AudioSelect extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value,
      audioUrl: null,
      audioName: null,
      albumImageUrl: null,
      isPlaying: false
    };
  }

  componentDidMount() {
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
    
    this.unsubscribePlayer = globalAudioPlayer.subscribe(() => {
      if (this.state.audioUrl) {
        this.setState({ isPlaying: globalAudioPlayer.isPlaying(this.state.audioUrl) });
      }
    });
    
    this.updateAudioState();
  }

  componentWillUnmount() {
    if (this.unsubscribeTheme) {
      this.unsubscribeTheme();
    }
    if (this.unsubscribePlayer) {
      this.unsubscribePlayer();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.updateAudioState();
    }
  }

  updateAudioState() {
    const { value } = this.props;
    
    if (!value) {
      this.setState({
        audioUrl: null,
        audioName: null,
        albumImageUrl: null,
        isPlaying: false
      });
      return;
    }

    if (typeof value === 'string') {
      this.setState({
        audioUrl: value,
        audioName: 'Audio File',
        albumImageUrl: null
      });
    } else if (value && typeof value === 'object') {
      // Assume it's media data with audioUrl, name, and imageUrl (album cover)
      this.setState({
        audioUrl: value.audioUrl || null,
        audioName: value.name || 'Audio File',
        albumImageUrl: value.imageUrl || null
      });
    }
  }

  handleBrowseClick = (e) => {
    e.stopPropagation();
    if (this.props.disabled) return;
    if (this.props.onSelectFromGallery) {
      this.props.onSelectFromGallery();
    }
  };

  handleClearClick = (e) => {
    e.stopPropagation();
    if (this.props.disabled) return;
    if (this.props.onChange) this.props.onChange(null);
  };

  handleReplaceClick = (e) => {
    e.stopPropagation();
    if (this.props.disabled) return;
    if (this.props.onSelectFromGallery) {
      this.props.onSelectFromGallery();
    }
  };

  handlePlayPauseClick = (e) => {
    e.stopPropagation();
    const { audioUrl } = this.state;
    if (this.props.disabled || !audioUrl) return;
    globalAudioPlayer.toggle(audioUrl);
  };

  render() {
    const { label, disabled = false } = this.props;
    const { theme, audioUrl, audioName, albumImageUrl, isPlaying } = this.state;

    return html`
      <${Container}>
        ${label ? html`
          <${Label} 
            color=${theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
          >${label}</${Label}>
        ` : ''}
        
        <${SelectArea} 
          border=${audioUrl 
            ? `2px solid ${theme.colors.border.primary}` 
            : `2px dashed ${theme.colors.border.secondary}`}
          borderRadius=${theme.spacing.medium.borderRadius}
          backgroundColor=${theme.colors.background.tertiary}
          cursor=${disabled ? 'default' : 'pointer'}
          transition=${`border-color ${theme.transitions.fast}, background-color ${theme.transitions.fast}`}
          opacity=${disabled ? '0.4' : '1'}
          backgroundImage=${audioUrl && albumImageUrl ? `url('${albumImageUrl}')` : 'none'}
          backgroundSize="cover"
          backgroundPosition="center"
          hoverBorderColor=${theme.colors.primary.background}
          onClick=${audioUrl ? null : this.handleBrowseClick}
        >
          ${audioUrl ? html`
            <!-- Audio Selected State with Album Background -->
            <${Header} 
              gap=${theme.spacing.small.gap}
              padding=${theme.spacing.small.padding}
              background=${`linear-gradient(${theme.colors.overlay.backgroundStrong}, transparent)`}
            >
              <box-icon name='music' color='white' size='20px'></box-icon>
              <${AudioName} 
                color=${theme.colors.text.secondary}
                fontSize=${theme.typography.fontSize.small}
              >${audioName}</${AudioName}>
            </${Header}>
            
            <!-- Control Buttons at Bottom -->
            ${!disabled ? html`
              <${OverlayWrapper} 
                padding=${theme.spacing.small.padding}
                transition=${`opacity ${theme.transitions.fast}`}
              >
                <${Panel} variant="glass">
                  <${OverlayContent} gap=${theme.spacing.small.gap}>
                    <${Button}
                      variant="small-icon"
                      color="secondary"
                      icon=${isPlaying ? 'pause' : 'play'}
                      onClick=${this.handlePlayPauseClick}
                      title=${isPlaying ? 'Pause' : 'Play'}
                    />
                    <${Button}
                      variant="small-icon"
                      color="secondary"
                      icon="music"
                      onClick=${this.handleReplaceClick}
                      title="Replace audio"
                    />
                    <${Button}
                      variant="small-icon"
                      color="danger"
                      icon="x"
                      onClick=${this.handleClearClick}
                      title="Clear audio"
                    />
                  </${OverlayContent}>
                </${Panel}>
              </${OverlayWrapper}>
            ` : ''}
          ` : html`
            <!-- Empty State -->
            <${EmptyState} gap=${theme.spacing.small.gap}>
              <box-icon name='music' color=${theme.colors.text.muted} size='48px'></box-icon>
              <${EmptyText} 
                color=${theme.colors.text.muted}
                fontSize=${theme.typography.fontSize.small}
              >Select Audio</${EmptyText}>
            </${EmptyState}>
          `}
        </${SelectArea}>
      </${Container}>
    `;
  }
}
