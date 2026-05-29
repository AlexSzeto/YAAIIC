/**
 * Global Audio Player State Manager
 *
 * Manages multiple independent audio channels. Channel 0 is the legacy voice
 * channel; channel 1 is reserved for SFX. Additional channels can be added
 * without any code changes — they are created lazily on first use.
 *
 * All public methods accept an optional `channel` parameter (default 0) so
 * existing call sites require no changes.
 */

class GlobalAudioPlayer {
  constructor() {
    // Sparse array of channel slots; each slot is created lazily by _getChannel().
    // Slot shape: { audioElement, currentAudioUrl, currentInstanceId, _regionEndHandler }
    this._channels = [];
    this.listeners = new Set();
  }

  /**
   * Return the channel slot at `idx`, creating it lazily if needed.
   * @param {number} idx
   * @returns {{ audioElement: HTMLAudioElement, currentAudioUrl: string|null, currentInstanceId: any, _regionEndHandler: Function|null }}
   */
  _getChannel(idx) {
    if (!this._channels[idx]) {
      const audioElement = document.createElement('audio');
      audioElement.addEventListener('play', () => this.notifyListeners());
      audioElement.addEventListener('pause', () => this.notifyListeners());
      audioElement.addEventListener('ended', () => this.notifyListeners());
      audioElement.addEventListener('loadedmetadata', () => this.notifyListeners());
      this._channels[idx] = {
        audioElement,
        currentAudioUrl: null,
        currentInstanceId: null,
        _regionEndHandler: null,
      };
    }
    return this._channels[idx];
  }

  _clearRegionEnd(ch) {
    if (ch._regionEndHandler) {
      ch.audioElement.removeEventListener('timeupdate', ch._regionEndHandler);
      ch._regionEndHandler = null;
    }
  }

  _setupRegionEnd(ch, endTime) {
    ch._regionEndHandler = () => {
      if (ch.audioElement.currentTime >= endTime) {
        ch.audioElement.pause();
        this._clearRegionEnd(ch);
        this.notifyListeners();
      }
    };
    ch.audioElement.addEventListener('timeupdate', ch._regionEndHandler);
  }

  /**
   * Play audio from a URL, optionally within a time region.
   * @param {string} audioUrl
   * @param {{ start?: number, end?: number }|null} [region]
   * @param {any} [instanceId] - Unique ID of the calling AudioPlayer instance
   * @param {number} [channel=0] - Audio channel index
   */
  play(audioUrl, region = null, instanceId = null, channel = 0) {
    const ch = this._getChannel(channel);
    this._clearRegionEnd(ch);

    const sameUrl = ch.currentAudioUrl === audioUrl;

    if (sameUrl && region) {
      // Re-play same URL from the region start point
      const startTime = region.start ?? 0;
      ch.currentInstanceId = instanceId;
      if (ch.audioElement.readyState >= 2) {
        ch.audioElement.currentTime = startTime;
        if (ch.audioElement.paused) ch.audioElement.play();
      } else {
        ch.audioElement.addEventListener('canplay', () => {
          if (ch.currentAudioUrl !== audioUrl) return; // guard against stale call
          ch.audioElement.currentTime = startTime;
          ch.audioElement.play();
        }, { once: true });
      }
    } else if (sameUrl) {
      // Resume plain playback of the same URL
      ch.currentInstanceId = instanceId;
      if (ch.audioElement.paused) {
        ch.audioElement.play();
      }
    } else {
      // New URL — stop current channel and load the new one
      this.stop(channel);
      ch.currentAudioUrl = audioUrl;
      ch.currentInstanceId = instanceId;
      ch.audioElement.src = audioUrl;

      if (region && region.start != null) {
        const startTime = region.start;
        ch.audioElement.addEventListener('canplay', () => {
          if (ch.currentAudioUrl !== audioUrl) return; // guard against stale call
          ch.audioElement.currentTime = startTime;
          ch.audioElement.play();
        }, { once: true });
      } else {
        ch.audioElement.play();
      }
    }

    if (region && region.end != null) {
      this._setupRegionEnd(ch, region.end);
    }

    this.notifyListeners();
  }

  /**
   * Stop the currently playing audio on the given channel.
   * @param {number} [channel=0] - Audio channel index
   */
  stop(channel = 0) {
    if (!this._channels[channel]) return; // channel was never used — nothing to stop
    const ch = this._channels[channel];
    this._clearRegionEnd(ch);

    if (!ch.audioElement.paused) {
      ch.audioElement.pause();
    }
    ch.audioElement.currentTime = 0;
    ch.currentAudioUrl = null;
    ch.currentInstanceId = null;
    this.notifyListeners();
  }

  /**
   * Toggle play/pause for a given audio URL, optionally within a time region.
   * @param {string} audioUrl
   * @param {{ start?: number, end?: number }|null} [region]
   * @param {any} [instanceId] - Unique ID of the calling AudioPlayer instance
   * @param {number} [channel=0] - Audio channel index
   */
  toggle(audioUrl, region = null, instanceId = null, channel = 0) {
    const ch = this._getChannel(channel);

    if (
      ch.currentInstanceId === instanceId &&
      ch.currentAudioUrl === audioUrl &&
      !ch.audioElement.paused
    ) {
      // This exact instance is already playing — stop it
      this.stop(channel);
    } else {
      // A different instance (or stopped) — start playback for this instance
      this.play(audioUrl, region, instanceId, channel);
    }
  }

  /**
   * Check if a specific AudioPlayer instance is currently playing.
   * @param {string} audioUrl
   * @param {any} [instanceId]
   * @param {number} [channel=0] - Audio channel index
   */
  isPlaying(audioUrl, instanceId = null, channel = 0) {
    if (!this._channels[channel]) return false;
    const ch = this._channels[channel];
    return ch.currentAudioUrl === audioUrl &&
           ch.currentInstanceId === instanceId &&
           !ch.audioElement.paused;
  }

  /**
   * Subscribe to player state changes (shared across all channels).
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change.
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
    this._targetGain = 1.0;
    this._stopFadeId = 0;
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
    if (typeof item === 'string') return { url: item, startTime: 0, duration: null, label: null };
    return { url: item.url, startTime: item.startTime ?? 0, duration: item.duration ?? null, label: item.label ?? null };
  }

  /**
   * Set the playlist. Each item is a URL string or `{ url, startTime?, duration?, label? }`.
   * @param {(string|{ url:string, startTime?:number, duration?:number, label?:string })[]} items
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

  /**
   * Set the master gain for BGM playback. Applied immediately if playing.
   * @param {number} value - 0 (silent) to 1 (full volume)
   */
  setGain(value) {
    this._targetGain = Math.max(0, Math.min(1, value));
    if (!this._isPlaying || !this._context) return;
    const ctx = this._context;
    const now = ctx.currentTime;
    const { gain } = this._slots[this._activeSlot];
    if (!gain) return;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(this._targetGain, now + 0.2);
    } catch (e) {}
  }

  /** Start playback from the first track. No-op if already playing or playlist is empty. */
  async play() {
    this._stopFadeId++; // cancel any in-flight fade-out from stop()
    if (this._playlist.length === 0 || this._isPlaying) return;
    this._isPlaying = true;
    this._initSlots();
    await this._playTrackAt(0);
  }

  /**
   * Append a track to the end of the queue. Starts playback immediately if not already playing.
   * @param {string|{ url:string, startTime?:number, duration?:number, label?:string }} item
   */
  async appendToPlaylist(item) {
    this._playlist.push(this._normalise(item));
    if (!this._isPlaying) {
      this._isPlaying = true;
      this._initSlots();
      await this._playTrackAt(0);
    } else {
      this._notifyListeners({ event: 'playlist-updated', total: this._playlist.length });
    }
  }

  /**
   * Skip the currently playing track and immediately crossfade/fade into the next.
   * Stops playback if the queue has no next track.
   */
  skipCurrent() {
    if (!this._isPlaying || this._playlist.length === 0) return;
    if (this._advanceTimer !== null) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
    this._playId++;
    this._consumeAndAdvance();
  }

  /** Stop playback and reset the playlist, fading out smoothly if audio is active. */
  stop() {
    this._playId++;
    this._stopFadeId++;
    const capturedStopFadeId = this._stopFadeId;

    if (this._advanceTimer !== null) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }

    const ctx = this._context;
    if (ctx && this._isPlaying) {
      const now = ctx.currentTime;
      const fadeDuration = Math.min(this._transition.durationSeconds, 1.5);
      for (const { gain } of this._slots) {
        if (gain) {
          try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
          } catch (e) {}
        }
      }
      setTimeout(() => {
        if (this._stopFadeId !== capturedStopFadeId) return;
        for (const { audio } of this._slots) {
          if (audio) { try { audio.pause(); } catch (e) {} }
        }
      }, fadeDuration * 1000 + 50);
    } else {
      for (const { audio } of this._slots) {
        if (audio) { try { audio.pause(); } catch (e) {} }
      }
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
    return { url: item.url, label: item.label || this._urlToLabel(item.url), index: this._currentIndex, total: this._playlist.length };
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

  _consumeAndAdvance() {
    this._playlist.splice(0, 1);
    if (this._playlist.length > 0) {
      this._playTrackAt(0);
    } else {
      const ctx = this._context;
      const now = ctx ? ctx.currentTime : 0;
      for (const { audio, gain } of this._slots) {
        if (audio) { try { audio.pause(); } catch (e) {} }
        if (gain && ctx) { try { gain.gain.setValueAtTime(0, now); } catch (e) {} }
      }
      this._isPlaying = false;
      this._currentIndex = -1;
      this._currentDuration = 0;
      this._notifyListeners({ event: 'stop' });
    }
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
    gain.gain.linearRampToValueAtTime(this._targetGain, now + fadeDuration);

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

    this._notifyListeners({ event: 'track-start', url: item.url, label: item.label || this._urlToLabel(item.url), index, total: this._playlist.length });

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
        this._consumeAndAdvance();
      }, advanceAfterMs);
    } else {
      // Duration unknown yet — fall back to audio ended event
      const capturedPlayId = playId;
      audio.addEventListener('ended', () => {
        if (this._playId !== capturedPlayId || this._activeSlot !== slot) return;
        this._consumeAndAdvance();
      }, { once: true });
    }
  }
}

export const globalBgmPlayer = new GlobalBgmPlayer();
