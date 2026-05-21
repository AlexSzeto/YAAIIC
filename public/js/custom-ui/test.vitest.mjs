/**
 * Baseline smoke tests for custom-ui components.
 *
 * Each test renders the component with minimal props and asserts:
 *   1. No console.error was called (Preact validates prop types and misuse here)
 *   2. No uncaught exception during render
 */
import { vi, describe, test, expect, afterEach } from 'vitest'
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
