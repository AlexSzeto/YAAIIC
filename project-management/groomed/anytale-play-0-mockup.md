# AnyTale Play Mode — Rollout 0: Visual Mockup

> Parent spec: [`anytale-play-mode.md`](./anytale-play-mode.md)

## Goal

Build all play-mode UI components and assemble two static mockup screens — a character change decision page and a plot navigation page with dialog — using placeholder imagery and hardcoded data. No business logic, data fetching, or session management. The output is a browser-viewable reference at `/anytale-play-mockup.html` that validates the visual design before any implementation begins.

## Tasks

### Phase 1 — UI Components

- [ ] **Circular glass control buttons:** Create a play-mode circular button component (48×48px, theme background with glass panel's frosted `backdrop-filter: blur(4px)`, thick outline, single centered icon). Used for: reset, mute, music, prev, play, stop, next, show/hide UI. **Manual test:** render all button variants on the mockup page, verify circular shape, frosted glass effect, and icon centering.

- [ ] **Speech bubble component:** Build a speech bubble following the CSS pattern from the spec (rounded rect with triangle pointer at bottom-center, theme colors). Used for displaying character dialog text during chapter navigation. **Manual test:** render with sample text, verify triangle appears below, responsive text wrapping.

- [ ] **Caption bubble component:** Same styling as speech bubble but without the `:after` triangle — a plain rounded rectangle. Used for decision hints at decision points. **Manual test:** render alongside speech bubble, confirm identical sizing but no triangle.

- [ ] **Decision option buttons:** Glass panel style background, rounded rectangle. When image is present: image on left, word-wrapped multiline text on right. When no image: text centered. Support 3 or 4 options layout. **Manual test:** render options with and without images, verify layout adapts correctly, text wraps on long content.

- [ ] **Progress bar component:** True pill shape (fully rounded ends), solid color fills. Three overlapping layers: loading (red/danger, full width), loaded (gray/elevated, partial), current (blue/primary, position indicator). Accept percentage props. **Manual test:** render with various percentages, verify layer stacking and pill shape.

- [ ] **Portrait panel UI scaffold:** Assemble the full play page layout — outlined portrait frame with: top controls region (reset, mute, music buttons), speech/caption bubble region, generated image area (placeholder for now), bottom controls (left: progress bar + `Chapter X  Page Y` labels; right: prev/play/next/show-hide buttons). **Manual test:** resize to narrow mobile viewport; all controls remain tappable; layout doesn't overflow.

- [ ] **Loading spinner state:** Implement the loading state view — top/bottom controls visible, giant centered loading spinner in the portrait area. **Manual test:** toggle between loading and content states, verify spinner is prominent and centered.

- [ ] **Show/hide UI toggle:** When UI is hidden, only the show UI button remains visible. Everything else (top controls, speech/caption bubble, bottom bar) is hidden. **Manual test:** tap hide, confirm only show button visible; tap show, confirm full UI returns.

### Phase 2 — Mockup Screens

- [ ] **Character change mockup screen:** Add `public/anytale-play-mockup.html` + `public/js/anytale-play-mockup.mjs` mounting a `MockupPage` component under `Page` / `ToastProvider` / `TooltipProvider`. The page renders a screen-switcher toggle at the top, then below it the portrait panel in **decision-point layout**: background render image behind the panel, top controls (reset, mute, music), caption bubble with hint text, three character decision option buttons (each showing a portrait image on the left and name + personality snippet on the right), a fourth "Maybe someone else?" option with no image and centered text, and a single back button at the bottom. All data is hardcoded from the placeholder const. **Manual test:** open `/anytale-play-mockup.html`, verify the character change screen matches the spec layout at both desktop and narrow mobile widths.

  **Placeholder images (fill in before implementing):**
  - `backgroundRender`: `http://localhost:3000/media/image_4242.png`
  - `character1Portrait` (name: `Emma`, personality: `A lady with a silky voice, a seductive attitude, who is not afraid to flaunt her feminine wiles`): `http://localhost:3000/media/image_3930.png`
  - `character2Portrait` (name: `Isabella`, personality: `A loud, unapologetically rambunctious Latina woman.`): `http://localhost:3000/media/image_3644.png`
  - `character3Portrait` (name: `Jenny`, personality: `A young Asian woman who sounds honeyed sweet at first, but often throws intense jealousy fits.`): `http://localhost:3000/media/image_3637.png`

- [ ] **Plot page with dialog mockup screen:** Add a second screen to `MockupPage` (switchable via the screen-switcher toggle). Renders the portrait panel in **normal page layout**: background render image, top controls (reset, mute, music), speech bubble with dialog text below the top controls, bottom controls (progress bar at ~60% loaded / ~30% current + `Chapter 1  Page 2` labels, and prev/play/next/show-hide buttons). Show/hide toggle must work on this screen too. **Manual test:** switch to the plot page screen, verify speech bubble appears with dialog text, progress bar layers are correct, and show/hide hides all non-essential UI.

  **Placeholder images (fill in before implementing):**
  - `backgroundRender`: `http://localhost:3000/media/image_4242.png`
  - `dialogText`: `Do allow me to introduce myself properly. You’re here, and frankly, you deserve the view.`

## Implementation Details

### File locations

| Component | Path |
|---|---|
| Glass control button | `public/js/app-ui/anytale/play/glass-button.mjs` |
| Speech bubble | `public/js/app-ui/anytale/play/speech-bubble.mjs` |
| Caption bubble | `public/js/app-ui/anytale/play/caption-bubble.mjs` |
| Decision options | `public/js/app-ui/anytale/play/decision-options.mjs` |
| Progress bar | `public/js/app-ui/anytale/play/play-progress-bar.mjs` |
| Portrait panel scaffold | `public/js/app-ui/anytale/play/portrait-panel.mjs` |
| Loading spinner state | `public/js/app-ui/anytale/play/loading-state.mjs` |
| Mockup entry point | `public/js/anytale-play-mockup.mjs` |

All components live under `public/js/app-ui/anytale/play/` — play-mode-specific and not reused elsewhere (per the client rule: app-specific goes in `app-ui/`).

### Circular glass control buttons

Key styling properties, derived from the glass variant in `panel.mjs`:

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
  background-color: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 3px ${() => currentTheme.value.border.style}
          ${() => currentTheme.value.colors.border.secondary};
  color: ${() => currentTheme.value.colors.text.primary};
  transition: background-color 0.2s ease, border-color 0.2s ease;
  &:hover:not(:disabled) {
    background-color: ${() => currentTheme.value.colors.background.hover};
  }
  &:disabled { opacity: 0.6; cursor: default; }
`;
GlassButton.className = 'glass-button';
```

Use `Icon` from `custom-ui/layout/icon.mjs`. Expected icon names: `refresh` (reset), `volume-full` / `volume-mute` (mute), `music` (music), `skip-back` (prev), `play` (play), `stop` (stop), `skip-forward` (next), `show` / `hide` (show/hide UI).

### Speech bubble

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
    bottom: 0; left: 50%;
    width: 0; height: 0;
    border: 24px solid transparent;
    border-top-color: ${() => currentTheme.value.colors.background.card};
    border-bottom: 0; border-left: 0;
    margin-left: -12px; margin-bottom: -24px;
  }
`;
SpeechBubbleContainer.className = 'speech-bubble';
```

### Caption bubble

Identical to `SpeechBubbleContainer` but without the `::after` block. Factor out a shared styled base or simply omit the pseudo-element.

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

Props: `{ text, image?, onClick }`. Parent container renders 3 or 4 in a vertical stack with gap spacing.

### Progress bar

Three absolutely-positioned layers inside a relative container, all `border-radius: 9999px`:

| Layer | Token | Width |
|---|---|---|
| Loading | `theme.colors.danger.background` | 100% |
| Loaded | `theme.colors.background.elevated` | `loadedPercent`% |
| Current | `theme.colors.primary.background` | `currentPercent`% |

Props: `{ loadedPercent, currentPercent }`.

### Portrait panel scaffold layout

```
┌─ Outlined Portrait Frame ──────────────────────┐
│  [reset] [mute] [music]          ← top controls │
│  ┌─ Speech / Caption bubble ──────────────────┐ │
│  │ "Dialog / hint text here..."               │ │
│  └─────────────────────────────────────────────┘ │
│                    ▽ (triangle, speech only)      │
│  ┌────────────────────────────────────────────┐  │
│  │         Generated image / spinner          │  │
│  └────────────────────────────────────────────┘  │
│  ┌─ Bottom controls ─────────────────────────┐  │
│  │ [====progress====]    [prev][▶][next][👁]  │  │
│  │ Chapter 1  Page 2                          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

Outer frame uses `Panel variant="outlined"`. Bottom controls: row 1 is `flex` with progress bar (`flex: 1`) and navigation buttons; row 2 has chapter/page labels aligned left.

### Show/hide UI toggle

Controlled by boolean state `uiVisible` (default `true`). When hidden:
- Top controls: `display: none`
- Speech/caption bubble: `display: none`
- Bottom controls bar: `display: none`
- Show/hide button: re-positioned to a fixed corner of the portrait frame, always visible

### Mockup screen-switcher

A simple `ToggleSwitch` or pair of buttons at the top of `MockupPage` that sets a `screen` state value (`'character-change'` or `'plot-page'`). Below it, render the selected screen using the portrait panel scaffold with the appropriate layout and hardcoded data.

### Placeholder data shape

Define at the top of `anytale-play-mockup.mjs`:

```js
const SCREENS = {
  characterChange: {
    backgroundRender: '<FILL_IN>',
    captionText: 'Who would you like to meet?',
    characters: [
      { name: '<FILL_IN>', personality: '<FILL_IN>', portraitUrl: '<FILL_IN>' },
      { name: '<FILL_IN>', personality: '<FILL_IN>', portraitUrl: '<FILL_IN>' },
      { name: '<FILL_IN>', personality: '<FILL_IN>', portraitUrl: '<FILL_IN>' },
    ],
  },
  plotPage: {
    backgroundRender: '<FILL_IN>',
    dialogText: '<FILL_IN>',
    chapter: 1,
    page: 2,
    loadedPercent: 60,
    currentPercent: 30,
  },
};
```

### Stable ID pattern for DOM access

Per project rules, never attach a `ref` to a `styled()` component. When DOM access is needed, use the stable-id pattern:

```js
const idRef = useRef('portrait-panel-' + Math.random().toString(36).slice(2));
// ...
html`<${StyledPanel} id=${idRef.current} />`;
const el = document.getElementById(idRef.current);
if (el) el.getBoundingClientRect();
```
