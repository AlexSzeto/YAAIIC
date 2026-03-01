/**
 * Global Audio Player State Manager
 * Manages a single audio element that can be controlled from anywhere in the app
 */

class GlobalAudioPlayer {
  constructor() {
    this.audioElement = null;
    this.currentAudioUrl = null;
    // Tracks which specific AudioPlayer instance owns the current playback,
    // so that multiple instances sharing the same URL don't all appear active.
    this.currentInstanceId = null;
    this.listeners = new Set();
    this._regionEndHandler = null;
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

  _clearRegionEndListener() {
    if (this._regionEndHandler) {
      this.audioElement && this.audioElement.removeEventListener('timeupdate', this._regionEndHandler);
      this._regionEndHandler = null;
    }
  }

  _setupRegionEndListener(endTime) {
    this._regionEndHandler = () => {
      if (this.audioElement.currentTime >= endTime) {
        this.audioElement.pause();
        this._clearRegionEndListener();
        this.notifyListeners();
      }
    };
    this.audioElement.addEventListener('timeupdate', this._regionEndHandler);
  }

  /**
   * Play audio from a URL, optionally within a time region.
   * @param {string} audioUrl
   * @param {{ start?: number, end?: number }|null} [region]
   * @param {number|null} [instanceId] - Unique ID of the calling AudioPlayer instance
   */
  play(audioUrl, region = null, instanceId = null) {
    this.init();
    this._clearRegionEndListener();

    const sameUrl = this.currentAudioUrl === audioUrl;

    if (sameUrl && region) {
      // Re-play same URL from the region start point
      const startTime = region.start ?? 0;
      this.currentInstanceId = instanceId;
      if (this.audioElement.readyState >= 2) {
        this.audioElement.currentTime = startTime;
        if (this.audioElement.paused) this.audioElement.play();
      } else {
        this.audioElement.addEventListener('canplay', () => {
          if (this.currentAudioUrl !== audioUrl) return; // guard against stale call
          this.audioElement.currentTime = startTime;
          this.audioElement.play();
        }, { once: true });
      }
    } else if (sameUrl) {
      // Resume plain playback of the same URL
      this.currentInstanceId = instanceId;
      if (this.audioElement.paused) {
        this.audioElement.play();
      }
    } else {
      // New URL — stop current and load the new one
      this.stop();
      this.currentAudioUrl = audioUrl;
      this.currentInstanceId = instanceId;
      this.audioElement.src = audioUrl;

      if (region && region.start != null) {
        const startTime = region.start;
        this.audioElement.addEventListener('canplay', () => {
          if (this.currentAudioUrl !== audioUrl) return; // guard against stale call
          this.audioElement.currentTime = startTime;
          this.audioElement.play();
        }, { once: true });
      } else {
        this.audioElement.play();
      }
    }

    if (region && region.end != null) {
      this._setupRegionEndListener(region.end);
    }

    this.notifyListeners();
  }

  /**
   * Stop the currently playing audio
   */
  stop() {
    this.init();
    this._clearRegionEndListener();

    if (!this.audioElement.paused) {
      this.audioElement.pause();
    }
    this.audioElement.currentTime = 0;
    this.currentAudioUrl = null;
    this.currentInstanceId = null;
    this.notifyListeners();
  }

  /**
   * Toggle play/pause for a given audio URL, optionally within a time region.
   * @param {string} audioUrl
   * @param {{ start?: number, end?: number }|null} [region]
   * @param {number|null} [instanceId] - Unique ID of the calling AudioPlayer instance
   */
  toggle(audioUrl, region = null, instanceId = null) {
    this.init();

    if (
      this.currentInstanceId === instanceId &&
      this.currentAudioUrl === audioUrl &&
      !this.audioElement.paused
    ) {
      // This exact instance is already playing — stop it
      this.stop();
    } else {
      // A different instance (or stopped) — start playback for this instance
      this.play(audioUrl, region, instanceId);
    }
  }

  /**
   * Check if a specific AudioPlayer instance is currently playing.
   * @param {string} audioUrl
   * @param {number|null} [instanceId]
   */
  isPlaying(audioUrl, instanceId = null) {
    return this.currentAudioUrl === audioUrl &&
           this.currentInstanceId === instanceId &&
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
