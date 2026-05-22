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

// ============================================================================
// GlobalBgmPlayer — Looping background music player with crossfade support.
//
// Uses two HTMLAudioElement slots (A/B) connected through Web Audio gain nodes
// so that CORS is never an issue for URL playback (audio elements play any URL)
// while still allowing smooth gain-ramp transitions.
//
// Playlist items are either plain URL strings or { url, startTime?, duration? }
// objects.  When startTime is set the audio element seeks to that position before
// playback begins; when duration is set the advance timer fires after that many
// seconds instead of waiting for audio end.
//
// Two channels coexist independently: globalAudioPlayer (voice) and
// globalBgmPlayer (BGM). Neither stops the other.
// ============================================================================

class GlobalBgmPlayer {
  constructor() {
    this._context = null;
    // Two playback slots for crossfade (slot A = 0, slot B = 1)
    this._slots = [
      { audio: null, source: null, gain: null },
      { audio: null, source: null, gain: null },
    ];
    this._activeSlot = 0;
    this._playlist = [];       // normalised { url, startTime, duration|null }
    this._currentIndex = -1;
    this._currentDuration = 0; // effective duration of current segment
    this._transition = { mode: 'crossfade', durationSeconds: 2 };
    this._listeners = new Set();
    this._isPlaying = false;
    this._advanceTimer = null;
    this._playId = 0;
  }

  _getContext() {
    if (!this._context) {
      this._context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._context.state === 'suspended') this._context.resume();
    return this._context;
  }

  _initSlots() {
    const ctx = this._getContext();
    for (let i = 0; i < 2; i++) {
      if (this._slots[i].audio) continue;
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
      this._slots[i] = { audio, source, gain };
    }
  }

  _normalise(item) {
    if (typeof item === 'string') return { url: item, startTime: 0, duration: null };
    return { url: item.url, startTime: item.startTime ?? 0, duration: item.duration ?? null };
  }

  /**
   * Set the playlist. Each item is a URL string or `{ url, startTime?, duration? }`.
   * @param {(string|{ url:string, startTime?:number, duration?:number })[]} items
   */
  setPlaylist(items) {
    this._playlist = items.map(i => this._normalise(i));
  }

  /**
   * Configure the transition between tracks.
   * @param {{ mode: 'crossfade'|'fade', durationSeconds: number }} config
   */
  setTransition(config) {
    this._transition = { ...this._transition, ...config };
  }

  /** Start playback from the first track. No-op if already playing or playlist is empty. */
  async play() {
    if (this._playlist.length === 0 || this._isPlaying) return;
    this._isPlaying = true;
    this._initSlots();
    await this._playTrackAt(0);
  }

  /** Stop playback and reset the playlist. */
  stop() {
    this._playId++;
    if (this._advanceTimer !== null) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
    const ctx = this._context;
    const now = ctx ? ctx.currentTime : 0;
    for (const { audio, gain } of this._slots) {
      if (audio) { try { audio.pause(); } catch (e) {} }
      if (gain && ctx) { try { gain.gain.setValueAtTime(0, now); } catch (e) {} }
    }
    this._isPlaying = false;
    this._playlist = [];
    this._currentIndex = -1;
    this._currentDuration = 0;
    this._notifyListeners({ event: 'stop' });
  }

  /** @returns {boolean} */
  isPlaying() { return this._isPlaying; }

  /**
   * @returns {{ url:string, label:string, index:number, total:number }|null}
   */
  getCurrentTrack() {
    if (!this._isPlaying || this._currentIndex < 0) return null;
    const item = this._playlist[this._currentIndex];
    return { url: item.url, label: this._urlToLabel(item.url), index: this._currentIndex, total: this._playlist.length };
  }

  /**
   * The HTMLAudioElement that is currently playing (null when stopped).
   * Attach a `timeupdate` listener to this to build a live progress bar.
   * @returns {HTMLAudioElement|null}
   */
  getCurrentAudioElement() {
    return this._isPlaying ? this._slots[this._activeSlot].audio : null;
  }

  /**
   * Elapsed seconds within the current segment (accounts for startTime offset).
   * @returns {number}
   */
  getCurrentTime() {
    const audio = this.getCurrentAudioElement();
    if (!audio) return 0;
    const item = this._playlist[this._currentIndex];
    return Math.max(0, audio.currentTime - (item?.startTime ?? 0));
  }

  /**
   * Duration of the current segment in seconds (from playlist item or audio.duration).
   * @returns {number}
   */
  getDuration() { return this._currentDuration; }

  /** @returns {number} 0–1 */
  getProgress() {
    const d = this.getDuration();
    return d > 0 ? Math.min(1, Math.max(0, this.getCurrentTime() / d)) : 0;
  }

  /**
   * Subscribe to player events.
   * Callback receives `{ event: 'track-start'|'stop', url?, label?, index?, total? }`.
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notifyListeners(data) { this._listeners.forEach(cb => cb(data)); }

  _urlToLabel(url) {
    if (!url) return '';
    return decodeURIComponent(url.split('/').pop().replace(/\.[^.]+$/, ''));
  }

  async _playTrackAt(index) {
    if (index < 0 || index >= this._playlist.length) { this.stop(); return; }

    const playId = this._playId;
    const item = this._playlist[index];
    const ctx = this._getContext();
    const fadeDuration = Math.max(0, this._transition.durationSeconds);
    const now = ctx.currentTime;

    // Alternate slots: first track → slot 0; each advance → the other slot
    const slot = this._currentIndex === -1 ? 0 : (1 - this._activeSlot);
    const prevSlot = this._activeSlot;
    const { audio, gain } = this._slots[slot];
    const prevGain = this._slots[prevSlot].gain;
    const prevAudio = this._slots[prevSlot].audio;

    // Load and seek the new slot
    audio.src = item.url;
    audio.currentTime = item.startTime ?? 0;

    // Fade in new slot
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeDuration);

    // Fade out previous slot (if a track was playing)
    if (this._currentIndex >= 0) {
      prevGain.gain.setValueAtTime(prevGain.gain.value, now);
      prevGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      const capturedPrevAudio = prevAudio;
      setTimeout(() => { try { capturedPrevAudio.pause(); } catch (e) {} }, (fadeDuration + 0.05) * 1000);
    }

    this._activeSlot = slot;
    this._currentIndex = index;

    try {
      await audio.play();
    } catch (e) {
      if (this._playId === playId) {
        console.error('[GlobalBgmPlayer] Failed to play:', item.url, e);
        this.stop();
      }
      return;
    }

    if (this._playId !== playId) return;

    // Determine effective duration: prefer explicit segment duration, fall back to audio.duration
    const effectiveDuration = item.duration !== null
      ? item.duration
      : (isFinite(audio.duration) ? audio.duration : 0);
    this._currentDuration = effectiveDuration;

    this._notifyListeners({ event: 'track-start', url: item.url, label: this._urlToLabel(item.url), index, total: this._playlist.length });

    // Schedule advance
    if (this._advanceTimer !== null) clearTimeout(this._advanceTimer);

    if (effectiveDuration > 0) {
      const advanceAfterMs = this._transition.mode === 'crossfade'
        ? Math.max(0, (effectiveDuration - fadeDuration) * 1000)
        : effectiveDuration * 1000;

      const capturedPlayId = playId;
      this._advanceTimer = setTimeout(() => {
        this._advanceTimer = null;
        if (this._playId !== capturedPlayId) return;
        this._playTrackAt((index + 1) % this._playlist.length);
      }, advanceAfterMs);
    } else {
      // Duration unknown yet — fall back to audio ended event
      const capturedPlayId = playId;
      audio.addEventListener('ended', () => {
        if (this._playId !== capturedPlayId || this._activeSlot !== slot) return;
        this._playTrackAt((index + 1) % this._playlist.length);
      }, { once: true });
    }
  }
}

export const globalBgmPlayer = new GlobalBgmPlayer();
