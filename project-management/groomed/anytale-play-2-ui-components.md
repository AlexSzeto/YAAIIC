# AnyTale Play Mode — Rollout 2: Session Module

> Parent spec: [`anytale-play-mode.md`](./anytale-play-mode.md)

## Goal

Implement the play mode session persistence module. UI components are already built in Rollout 0. After this rollout, the play page has a fully operational session layer: state survives page reloads, missing fields are healed with defaults, and the typed session shape is the contract all subsequent rollouts write against.

## Tasks

- [ ] **Play session module:** Define a single `localStorage` key (distinct from editor keys `anytale-state`, `anytale-plot`, `anytale-character`, `anytale-outfit`) and `{ load, save, patch }` helpers. Session object stores: character uid + snapshot, outfit uid, location part uid + attribute map, music genre, slot state, linear plot timeline, generated asset cache, current plot uid, current page index, UI phase (intro/mood/character-picker/plot/end-of-chapter/end-screen), toggles (mute, music on), navigation mode (manual/autoplay). On load, merge missing keys using random/default repair. **Manual test:** set mock values in DevTools, refresh play page, verify state persists; delete key, verify defaults are generated.

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

### Reference

UI components (glass buttons, speech/caption bubbles, decision options, progress bar, portrait panel scaffold, loading spinner, show/hide toggle) are built in [Rollout 0](anytale-play-0-mockup.md). This rollout adds only the session persistence layer.

### Play session module

**localStorage key:** `anytale-play-session` (must never collide with editor keys: `anytale-state`, `anytale-plot`, `anytale-character`, `anytale-outfit`). Play mode intentionally uses `localStorage` (not `sessionStorage`) so the session survives tab close and browser restart — this is a deliberate exception to the site-wide sessionStorage convention introduced in feature 114.

Session object shape:

```js
/**
 * @typedef {Object} PlaySession
 * @property {string} characterUid
 * @property {Object} characterSnapshot - { name, personality, portraitUrl, parts }
 * @property {string} outfitUid
 * @property {string} locationPartUid
 * @property {Object} locationAttributes - { [attrName]: selectedValue }
 * @property {Object} slotState - { [slotType]: 'covered'|'revealing'|'removed' }
 * @property {string} musicGenre
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
 * @property {number} pageCount - visible page count for this chapter
 * @property {Object} slotStateAtEntry - slot state snapshot when this chapter was entered
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
  locationPartUid: '',
  locationAttributes: {},
  slotState: {},
  musicGenre: '',
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
