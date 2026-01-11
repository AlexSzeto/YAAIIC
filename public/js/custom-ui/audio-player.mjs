import { html } from 'htm/preact';
import { Component, createRef } from 'preact';
import { Button } from './button.mjs';

/**
 * AudioPlayer Component
 * An overlay audio player with play/pause, progress bar, and time display
 * Designed to sit at the bottom of an album image
 */
export class AudioPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoading: true
    };
    this.audioRef = createRef();
  }

  componentDidMount() {
    const audio = this.audioRef.current;
    if (audio) {
      audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
      audio.addEventListener('timeupdate', this.handleTimeUpdate);
      audio.addEventListener('ended', this.handleEnded);
      audio.addEventListener('error', this.handleError);
    }
  }

  componentWillUnmount() {
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
    const { isPlaying, currentTime, duration, isLoading } = this.state;

    if (!audioUrl) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return html`
      <div class="audio-player-overlay overlay-panel">
        <audio 
          ref=${this.audioRef}
          src=${audioUrl}
          preload="metadata"
        />
        
        <div class="audio-player-controls">
          <${Button}
            variant="icon-nav"
            icon=${isPlaying ? 'pause' : 'play'}
            onClick=${this.togglePlayPause}
            disabled=${isLoading}
            title=${isPlaying ? 'Pause' : 'Play'}
          />
          
          <div class="audio-player-timeline">
            <span class="audio-time">${this.formatTime(currentTime)}</span>
            
            <div 
              class="audio-progress-bar"
              onClick=${this.handleProgressClick}
            >
              <div 
                class="audio-progress-fill"
                style=${{ width: `${progress}%` }}
              />
            </div>
            
            <span class="audio-time">${this.formatTime(duration)}</span>
          </div>
        </div>
      </div>
    `;
  }
}
