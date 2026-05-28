/**
 * Smoke test – AnyTalePage mounts in happy-dom without console errors.
 */
import { vi, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/preact'
import { html } from 'htm/preact'
import { ToastProvider } from '../../custom-ui/msg/toast.mjs'
import { ProgressProvider } from '../../custom-ui/msg/progress-context.mjs'
import { TooltipProvider } from '../../custom-ui/overlays/tooltip.mjs'
import { Page } from '../../custom-ui/layout/page.mjs'

// Stub network primitives before any component imports try to connect
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

const { AnyTalePage } = await import('./anytale.mjs')

test('AnyTalePage mounts without console.error', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    render(html`
      <${TooltipProvider}>
        <${Page}>
          <${ToastProvider}>
            <${ProgressProvider}>
              <${AnyTalePage} />
            </${ProgressProvider}>
          </${ToastProvider}>
        </${Page}>
      </${TooltipProvider}>
    `)
  })

  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})
