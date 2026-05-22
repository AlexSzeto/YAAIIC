import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeMockGainNode() {
  return {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeMockAudioContext() {
  return {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: vi.fn(),
    createGain: vi.fn().mockImplementation(makeMockGainNode),
    createMediaElementSource: vi.fn().mockImplementation(() => ({ connect: vi.fn() })),
  };
}

// Mock Audio constructor — each instance gets its own spy methods
function MockAudio() {
  this.src = '';
  this.currentTime = 0;
  this.duration = 30;
  this.crossOrigin = null;
  this.preload = 'auto';
  this.play = vi.fn().mockResolvedValue(undefined);
  this.pause = vi.fn();
  this.addEventListener = vi.fn();
  this.removeEventListener = vi.fn();
}

// ── globalBgmPlayer tests ────────────────────────────────────────────────────

import { globalBgmPlayer, globalAudioPlayer } from './global-audio-player.mjs';

describe('globalBgmPlayer', () => {
  let mockCtx;

  beforeEach(() => {
    vi.useFakeTimers();

    mockCtx = makeMockAudioContext();
    window.AudioContext = function MockAudioContext() { return mockCtx; };
    window.Audio = MockAudio;

    // Reset singleton state
    globalBgmPlayer.stop();
    globalBgmPlayer._context = null;
    globalBgmPlayer._slots = [
      { audio: null, source: null, gain: null },
      { audio: null, source: null, gain: null },
    ];
    globalBgmPlayer._activeSlot = 0;
    globalBgmPlayer._playId = 0;
  });

  afterEach(() => {
    globalBgmPlayer.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('play() emits track-start with correct metadata', async () => {
    const events = [];
    const unsub = globalBgmPlayer.subscribe(e => events.push(e));

    globalBgmPlayer.setPlaylist(['/audio/track1.mp3']);
    await globalBgmPlayer.play();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'track-start',
      url: '/audio/track1.mp3',
      label: 'track1',
      index: 0,
      total: 1,
    });
    expect(globalBgmPlayer.isPlaying()).toBe(true);
    unsub();
  });

  test('getCurrentTrack returns current track info', async () => {
    globalBgmPlayer.setPlaylist(['/audio/a.mp3', '/audio/b.mp3']);
    await globalBgmPlayer.play();

    const track = globalBgmPlayer.getCurrentTrack();
    expect(track).toMatchObject({ url: '/audio/a.mp3', label: 'a', index: 0, total: 2 });
  });

  test('getCurrentAudioElement returns the active audio element', async () => {
    globalBgmPlayer.setPlaylist(['/audio/track1.mp3']);
    await globalBgmPlayer.play();

    const el = globalBgmPlayer.getCurrentAudioElement();
    expect(el).not.toBeNull();
    expect(el instanceof MockAudio).toBe(true);
  });

  test('getCurrentTime accounts for segment startTime offset', async () => {
    globalBgmPlayer.setPlaylist([{ url: '/audio/track1.mp3', startTime: 60, duration: 20 }]);
    await globalBgmPlayer.play();

    const audio = globalBgmPlayer.getCurrentAudioElement();
    audio.currentTime = 65; // 5 seconds into the segment
    expect(globalBgmPlayer.getCurrentTime()).toBeCloseTo(5, 1);
  });

  test('getDuration returns segment duration when specified', async () => {
    globalBgmPlayer.setPlaylist([{ url: '/audio/track1.mp3', startTime: 0, duration: 20 }]);
    await globalBgmPlayer.play();

    expect(globalBgmPlayer.getDuration()).toBe(20);
  });

  test('advances to next track after segment duration elapses (fade mode)', async () => {
    const events = [];
    const unsub = globalBgmPlayer.subscribe(e => events.push(e));

    globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 });
    globalBgmPlayer.setPlaylist([
      { url: '/audio/track1.mp3', startTime: 0, duration: 10 },
      { url: '/audio/track2.mp3', startTime: 0, duration: 10 },
    ]);
    await globalBgmPlayer.play();

    await vi.advanceTimersByTimeAsync(10_000);

    const starts = events.filter(e => e.event === 'track-start');
    expect(starts.length).toBeGreaterThanOrEqual(2);
    expect(starts[0].url).toBe('/audio/track1.mp3');
    expect(starts[1].url).toBe('/audio/track2.mp3');
    unsub();
  });

  test('stop() resets playlist and emits stop event', async () => {
    const events = [];
    const unsub = globalBgmPlayer.subscribe(e => events.push(e));

    globalBgmPlayer.setPlaylist(['/audio/track1.mp3']);
    await globalBgmPlayer.play();
    globalBgmPlayer.stop();

    expect(globalBgmPlayer.isPlaying()).toBe(false);
    expect(globalBgmPlayer.getCurrentTrack()).toBeNull();
    expect(globalBgmPlayer.getCurrentAudioElement()).toBeNull();
    expect(events.some(e => e.event === 'stop')).toBe(true);

    await globalBgmPlayer.play(); // playlist cleared by stop — no-op
    expect(globalBgmPlayer.isPlaying()).toBe(false);
    unsub();
  });

  test('stop() prevents pending advance timer from triggering', async () => {
    const events = [];
    const unsub = globalBgmPlayer.subscribe(e => events.push(e));

    globalBgmPlayer.setTransition({ mode: 'fade', durationSeconds: 0 });
    globalBgmPlayer.setPlaylist([
      { url: '/audio/track1.mp3', startTime: 0, duration: 10 },
      { url: '/audio/track2.mp3', startTime: 0, duration: 10 },
    ]);
    await globalBgmPlayer.play();
    globalBgmPlayer.stop();

    await vi.advanceTimersByTimeAsync(15_000);

    const starts = events.filter(e => e.event === 'track-start');
    expect(starts).toHaveLength(1); // only track1 before stop
    unsub();
  });

  test('voice and BGM channels coexist — stopping BGM does not affect voice state', async () => {
    globalBgmPlayer.setPlaylist(['/audio/bgm.mp3']);
    await globalBgmPlayer.play();
    expect(globalBgmPlayer.isPlaying()).toBe(true);

    const voiceBefore = globalAudioPlayer.isPlaying('voice.mp3');
    globalBgmPlayer.stop();

    expect(globalAudioPlayer.isPlaying('voice.mp3')).toBe(voiceBefore);
    expect(globalBgmPlayer.isPlaying()).toBe(false);
  });

  test('play() is a no-op when already playing', async () => {
    globalBgmPlayer.setPlaylist(['/audio/track1.mp3']);
    await globalBgmPlayer.play();
    const idBefore = globalBgmPlayer._playId;

    await globalBgmPlayer.play();
    expect(globalBgmPlayer._playId).toBe(idBefore);
  });
});
