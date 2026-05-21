/**
 * Smoke test – Gallery mounts in happy-dom without console errors.
 */
import { vi, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/preact'
import { html } from 'htm/preact'

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
    text: () => Promise.resolve(''),
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

afterEach(() => cleanup())

const { Gallery } = await import('./gallery.mjs')

test('Gallery with isOpen=false renders null without console.error', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    render(html`
      <${Gallery}
        isOpen=${false}
        queryPath="/media-data"
        previewFactory=${vi.fn(() => null)}
        onClose=${vi.fn()}
      />
    `)
  })

  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})

test('Gallery with isOpen=true mounts without console.error', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    render(html`
      <${Gallery}
        isOpen=${true}
        queryPath="/media-data"
        previewFactory=${vi.fn((item) => {
          const div = document.createElement('div')
          div.textContent = item?.name || 'item'
          return div
        })}
        onClose=${vi.fn()}
      />
    `)
  })

  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})
