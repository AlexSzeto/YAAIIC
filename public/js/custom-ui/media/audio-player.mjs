import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Panel } from '../layout/panel.mjs';
import { globalAudioPlayer } from '../global-audio-player.mjs';

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
      duration: 0
    };
  }

  componentDidMount() {
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
    // Sync play/pause and duration with the global audio player
    this.unsubscribeAudio = globalAudioPlayer.subscribe(this.handleAudioStateChange);
  }

  componentWillUnmount() {
    if (this.unsubscribeTheme) this.unsubscribeTheme();
    if (this.unsubscribeAudio) this.unsubscribeAudio();

    // Stop audio if this component's URL is currently playing
    const { audioUrl } = this.props;
    if (audioUrl && globalAudioPlayer.isPlaying(audioUrl)) {
      globalAudioPlayer.stop();
    }
  }

  componentDidUpdate(prevProps) {
    // When the audio source changes, stop the previous audio and reset state
    if (prevProps.audioUrl !== this.props.audioUrl) {
      if (prevProps.audioUrl && globalAudioPlayer.isPlaying(prevProps.audioUrl)) {
        globalAudioPlayer.stop();
      }
      this.setState({ isPlaying: false, duration: 0 });
    }
  }

  handleAudioStateChange = () => {
    const { audioUrl } = this.props;
    const isPlaying = globalAudioPlayer.isPlaying(audioUrl);
    const updates = { isPlaying };

    // Update duration when our audio's metadata is available
    if (
      globalAudioPlayer.currentAudioUrl === audioUrl &&
      globalAudioPlayer.audioElement
    ) {
      const d = globalAudioPlayer.audioElement.duration;
      if (isFinite(d)) {
        updates.duration = d;
      }
    }

    this.setState(updates);
  };

  togglePlayPause = () => {
    const { audioUrl } = this.props;
    if (!audioUrl) return;
    globalAudioPlayer.toggle(audioUrl);
  };

  render() {
    const { audioUrl } = this.props;
    const { theme, isPlaying, duration } = this.state;

    if (!audioUrl) return null;

    // Only pass the shared audio element when it is loaded with our URL,
    // so AudioTimeline tracks the correct position and seeking works.
    const audioElement =
      globalAudioPlayer.audioElement &&
      globalAudioPlayer.currentAudioUrl === audioUrl
        ? globalAudioPlayer.audioElement
        : null;

    return html`
      <${Wrapper} padding=${theme.spacing.small.padding}>
        <${Panel} variant="glass" padding="small">
          <${Controls} gap=${theme.spacing.medium.gap}>
            <${Button}
              variant="medium-icon"
              color="secondary"
              icon=${isPlaying ? 'pause' : 'play'}
              onClick=${this.togglePlayPause}
              title=${isPlaying ? 'Pause' : 'Play'}
            />

            <${AudioTimeline}
              audioElement=${audioElement}
              duration=${duration}
            />
          </${Controls}>
        </${Panel}>
      </${Wrapper}>
    `;
  }
}
