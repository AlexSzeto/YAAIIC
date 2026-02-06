import { html } from 'htm/preact';
import { Component, createRef } from 'preact';
import { styled, css } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Panel } from '../layout/panel.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Wrapper = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: ${props => props.padding};
`;
Wrapper.className = 'wrapper';

const Controls = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  gap: ${props => props.gap};
`;
Controls.className = 'controls';

const TimelineWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  gap: ${props => props.gap};
`;
TimelineWrapper.className = 'timeline-wrapper';

const Time = styled('span')`
  font-family: monospace;
  min-width: 40px;
  text-align: center;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
`;
Time.className = 'time';

const ProgressBar = styled('div')`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
  background-color: ${props => props.backgroundColor};
  transition: ${props => props.transition};
  
  &:hover {
    height: 8px;
  }
`;
ProgressBar.className = 'progress-bar';

const ProgressFill = styled('div')`
  height: 100%;
  border-radius: 3px;
  transition: width 0.1s linear;
  width: ${props => props.width};
  background-color: ${props => props.backgroundColor};
`;
ProgressFill.className = 'progress-fill';

// =========================================================================
// AudioTimeline Component (isolated to prevent parent re-renders)
// =========================================================================

/**
 * AudioTimeline Component
 * Displays progress bar and time information for audio playback.
 * Manages its own currentTime state to prevent parent re-renders.
 * 
 * @param {Object} props
 * @param {HTMLAudioElement} props.audioElement - Reference to the audio element
 * @param {number} props.duration - Total duration of the audio
 */
class AudioTimeline extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value,
      currentTime: 0
    };
  }

  componentDidMount() {
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });

    const { audioElement } = this.props;
    if (audioElement) {
      audioElement.addEventListener('timeupdate', this.handleTimeUpdate);
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeTheme) {
      this.unsubscribeTheme();
    }

    const { audioElement } = this.props;
    if (audioElement) {
      audioElement.removeEventListener('timeupdate', this.handleTimeUpdate);
    }
  }

  componentDidUpdate(prevProps) {
    // Handle audioElement changes (e.g., when audio source changes)
    if (prevProps.audioElement !== this.props.audioElement) {
      if (prevProps.audioElement) {
        prevProps.audioElement.removeEventListener('timeupdate', this.handleTimeUpdate);
      }
      if (this.props.audioElement) {
        this.props.audioElement.addEventListener('timeupdate', this.handleTimeUpdate);
      }
    }
  }

  handleTimeUpdate = () => {
    const { audioElement } = this.props;
    if (audioElement) {
      this.setState({ currentTime: audioElement.currentTime });
    }
  };

  handleProgressClick = (e) => {
    const { audioElement, duration } = this.props;
    if (!audioElement) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioElement.currentTime = newTime;
    this.setState({ currentTime: newTime });
  };

  formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  render() {
    const { duration } = this.props;
    const { theme, currentTime } = this.state;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return html`
      <${TimelineWrapper} gap=${theme.spacing.small.gap}>
        <${Time} 
          color=${theme.colors.text.secondary}
          fontSize=${theme.typography.fontSize.small}
        >${this.formatTime(currentTime)}</${Time}>
        
        <${ProgressBar} 
          backgroundColor=${theme.colors.overlay.background}
          transition=${`height ${theme.transitions.fast}`}
          onClick=${this.handleProgressClick}
        >
          <${ProgressFill} 
            width=${`${progress}%`}
            backgroundColor=${theme.colors.primary.background}
          />
        </${ProgressBar}>
        
        <${Time} 
          color=${theme.colors.text.secondary}
          fontSize=${theme.typography.fontSize.small}
        >${this.formatTime(duration)}</${Time}>
      </${TimelineWrapper}>
    `;
  }
}

// =========================================================================
// AudioPlayer Component
// =========================================================================

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
      audio.removeEventListener('ended', this.handleEnded);
      audio.removeEventListener('error', this.handleError);
      
      // Pause and cleanup audio element
      audio.pause();
      audio.src = '';
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

  render() {
    const { audioUrl } = this.props;
    const { theme, isPlaying, duration, isLoading } = this.state;

    if (!audioUrl) return null;

    return html`
      <${Wrapper} padding=${theme.spacing.small.padding}>
        <audio 
          ref=${this.audioRef}
          src=${audioUrl}
          preload="metadata"
        />
        
        <${Panel} variant="glass" padding="small">
          <${Controls} gap=${theme.spacing.medium.gap}>
            <${Button}
              variant="medium-icon"
              color="secondary"
              icon=${isPlaying ? 'pause' : 'play'}
              onClick=${this.togglePlayPause}
              disabled=${isLoading}
              title=${isPlaying ? 'Pause' : 'Play'}
            />
            
            <${AudioTimeline}
              audioElement=${this.audioRef.current}
              duration=${duration}
            />
          </${Controls}>
        </${Panel}>
      </${Wrapper}>
    `;
  }
}
