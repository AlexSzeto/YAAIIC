import { html } from 'htm/preact';
import { Component, createRef } from 'preact';
import { styled, css } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { Button } from './button.mjs';
import { Panel } from './panel.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Wrapper = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
`;

const Controls = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
`;

const Timeline = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
`;

const Time = styled('span')`
  font-family: monospace;
  min-width: 40px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  text-align: center;
`;

const ProgressBar = styled('div')`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
  
  &:hover {
    height: 8px;
  }
`;

const ProgressFill = styled('div')`
  height: 100%;
  border-radius: 3px;
  transition: width 0.1s linear;
`;

/**
 * AudioPlayer Component
 * An overlay audio player with play/pause, progress bar, and time display.
 * Designed to sit at the bottom of an album image or as a standalone player.
 * 
 * @param {Object} props
 * @param {string} props.audioUrl - URL of the audio file to play (required)
 * @returns {preact.VNode|null} Returns null if audioUrl is not provided
 * 
 * @example
 * // Basic usage
 * <AudioPlayer audioUrl="/path/to/audio.mp3" />
 * 
 * @example
 * // As overlay on album image
 * <div style="position: relative;">
 *   <img src="/album-cover.jpg" />
 *   <AudioPlayer audioUrl="/audio.mp3" />
 * </div>
 */
export class AudioPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoading: true
    };
    this.audioRef = createRef();
  }

  componentDidMount() {
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });

    const audio = this.audioRef.current;
    if (audio) {
      audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
      audio.addEventListener('timeupdate', this.handleTimeUpdate);
      audio.addEventListener('ended', this.handleEnded);
      audio.addEventListener('error', this.handleError);
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeTheme) {
      this.unsubscribeTheme();
    }

    const audio = this.audioRef.current;
    if (audio) {
      audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
      audio.removeEventListener('timeupdate', this.handleTimeUpdate);
      audio.removeEventListener('ended', this.handleEnded);
      audio.removeEventListener('error', this.handleError);
    }
  }

  handleLoadedMetadata = () => {
    const audio = this.audioRef.current;
    if (audio) {
      this.setState({
        duration: audio.duration,
        isLoading: false
      });
    }
  };

  handleTimeUpdate = () => {
    const audio = this.audioRef.current;
    if (audio) {
      this.setState({ currentTime: audio.currentTime });
    }
  };

  handleEnded = () => {
    this.setState({ isPlaying: false });
  };

  handleError = (e) => {
    console.error('Audio error:', e);
    this.setState({ isLoading: false });
  };

  togglePlayPause = () => {
    const audio = this.audioRef.current;
    if (!audio) return;

    if (this.state.isPlaying) {
      audio.pause();
      this.setState({ isPlaying: false });
    } else {
      audio.play();
      this.setState({ isPlaying: true });
    }
  };

  handleProgressClick = (e) => {
    const audio = this.audioRef.current;
    if (!audio) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * this.state.duration;

    audio.currentTime = newTime;
    this.setState({ currentTime: newTime });
  };

  formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  render() {
    const { audioUrl } = this.props;
    const { theme, isPlaying, currentTime, duration, isLoading } = this.state;

    if (!audioUrl) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Dynamic styles based on theme
    const wrapperStyle = {
      padding: theme.spacing.small.padding
    };

    const controlsStyle = {
      gap: theme.spacing.medium.gap
    };

    const timelineStyle = {
      gap: theme.spacing.small.gap
    };

    const timeStyle = {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.fontSize.small
    };

    const progressBarStyle = {
      backgroundColor: theme.colors.overlay.background,
      transition: `height ${theme.transitions.fast}`
    };

    const progressFillStyle = {
      width: `${progress}%`,
      backgroundColor: theme.colors.primary.background
    };

    return html`
      <${Wrapper} style=${wrapperStyle}>
        <audio 
          ref=${this.audioRef}
          src=${audioUrl}
          preload="metadata"
        />
        
        <${Panel} variant="glass">
          <${Controls} style=${controlsStyle}>
              <${Button}
                variant="medium-icon"
                color="secondary"
                icon=${isPlaying ? 'pause' : 'play'}
                onClick=${this.togglePlayPause}
                disabled=${isLoading}
                title=${isPlaying ? 'Pause' : 'Play'}
              />
            
            <${Timeline} style=${timelineStyle}>
              <${Time} style=${timeStyle}>${this.formatTime(currentTime)}</${Time}>
              
              <${ProgressBar} style=${progressBarStyle} onClick=${this.handleProgressClick}>
                <${ProgressFill} style=${progressFillStyle} />
              </${ProgressBar}>
              
              <${Time} style=${timeStyle}>${this.formatTime(duration)}</${Time}>
            </${Timeline}>
          </${Controls}>
        </${Panel}>
      </${Wrapper}>
    `;
  }
}
