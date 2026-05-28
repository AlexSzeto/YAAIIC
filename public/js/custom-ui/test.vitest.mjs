/**
 * Baseline smoke tests for custom-ui components.
 *
 * Each test renders the component with minimal props and asserts:
 *   1. No console.error was called (Preact validates prop types and misuse here)
 *   2. No uncaught exception during render
 */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/preact'
import { html } from 'htm/preact'

afterEach(() => cleanup())

// ── Simple layout / io components ─────────────────────────────────────────

import { Button } from './io/button.mjs'

describe('Button', () => {
  test('renders text variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button}>Click me</${Button}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders icon variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button} variant="medium-icon" icon="check" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders disabled state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button} disabled=${true}>Disabled</${Button}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders loading state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Button} loading=${true}>Loading</${Button}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Input ─────────────────────────────────────────────────────────────────

import { Input } from './io/input.mjs'

describe('Input', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Input} value="" onInput=${() => {}} placeholder="Type here" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Checkbox ──────────────────────────────────────────────────────────────

import { Checkbox } from './io/checkbox.mjs'

describe('Checkbox', () => {
  test('renders unchecked without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Checkbox} checked=${false} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders checked without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Checkbox} checked=${true} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Panel ─────────────────────────────────────────────────────────────────

import { Panel } from './layout/panel.mjs'

describe('Panel', () => {
  test('renders default variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Panel}>Content</${Panel}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders elevated variant without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Panel} variant="elevated">Content</${Panel}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Icon ──────────────────────────────────────────────────────────────────

import { Icon } from './layout/icon.mjs'

describe('Icon', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Icon} name="check" size="24px" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Themed base layout helpers ────────────────────────────────────────────

import { HorizontalLayout, VerticalLayout } from './themed-base.mjs'

describe('Layout helpers', () => {
  test('HorizontalLayout renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${HorizontalLayout}><span>A</span><span>B</span></${HorizontalLayout}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('VerticalLayout renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${VerticalLayout}><span>A</span></${VerticalLayout}>`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── Slider ────────────────────────────────────────────────────────────────

import { Slider } from './io/slider.mjs'

describe('Slider', () => {
  test('renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${Slider} min=${0} max=${100} value=${50} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── ToggleSwitch ──────────────────────────────────────────────────────────

import { ToggleSwitch } from './io/toggle-switch.mjs'

describe('ToggleSwitch', () => {
  test('renders off state without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${ToggleSwitch} checked=${false} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── AudioPlayer demo usages (mirrors test.html) ───────────────────────────

import { AudioPlayer } from './media/audio-player.mjs'

describe('AudioPlayer (test.html usages)', () => {
  test('renders as overlay on album art without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <div style="position: relative; width: 300px; height: 150px;">
        <img src="/js/custom-ui/demo/sample-album-cover-1.jpg" style="width: 100%; height: 100%; object-fit: cover;" />
        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 8px;">
          <${AudioPlayer} audioUrl="/js/custom-ui/demo/sample-music-track-1.mp3" />
        </div>
      </div>
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders standalone full-width without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${AudioPlayer} audioUrl="/js/custom-ui/demo/sample-music-track-3.mp3" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders normal widthScale without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${AudioPlayer} widthScale="normal" audioUrl="/js/custom-ui/demo/sample-music-track-4.mp3" />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── MultiSelect ────────────────────────────────────────────────────────────

import { MultiSelect } from './io/multi-select.mjs'

describe('MultiSelect', () => {
  test('renders with empty selection without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`<${MultiSelect} options=${['A', 'B', 'C']} value=${[]} onChange=${() => {}} />`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with pre-selected values and label without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${MultiSelect}
        label="Keys"
        options=${['C major', 'A minor', 'G major']}
        value=${['C major', 'G major']}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('renders with optionLabels without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${MultiSelect}
        label="Time Signatures"
        options=${['2', '3', '4', '6']}
        optionLabels=${['2/4', '3/4', '4/4', '6/8']}
        value=${['4', '3']}
        onChange=${() => {}}
      />
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── BgmPlayerDemo — Panel glass + controls (mirrors test.html) ────────────

import { globalBgmPlayer } from './global-audio-player.mjs'

function makeMockBgmGainNode() {
  return { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() }
}
function makeMockBgmContext() {
  return {
    currentTime: 0, state: 'running', destination: {},
    resume: vi.fn(),
    createGain: vi.fn().mockImplementation(makeMockBgmGainNode),
    createMediaElementSource: vi.fn().mockImplementation(() => ({ connect: vi.fn() })),
  }
}
class MockBgmAudio {
  constructor() {
    this.src = ''; this.currentTime = 0; this.duration = 30;
    this.crossOrigin = null; this.preload = 'auto';
    this.play = vi.fn().mockResolvedValue(undefined);
    this.pause = vi.fn();
    this.addEventListener = vi.fn(); this.removeEventListener = vi.fn();
  }
}

describe('BgmPlayerDemo (test.html usages)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.AudioContext = function MockBgmAudioContext() { return makeMockBgmContext(); }
    window.Audio = MockBgmAudio
    globalBgmPlayer.stop()
    globalBgmPlayer._context = null
    globalBgmPlayer._slots = [{ audio: null, source: null, gain: null }, { audio: null, source: null, gain: null }]
    globalBgmPlayer._activeSlot = 0
    globalBgmPlayer._playId = 0
  })

  afterEach(() => {
    globalBgmPlayer.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('Panel glass variant with style object renders without errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(html`
      <${Panel} variant="glass" padding="small" style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <${Button} variant="medium-icon" icon="play" />
        <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
          <span>0:00</span>
          <div style="flex: 1; height: 6px; border-radius: 3px; background: #333;"><div style="height: 100%; width: 0%;"></div></div>
          <span>0:00</span>
        </div>
      </${Panel}>
    `)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

})
