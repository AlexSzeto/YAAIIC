# AnyTale Play Mode — Rollout 2: Play UI Components & Session

> Parent spec: [`anytale-play-mode.md`](./anytale-play-mode.md)

## Goal

Build all play-mode-specific UI components and the session persistence module so the play page renders its full visual shell with mock/static data. After this rollout, the play page should display the portrait panel scaffold, all styled control buttons, speech/caption bubbles, decision option buttons, progress bar, and loading spinner — all with the play mode's unique visual style.

## Tasks

- [ ] **Circular glass control buttons:** Create a play-mode circular button component (48×48px, theme background with glass panel's frosted `backdrop-filter: blur(4px)`, thick outline, single centered icon). Used for: reset, mute, music, prev, play, stop, next, show/hide UI. **Manual test:** render all button variants on the play page, verify circular shape, frosted glass effect, and icon centering.

- [ ] **Speech bubble component:** Build a speech bubble following the CSS pattern from the spec (rounded rect with triangle pointer at bottom-center, theme colors). Used for displaying character dialog text during chapter navigation. **Manual test:** render with sample text, verify triangle appears below, responsive text wrapping.

- [ ] **Caption bubble component:** Same styling as speech bubble but without the `:after` triangle — a plain rounded rectangle. Used for decision hints at decision points. **Manual test:** render alongside speech bubble, confirm identical sizing but no triangle.

- [ ] **Decision option buttons:** Glass panel style background, rounded rectangle. When image is present: image on left, word-wrapped multiline text on right. When no image: text centered. Support 3 or 4 options layout. **Manual test:** render options with and without images, verify layout adapts correctly, text wraps on long content.

- [ ] **Progress bar component:** True pill shape (fully rounded ends), solid color fills. Three overlapping layers: loading (red/danger, full width), loaded (gray/elevated, partial), current (blue/primary, position indicator). Accept mock percentage props initially. **Manual test:** render with various percentages, verify layer stacking and pill shape.

- [ ] **Portrait panel UI scaffold:** Assemble the full play page layout — outlined portrait frame with: top controls region (reset, mute, music buttons), speech/caption bubble region, generated image area (placeholder for now), bottom controls (left: progress bar + `Chapter X Page Y` labels, right: prev/play/next/show-hide buttons). **Manual test:** resize to narrow mobile viewport; all controls remain tappable; layout doesn't overflow.

- [ ] **Loading spinner state:** Implement the loading state view — top/bottom controls visible, giant centered loading spinner in the portrait area. Used for cold start loading and chapter transition loading pages. **Manual test:** toggle between loading and content states, verify spinner is prominent and centered.

- [ ] **Show/hide UI toggle:** When UI is hidden, only the show UI button remains visible. Everything else (top controls, speech bubble, bottom bar) is hidden. **Manual test:** tap hide, confirm only show button visible; tap show, confirm full UI returns.

- [ ] **Play session module:** Define a single `localStorage` key (distinct from editor keys `anytale-state`, `anytale-plot`, `anytale-character`, `anytale-outfit`) and `{ load, save, patch }` helpers. Session object stores: character uid + snapshot, outfit uid, background part uid + attribute map, music genre + track id, linear plot timeline, generated asset cache, current plot uid, current page index, UI phase (intro/mood/character-picker/plot/end-of-chapter/end-screen), toggles (mute, music on), navigation mode (manual/autoplay). On load, merge missing keys using random/default repair. **Manual test:** set mock values in DevTools, refresh play page, verify state persists; delete key, verify defaults are generated.

## Implementation Details

### File locations

| Component | Suggested path |
|---|---|
| Glass control button | `public/js/app-ui/anytale/play/glass-button.mjs` |
| Speech bubble | `public/js/app-ui/anytale/play/speech-bubble.mjs` |
| Caption bubble | `public/js/app-ui/anytale/play/caption-bubble.mjs` |
| Decision options | `public/js/app-ui/anytale/play/decision-options.mjs` |
| Progress bar | `public/js/app-ui/anytale/play/play-progress-bar.mjs` |
| Portrait panel scaffold | `public/js/app-ui/anytale/play/portrait-panel.mjs` |
| Loading spinner state | `public/js/app-ui/anytale/play/loading-state.mjs` |
| Play session module | `public/js/app-ui/anytale/play/play-session.mjs` |

All components live under `public/js/app-ui/anytale/play/` since they are play-mode-specific and unlikely to be reused outside this feature (per the client rule: app-specific goes in `app-ui/`).

### Circular glass control buttons

The glass button is a page-local component (not an extension of `Button` from `custom-ui/io/button.mjs`), matching the spec's guidance that play mode controls are custom page-local components sharing the glass effect.

Key styling properties, derived from the glass variant in [`panel.mjs`](../../public/js/custom-ui/layout/panel.mjs):

```js
const GlassButton = styled('button')`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  /* Glass effect — same as Panel variant="glass" */
  background-color: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);

  /* Thick outline */
  border: 3px ${() => currentTheme.value.border.style}
          ${() => currentTheme.value.colors.border.secondary};

  color: ${() => currentTheme.value.colors.text.primary};
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${() => currentTheme.value.colors.background.hover};
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;
GlassButton.className = 'glass-button';
```

Use `Icon` from `custom-ui/layout/icon.mjs` for the centered icon. Expected icon names: `refresh` (reset), `volume-full` / `volume-mute` (mute), `music` (music), `skip-back` (prev), `play` (play), `stop` (stop), `skip-forward` (next), `show` / `hide` (show/hide UI).

### Speech bubble

Adapted from the spec's CSS pattern to use theme tokens:

```js
const SpeechBubbleContainer = styled('div')`
  position: relative;
  background: ${() => currentTheme.value.colors.background.card};
  border-radius: 0.4em;
  padding: ${() => currentTheme.value.spacing.medium.padding};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  border: ${() => currentTheme.value.border.width}
          ${() => currentTheme.value.border.style}
          ${() => currentTheme.value.colors.border.secondary};

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 0;
    border: 24px solid transparent;
    border-top-color: ${() => currentTheme.value.colors.background.card};
    border-bottom: 0;
    border-left: 0;
    margin-left: -12px;
    margin-bottom: -24px;
  }
`;
SpeechBubbleContainer.className = 'speech-bubble';
```

### Caption bubble

Identical to `SpeechBubbleContainer` but without the `::after` pseudo-element. Factor out a shared styled base or just omit the pseudo-element block. The component accepts the same `text` prop and renders identically otherwise.

### Decision option buttons

Each option is a glass-styled rounded rectangle. Layout switches based on whether an `image` prop is provided:

```
┌──────────────────────────────┐
│ ┌──────┐                     │   ← with image
│ │ IMG  │  Multi-line text    │
│ │      │  wraps here         │
│ └──────┘                     │
└──────────────────────────────┘

┌──────────────────────────────┐
│       Centered text          │   ← without image
└──────────────────────────────┘
```

Props: `{ text, image?, onClick }`. The parent container renders 3 or 4 of these in a vertical stack with gap spacing.

### Progress bar

Three absolutely-positioned layers inside a relative container, all with `border-radius: 9999px` for the pill shape:

```
Layer stack (bottom to top):
┌─────────────────────────────────────────┐  ← loading (danger, 100% width)
│ ┌──────────────────────────┐            │  ← loaded  (elevated bg, % width)
│ │ ┌──────────┐             │            │  ← current (primary, % width)
│ │ └──────────┘             │            │
│ └──────────────────────────┘            │
└─────────────────────────────────────────┘
```

Props: `{ loadedPercent, currentPercent }`. The loading layer is always 100% width. All three layers have `height: 100%` and `position: absolute; top: 0; left: 0`. Colors:

| Layer | Theme token |
|---|---|
| Loading | `theme.colors.danger.background` |
| Loaded | `theme.colors.background.elevated` |
| Current | `theme.colors.primary.background` |

### Portrait panel scaffold layout

```
┌─ Outlined Portrait Frame ──────────────────────┐
│  [reset] [mute] [music]          ← top controls │
│                                                  │
│  ┌─ Speech / Caption bubble ──────────────────┐ │
│  │ "Dialog text here..."                       │ │
│  └─────────────────────────────────────────────┘ │
│                    ▽ (triangle, speech only)      │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │         Generated image area               │  │
│  │         (placeholder / spinner)            │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌─ Bottom controls ─────────────────────────┐  │
│  │ [====progress====]    [prev][▶][next][👁]  │  │
│  │ Chapter 1  Page 3                          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

The outer frame uses `Panel variant="outlined"`. Inner regions are flex-column. Bottom controls use a two-row layout: row 1 is `flex` with progress bar (left, `flex: 1`) and navigation buttons (right); row 2 has the chapter/page labels aligned left.

### Loading spinner state

When `isLoading` is true, the portrait image area is replaced with a centered `Icon` spinner:

```js
html`<${Icon} name="loader-alt" animation="spin" size="96px"
      color=${theme.colors.spinner.color} />`
```

Top and bottom controls remain visible and functional during loading.

### Show/hide UI toggle

Controlled by a boolean state `uiVisible` (default `true`). When hidden:
- Top controls container: `display: none`
- Speech/caption bubble: `display: none`
- Bottom controls bar: `display: none`
- The show/hide button itself: re-positioned to a fixed corner of the portrait frame (e.g. bottom-right), always visible

Toggle between `show` and `hide` icon names on the glass button.

### Play session module

**localStorage key:** `anytale-play-session` (must never collide with editor keys: `anytale-state`, `anytale-plot`, `anytale-character`, `anytale-outfit`).

Session object shape:

```js
/**
 * @typedef {Object} PlaySession
 * @property {string} characterUid
 * @property {Object} characterSnapshot - { name, personality, portraitUrl, parts }
 * @property {string} outfitUid
 * @property {string} backgroundPartUid
 * @property {Object} backgroundAttributes - { [attrName]: selectedValue }
 * @property {string} musicGenre
 * @property {string} musicTrackId
 * @property {Array<TimelineEntry>} timeline - ordered plot entries
 * @property {Object} assetCache - { [signatureKey]: AssetCacheEntry }
 * @property {string} currentPlotUid
 * @property {number} currentPageIndex
 * @property {string} uiPhase - 'intro'|'mood'|'character-picker'|'plot'|'end-of-chapter'|'end-screen'
 * @property {boolean} muted
 * @property {boolean} musicOn
 * @property {string} navigationMode - 'manual'|'autoplay'
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {string} plotUid
 * @property {string} startedAt - ISO timestamp
 * @property {number} pageCount
 * @property {boolean} progressionDisabledPartsApplied
 */

/**
 * @typedef {Object} AssetCacheEntry
 * @property {string|null} imageUrl
 * @property {string|null} imageTaskId
 * @property {string} imageStatus - 'pending'|'generating'|'ready'|'error'
 * @property {string|null} dialogText
 * @property {string} dialogStatus
 * @property {string|null} voiceUrl
 * @property {string} voiceStatus
 * @property {string|null} error
 * @property {string} generatedAt - ISO timestamp
 */
```

Default values for missing-key repair:

```js
const DEFAULT_SESSION = {
  characterUid: '',
  characterSnapshot: { name: '', personality: '', portraitUrl: '', parts: [] },
  outfitUid: '',
  backgroundPartUid: '',
  backgroundAttributes: {},
  musicGenre: '',
  musicTrackId: '',
  timeline: [],
  assetCache: {},
  currentPlotUid: '',
  currentPageIndex: 0,
  uiPhase: 'intro',
  muted: false,
  musicOn: true,
  navigationMode: 'manual',
};
```

Exported helpers:

```js
/** Load session from localStorage; merge missing keys with defaults. */
export function load() { ... }

/** Full save — replaces entire session object. */
export function save(session) { ... }

/** Shallow-merge partial updates into the stored session. */
export function patch(updates) { ... }
```

The `load()` function reads from localStorage, parses JSON, and for each key in `DEFAULT_SESSION`, uses the stored value if present and valid, otherwise falls back to the default. This is the "merge missing keys using random/default repair" strategy — in this rollout, defaults are static; random bootstrap values will be assigned by the cold-start flow in a later rollout.

### Stable ID pattern for DOM access

Per project rules, never attach a `ref` to a `styled()` component. When DOM access is needed (e.g. measuring the portrait panel for responsive layout), use the stable-id pattern:

```js
const idRef = useRef('portrait-panel-' + Math.random().toString(36).slice(2));
// ...
html`<${StyledPanel} id=${idRef.current} />`;
// ...
const el = document.getElementById(idRef.current);
if (el) el.getBoundingClientRect();
```
