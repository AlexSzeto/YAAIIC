# Custom UI Component Library

The `public/js/custom-ui/` directory contains a reusable, themeable UI component library built with **Preact**, **htm**, and **goober** (CSS-in-JS). These components form a portable design system that can be shared across projects via [lib-sync](lib-sync.md).

## Table of Contents

- [Architecture](#architecture)
- [Theme System](#theme-system)
- [IO Components](#io-components)
- [Layout Components](#layout-components)
- [Navigation Components](#navigation-components)
- [Overlay Components](#overlay-components)
- [Message & Feedback Components](#message--feedback-components)
- [Media Components](#media-components)
- [Themed Base Elements](#themed-base-elements)
- [Utilities](#utilities)
- [Component Showcase](#component-showcase)

## Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Virtual DOM | Preact | Lightweight React alternative (3KB) |
| Templating | htm/preact | Tagged template literals for JSX-free markup |
| CSS-in-JS | goober | 1KB styled-components alternative |
| Theming | Custom signals | Global theme state with cookie persistence |

### Import Pattern

All components use ES module imports with bare specifiers resolved via an importmap:

```javascript
import { html } from '/lib/htm/preact.js';
import { useState, useEffect } from '/lib/preact/hooks.js';
import { styled } from '/js/custom-ui/goober-setup.mjs';
import { currentTheme } from '/js/custom-ui/theme.mjs';
```

### Component Conventions

- **Functional components** are preferred for most UI elements (hooks: `useState`, `useEffect`, `useCallback`).
- **Class components** (using `Component` from Preact) are used for complex stateful logic or when lifecycle methods offer cleaner abstraction.
- Props are destructured with defaults in the function signature.
- DOM-compatible props are forwarded via `...rest`.
- Public props are documented with JSDoc.

### Styling Conventions

- Import `styled` from `goober-setup.mjs`, **never** directly from `goober`.
- Use PascalCase for styled components (e.g., `StyledButton`).
- Attach a readable class name for debugging: `StyledButton.className = 'styled-button';`.
- **Never hardcode** colors, spacing, borders, or typography — use theme tokens.
- Keep styles local to the component file.

### Ref Restrictions

Attaching a `ref` to a `styled()` component yields the Preact component instance, not the DOM node. To access the DOM:

- Prefer event-driven alternatives (e.g., `e.currentTarget.getBoundingClientRect()`).
- When a raw DOM ref is necessary, attach it to a plain HTML element (`<div>`, `<canvas>`, `<input>`) rather than a styled wrapper.

---

## Theme System

**File**: `theme.mjs`

The theme system provides a centralized, reactive theme state with light and dark modes. Theme preference is persisted in cookies.

### API

```javascript
import { currentTheme } from '/js/custom-ui/theme.mjs';

// Subscribe to theme changes
currentTheme.subscribe(theme => {
  // theme.colors, theme.spacing, theme.typography, etc.
});

// Toggle theme
currentTheme.value = currentTheme.value.name === 'dark' ? lightTheme : darkTheme;
```

### Theme Token Categories

| Category | Example Tokens | Usage |
|----------|---------------|-------|
| **Colors** | `theme.colors.primary.background`, `theme.colors.text.secondary`, `theme.colors.danger` | All color values |
| **Spacing** | `theme.spacing.small.padding`, `theme.spacing.medium.padding`, `theme.spacing.large.padding` | Margins, paddings, gaps |
| **Borders** | `theme.border.radius`, `theme.border.width`, `theme.border.color` | Border styling |
| **Typography** | `theme.typography.fontSize`, `theme.typography.fontFamily` | Text styling |
| **Shadows** | `theme.shadows.small`, `theme.shadows.medium` | Box shadows |

### Adding New Tokens

If a needed token is missing, add it to `theme.mjs` rather than hardcoding values. This ensures consistency across all components and both theme modes.

---

## IO Components

**Directory**: `io/`

Form inputs and interactive controls with full theme integration.

### Button (`io/button.mjs`)

Themed button with multiple variants and color schemes. **Class component**.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | string | `'medium-text'` | `'medium-text'`, `'medium-icon'`, `'large-icon'`, `'small-text'`, `'small-icon'` |
| `color` | string | `'primary'` | `'primary'`, `'secondary'`, `'success'`, `'danger'`, `'transparent'` |
| `icon` | string | — | Material Symbol icon name |
| `loading` | boolean | `false` | Show loading spinner |
| `disabled` | boolean | `false` | Disable interaction |
| `onClick` | function | — | Click handler |

```javascript
html`<${Button} color="danger" icon="delete" onClick=${handleDelete}>Delete<//>`
```

### Input (`io/input.mjs`)

Text/number/email/password input with prefix/suffix icon support and error state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | string | `'text'` | HTML input type |
| `value` | string | — | Controlled value |
| `placeholder` | string | — | Placeholder text |
| `onChange` | function | — | Change handler |
| `error` | string | — | Error message to display |
| `prefix` | string | — | Prefix icon name |
| `suffix` | string | — | Suffix icon name |

### Textarea (`io/textarea.mjs`)

Multi-line text input with auto-adjusting height.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | string | — | Controlled value |
| `placeholder` | string | — | Placeholder text |
| `onChange` | function | — | Change handler |

### Checkbox (`io/checkbox.mjs`)

Styled checkbox with label support.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | boolean | `false` | Checked state |
| `onChange` | function | — | Change handler |
| `label` | string | — | Label text |

### Toggle Switch (`io/toggle-switch.mjs`)

On/off toggle control.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | boolean | `false` | Toggle state |
| `onChange` | function | — | Change handler |

### Slider (`io/slider.mjs`)

Linear slider with label and value display.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `min` | number | `0` | Minimum value |
| `max` | number | `100` | Maximum value |
| `value` | number | — | Current value |
| `onChange` | function | — | Change handler |
| `label` | string | — | Display label |

### Range Slider (`io/range-slider.mjs`)

Dual-handle range selector for selecting a value range.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `min` | number | — | Minimum bound |
| `max` | number | — | Maximum bound |
| `start` | number | — | Left handle value |
| `end` | number | — | Right handle value |
| `onChange` | function | — | `({ start, end }) => void` |

### Discrete Slider (`io/discrete-slider.mjs`)

Stepped slider for selecting from fixed values.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | — | Current step |
| `steps` | number | — | Number of discrete steps |
| `onChange` | function | — | Change handler |

### Select (`io/select.mjs`)

Dropdown select with searchable options.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | array | — | `[{ label, value }]` |
| `value` | any | — | Selected value |
| `onChange` | function | — | Change handler |
| `placeholder` | string | — | Placeholder when empty |

---

## Layout Components

**Directory**: `layout/`

### Page (`layout/page.mjs`)

Root application container that initializes the theme system, applies global styles, and supports dark/light mode switching. Every page must use this component as its outermost wrapper.

```javascript
html`<${Page}><${App} /><//>`
```

### Panel (`layout/panel.mjs`)

Themed container with multiple visual variants. **Class component**.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | string | `'default'` | `'default'`, `'elevated'`, `'outlined'`, `'glass'` |
| `padding` | string | — | Override default padding |

### Icon (`layout/icon.mjs`)

Renders Material Symbol icons or custom SVGs.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | string | — | Material Symbol icon name |
| `size` | string | — | Icon size override |

### Dynamic List (`layout/dynamic-list.mjs`)

Renders a list of items with add/remove controls, suitable for dynamic form arrays (e.g., tag lists, channel lists).

---

## Navigation Components

**Directory**: `nav/`

### Navigation Menu (`nav/navigation-menu.mjs`)

Dropdown menu for app-wide navigation (Home, Workflow Editor, Brew Editor, Theme Toggle). **Class component**.

### Navigator (`nav/navigator.mjs`)

Pagination control with Previous/Next/First/Last buttons and page indicator.

### Button Group (`nav/button-group.mjs`)

Grouped buttons for mutually exclusive choices (radio-style).

### Tab Panels (`nav/tab-panels.mjs`)

Tabbed container that shows one panel at a time with tab navigation.

### Hooks

- **`use-item-navigation.mjs`**: Hook for keyboard and mouse-based item navigation in lists.
- **`use-pagination.mjs`**: Hook for managing pagination state (current page, total pages, page size).

---

## Overlay Components

**Directory**: `overlays/`

### Modal (`overlays/modal.mjs`)

Declarative modal dialog rendered via Portal to `document.body`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | — | Modal title |
| `size` | string | `'medium'` | `'small'`, `'medium'`, `'large'`, `'full'` |
| `onClose` | function | — | Close handler |
| `footer` | VNode | — | Footer content |

### Floating Panel (`overlays/floating-panel.mjs`)

Moveable, resizable panel that stays on top of other content. Useful for persistent tool panels.

### Hover Panel (`overlays/hover-panel.mjs`)

Tooltip-style panel triggered by hover events. Requires `HoverPanelProvider` context.

```javascript
html`
  <${HoverPanelProvider}>
    <${MyComponent} />
  <//>
`
```

### List Select (`overlays/list-select.mjs`)

Popup list overlay for selecting from many options. Useful for file pickers and tag selectors.

### Dialog (`overlays/dialog.mjs`)

Low-level imperative dialog API (`show()` / `dismiss()`).

---

## Message & Feedback Components

**Directory**: `msg/`

### Toast (`msg/toast.mjs`)

Toast notification system using Preact Context. Provides the `useToast()` hook.

```javascript
import { ToastProvider, useToast } from '/js/custom-ui/msg/toast.mjs';

// Wrap app in provider
html`<${ToastProvider}><${App} /><//>`

// Use in any child component
const toast = useToast();
toast.show('Operation completed', 'success');
```

### Progress Banner (`msg/progress-banner.mjs`)

Top-of-page progress bar for long-running tasks. **Class component**. Listens to progress updates via context.

### Progress Context (`msg/progress-context.mjs`)

Context provider that manages progress state, used by `ProgressBanner` and task-tracking logic.

---

## Media Components

**Directory**: `media/`

### Audio Player (`media/audio-player.mjs`)

HTML5 audio player with themed controls (play/pause, volume, progress scrubbing).

### Audio Select (`media/audio-select.mjs`)

Dropdown selector for picking audio files from local media or uploads.

### Image Select (`media/image-select.mjs`)

Dropdown selector for picking images from gallery history or uploads.

---

## Themed Base Elements

**File**: `themed-base.mjs`

Pre-styled HTML elements that automatically pick up theme tokens. Use these instead of raw HTML elements for consistent styling.

| Export | HTML Element | Purpose |
|--------|-------------|---------|
| `H1` – `H6` | `<h1>` – `<h6>` | Themed headings |
| `HorizontalLayout` | `<div>` | Flex row container |
| `VerticalLayout` | `<div>` | Flex column container |

```javascript
import { H1, HorizontalLayout } from '/js/custom-ui/themed-base.mjs';

html`
  <${H1}>My Title<//>
  <${HorizontalLayout} gap="8px">
    <${Button}>Left<//>
    <${Button}>Right<//>
  <//>
`
```

---

## Utilities

**File**: `util.mjs`

Generic utility functions shared across components.

| Function | Description |
|----------|-------------|
| `fetchJson(url, options)` | Fetch wrapper that parses JSON response with error handling |
| `extractNameFromFilename(filename)` | Strips extension and cleans up a filename into a display name |

**File**: `goober-setup.mjs`

Pre-configured goober CSS-in-JS setup that binds to Preact's `h` function. Exports `styled` and `glob`.

```javascript
import { styled } from '/js/custom-ui/goober-setup.mjs';

const StyledDiv = styled('div')`
  background: ${props => props.theme.colors.primary.background};
  padding: ${props => props.theme.spacing.medium.padding};
`;
StyledDiv.className = 'styled-div';
```

---

## Component Showcase

**File**: `test.html`

A live demonstration page that renders every custom-ui component with interactive examples. Open this file in a browser to preview:

- All button variants and color combinations
- Form inputs (text, number, textarea, select, checkbox, toggle, sliders)
- Layout containers (Panel variants, HorizontalLayout, VerticalLayout)
- Navigation (tabs, pagination, button groups)
- Overlays (modals, floating panels, hover panels)
- Toast notifications
- Theme switching (light/dark)

This file serves as both documentation and a visual regression test. Every new custom-ui component must include a usage example in `test.html`.
