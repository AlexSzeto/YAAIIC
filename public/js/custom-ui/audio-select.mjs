import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { Button } from './button.mjs';
import { globalAudioPlayer } from '../global-audio-player.mjs';

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

    const Container = styled('div')`
      display: flex;
      flex-direction: column;
      min-width: 200px;
    `;

    const Label = styled('label')`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.fontSize.medium};
      margin-bottom: 5px;
      font-weight: ${theme.typography.fontWeight.medium};
    `;

    const SelectArea = styled('div')`
      position: relative;
      width: 152px;
      height: 152px;
      border: 2px dashed ${theme.colors.border.secondary};
      border-radius: ${theme.spacing.medium.borderRadius};
      background-color: ${theme.colors.background.tertiary};
      cursor: ${disabled ? 'default' : 'pointer'};
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: border-color ${theme.transitions.fast}, background-color ${theme.transitions.fast};
      opacity: ${disabled ? '0.4' : '1'};
      
      ${!disabled && !audioUrl ? `
        &:hover {
          border-color: ${theme.colors.primary.background};
          background-color: ${theme.colors.background.hover};
        }
      ` : ''}
      
      ${audioUrl ? `
        border-style: solid;
        border-color: ${theme.colors.border.primary};
        ${albumImageUrl ? `
          background-image: url('${albumImageUrl}');
          background-size: cover;
          background-position: center;
        ` : ''}
      ` : ''}
    `;

    const Header = styled('div')`
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: ${theme.spacing.small.gap};
      padding: ${theme.spacing.small.padding};
      background: linear-gradient(${theme.colors.overlay.backgroundStrong}, transparent);
    `;

    const AudioName = styled('span')`
      color: ${theme.colors.text.inverse};
      font-size: ${theme.typography.fontSize.small};
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      flex: 1;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    `;

    const Overlay = styled('div')`
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: flex-end;
      padding: ${theme.spacing.small.padding};
      gap: ${theme.spacing.small.gap};
      background: linear-gradient(transparent, ${theme.colors.overlay.backgroundStrong});
      opacity: 0;
      transition: opacity ${theme.transitions.fast};
      
      ${SelectArea}:hover & {
        opacity: 1;
      }
    `;

    const EmptyState = styled('div')`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${theme.spacing.small.gap};
    `;

    const EmptyText = styled('div')`
      color: ${theme.colors.text.muted};
      font-size: ${theme.typography.fontSize.small};
    `;

    return html`
      <${Container}>
        ${label ? html`<${Label}>${label}</${Label}>` : ''}
        
        <${SelectArea} onClick=${audioUrl ? null : this.handleBrowseClick}>
          ${audioUrl ? html`
            <!-- Audio Selected State with Album Background -->
            <${Header}>
              <box-icon name='music' color='white' size='20px'></box-icon>
              <${AudioName}>${audioName}</${AudioName}>
            </${Header}>
            
            <!-- Control Buttons at Bottom -->
            ${!disabled ? html`
              <${Overlay}>
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
              </${Overlay}>
            ` : ''}
          ` : html`
            <!-- Empty State -->
            <${EmptyState}>
              <box-icon name='music' color=${theme.colors.text.muted} size='48px'></box-icon>
              <${EmptyText}>Select Audio</${EmptyText}>
            </${EmptyState}>
          `}
        </${SelectArea}>
      </${Container}>
    `;
  }
}
