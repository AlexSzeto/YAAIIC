/**
 * Global Audio Player State Manager
 * Manages a single audio element that can be controlled from anywhere in the app
 */

class GlobalAudioPlayer {
  constructor() {
    this.audioElement = null;
    this.currentAudioUrl = null;
    this.listeners = new Set();
  }

  /**
   * Initialize the audio element
   */
  init() {
    if (!this.audioElement) {
      this.audioElement = document.createElement('audio');
      this.audioElement.addEventListener('play', () => this.notifyListeners());
      this.audioElement.addEventListener('pause', () => this.notifyListeners());
      this.audioElement.addEventListener('ended', () => this.notifyListeners());
      // Notify when metadata (duration) becomes available so UI can update
      this.audioElement.addEventListener('loadedmetadata', () => this.notifyListeners());
    }
  }

  /**
   * Play audio from a URL
   * If already playing this URL, do nothing
   * If playing different URL, stop and play new one
   */
  play(audioUrl) {
    this.init();
    
    if (this.currentAudioUrl === audioUrl) {
      // Same audio - just play if paused
      if (this.audioElement.paused) {
        this.audioElement.play();
      }
    } else {
      // Different audio - stop current and play new
      this.stop();
      this.currentAudioUrl = audioUrl;
      this.audioElement.src = audioUrl;
      this.audioElement.play();
    }
    
    this.notifyListeners();
  }

  /**
   * Stop the currently playing audio
   */
  stop() {
    this.init();
    
    if (!this.audioElement.paused) {
      this.audioElement.pause();
    }
    this.audioElement.currentTime = 0;
    this.currentAudioUrl = null;
    this.notifyListeners();
  }

  /**
   * Toggle play/pause for a given audio URL
   */
  toggle(audioUrl) {
    this.init();
    
    if (this.currentAudioUrl === audioUrl && !this.audioElement.paused) {
      // Currently playing this audio - stop it
      this.stop();
    } else {
      // Not playing or different audio - play it
      this.play(audioUrl);
    }
  }

  /**
   * Check if a specific audio URL is currently playing
   */
  isPlaying(audioUrl) {
    return this.currentAudioUrl === audioUrl && 
           this.audioElement && 
           !this.audioElement.paused;
  }

  /**
   * Subscribe to player state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}

// Export singleton instance
export const globalAudioPlayer = new GlobalAudioPlayer();
