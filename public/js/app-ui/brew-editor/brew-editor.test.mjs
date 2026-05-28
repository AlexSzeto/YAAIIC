/**
 * Smoke test – BrewEditor mounts in happy-dom without console errors.
 */
import { vi, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/preact'
import { html } from 'htm/preact'
import { ToastProvider } from '../../custom-ui/msg/toast.mjs'
import { TooltipProvider } from '../../custom-ui/overlays/tooltip.mjs'
import { HoverPanelProvider } from '../../custom-ui/overlays/hover-panel.mjs'
import { Page } from '../../custom-ui/layout/page.mjs'

// Prevent ambrew audio code (reverb.mjs polyfills) from crashing in happy-dom,
// which has no Web Audio API. The mock satisfies the static import without
// executing any AudioContext or AudioBuffer access.
vi.mock('../../ambrew/ambient-coffee.mjs', () => ({
  AmbientCoffee: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    dispose: vi.fn(),
    channels: [],
  })),
  Range: vi.fn(),
}))

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
    text: () => Promise.resolve(''),
  }))

  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
    onerror: null,
    onopen: null,
    readyState: 0,
  })))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

afterEach(() => cleanup())

const { BrewEditor } = await import('./brew-editor.mjs')

test('BrewEditor mounts without console.error', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    render(html`
      <${HoverPanelProvider}>
        <${TooltipProvider}>
          <${Page}>
            <${ToastProvider}>
              <${BrewEditor} />
            </${ToastProvider}>
          </${Page}>
        </${TooltipProvider}>
      </${HoverPanelProvider}>
    `)
  })

  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})
