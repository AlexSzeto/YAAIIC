# AnyTale SFX

## Goal

Add per-page sound effect (SFX) playback to AnyTale play mode. SFX records are managed in the AnyTale editor (SFX & Music tab), each with a name, tags, and a generation prompt. During play, eager per-page SFX generation is triggered when any SFX tag exactly matches any plot page prompt tag. A dedicated audio channel (channel 1) plays the generated SFX on page entry. A player-controlled SFX toggle (persisted in prefs) suppresses generation and playback when disabled.

## Tasks

### Phase 1 — Audio infrastructure, data migration, and server routes

- [x] Refactor `GlobalAudioPlayer` in `public/js/custom-ui/global-audio-player.mjs` to support multiple independent audio channels:
  - Replace single `audioElement`/`currentAudioUrl`/`currentInstanceId`/`_regionEndHandler` fields with `this._channels = []` — a sparse array of `{ audioElement, currentAudioUrl, currentInstanceId, _regionEndHandler }` channel objects.
  - Add private `_getChannel(idx)` that lazily creates and returns the channel slot at `idx`, initialising `audioElement` with event listeners on first access.
  - Add optional `channel = 0` as the last parameter to `play()`, `stop()`, `toggle()`, and `isPlaying()`. All existing call sites remain valid (channel defaults to 0). `subscribe()` and `notifyListeners()` are shared across all channels.
- [x] Write migration `scripts/migrate/anytale-data/5-to-6.mjs` that appends `sfx: []` to the root of the data object; bump `anytale-data` `currentVersion` to `6` in `server/core/data-versions.mjs`.
- [x] Add `SfxRecord` typedef to `server/features/anytale/repository.mjs` and update the repository to read/write the `sfx` array alongside existing arrays; add `getSfxList`, `createSfx`, `updateSfx`, `deleteSfx` methods.
- [x] Add SFX CRUD routes to `server/features/anytale/router.mjs`:
  - `GET /anytale/sfx` — return `sfx` array
  - `POST /anytale/sfx` — create record (server assigns UUID); return saved record
  - `PUT /anytale/sfx/:uid` — upsert; return saved record
  - `DELETE /anytale/sfx/:uid` — remove; return `{ deleted: true }`
- [x] Add `POST /anytale/sfx/:uid/generate-preview` route — queues `sfxWorkflow` with the record's `prompt` and `audioFormat: 'mp3'`; on orchestrator completion sets `sfx.audioUrl` on the record via `updateSfx`; returns `{ taskId }`.
- [x] Add `POST /anytale/play/generate-sfx` route — queues `sfxWorkflow` with `{ prompt, audioFormat: 'mp3', seed, tags: '', description: '', summary: '', entityType: 'anytale-play-sfx', requestOrigin: 'anytale-play' }`; returns `{ taskId }`. Does **not** write back to the SFX record (play-generated audio is ephemeral).
- [x] Write co-located route tests for all five new endpoints in `server/features/anytale/router.test.mjs` (or a new `sfx.test.mjs` alongside the router).

#### Fixes and Changes
- [x] Add `sfxWorkflow` key to `server/config.default.json` (`anytale` block) and write `scripts/migrate/config/4-to-5.mjs` to seed it from the default for existing installs; bump `config` `currentVersion` to `5` in `server/core/data-versions.mjs`.

### Phase 2 — Editor SFX section

- [x] Rename the "Music" tab label to **"SFX & Music"** in the AnyTale tab list and expand `music-section.mjs` (or extract a new `sfx-section.mjs`) to include an SFX editing section rendered **above** the Music section; wrap each section in the same `Panel` outline component used by other tabs.
- [x] Implement the SFX section UI:
  - **Load button** opens a `SearchSelectModal` listing all SFX records; primary label = `name`, secondary label = `tags` joined with `, `; selecting a record sets it as the active SFX for editing.
  - **DynamicList** of SFX records with compact form fields per item:
    - `name` — `Input`
    - `tags` — `TagInput`
    - `prompt` — `<textarea>` styled with goober
    - Below the prompt: a horizontal row with a small icon button (generate icon) on the left and an `AudioPlayer` (`public/js/custom-ui/media/audio-player.mjs`) on the right. The icon button queues `POST /anytale/sfx/:uid/generate-preview` and shows in-progress state while generating; on completion the SFX record's `audioUrl` is updated and the `AudioPlayer` reflects the new URL automatically. The `AudioPlayer` is disabled (or hidden) when `audioUrl` is empty.
  - CRUD: add (blank record → save → server assigns UID), delete (with confirm dialog).
- [x] Add a minimal render entry for the SFX section

#### Fixes and Changes
- [x] Restore `BgmPlayerBar` to its original fixed position at the bottom of the tab (outside both panels); move the genre `DynamicList` into its own `Panel` inside the `ScrollArea`
- [x] Move the SFX panel inside the shared `ScrollArea` alongside the Music panel
- [x] Fix SfxCard and SfxSection to match AnyTale editor conventions
- [x] Change SfxCard generate preview button icon from `"music"` to `"equalizer"`
- [x] Add `anytale-sfx-preview` and `anytale-play-sfx` to the `silent` set
- [x] Add `getChannelState(channel)` to `GlobalAudioPlayer`
- [x] Fix `AudioPlayer._loadMetadata` to call `audio.load()`
- [x] Fix progress bar click when not playing: add `onSeekRequest` prop to `AudioTimeline`; when not playing and user clicks, call it with the target time; in `AudioPlayer` pass a handler that calls `globalAudioPlayer.play()` from the clicked position so browsers fetch metadata without waiting for playback; add `channel` prop to `AudioPlayer` (default 0); fix all direct property accesses (`audioElement`, `currentAudioUrl`, `currentInstanceId`) that broke after the multi-channel refactor in `orchestrator.mjs`; add `anytale-sfx-preview` completion handler that calls `setSfxAudioUrl`; fix `SfxCard` to subscribe via `queueSSEManager` for `queue:task-started` (matching `sfxUid`) and call `progressShow` with the SSE task ID instead of the queue item ID: Load button as `small-text/secondary/folder-open` in `HorizontalEdgesLayout` next to H2; remove standalone Add button (DynamicList provides it); fix `formButtonStates(recorded, dirty)` call; add Revert button (`small-text/secondary/undo`); wrap Save+Revert in `ButtonRow`; Name input `widthScale="full"`; generate preview as `Button variant="medium-icon"`; show disabled `AudioPlayer` when `audioUrl` is empty instead of placeholder text to `public/js/custom-ui/test.vitest.mjs` (only if extracted as a new reusable component; skip if kept app-specific).

### Phase 3 — SFX match indicator in the plot editor

- [x] Add `findAllMatchingSfx(pageTagsString, sfxList)` to `play-utils.mjs`:
  - Split `pageTagsString` by comma, trim, lowercase each token; iterate tokens in order.
  - For each token, collect **all** SFX whose `tags` array contains an exact case-insensitive match, paired with that token as the `matchingTag`.
  - Return an array of `{ sfx, matchingTag }` in page-tag order (deduped by SFX uid so the same SFX only appears once, at its earliest matching token). `findMatchingSfx` remains unchanged and delegates to this as `findAllMatchingSfx(...)[0]?.sfx ?? null`.
- [x] Create `public/js/app-ui/anytale/sfx-match-pill.mjs` — a small display-only component `SfxMatchPill({ sfx, matchingTag, primary = false })`:
  - Styled as a compact pill (`border-radius: 9999px`, `font-size: small`, `padding: 2px 10px`), matching the shape of existing pills in `plot-page-pills.mjs`.
  - `primary = true`: filled with `theme.colors.primary.background`.
  - `primary = false`: transparent background, `border: ${theme.border.width} solid ${theme.colors.border}` (outline variant).
  - Label text: `"[sfx.name]: [matchingTag]"`.
- [x] In `plot-section.mjs`:
  - Fetch `/anytale/sfx` in a `useEffect` on mount (same pattern as the existing `/anytale/config` fetch); store result in `sfxList` state.
  - `useMemo` over `currentPage.tags` and `sfxList` to produce `sfxMatches` — the result of `findAllMatchingSfx(currentPage.tags, sfxList)`.
  - Insert the SFX indicator block into the render between the dialog-preview `Label` and the Page Tags `TagInput`:
    - `<${Label}>SFX Played</${Label}>`
    - `<${PillRow}>` containing `sfxMatches.map(({ sfx, matchingTag }, i) => SfxMatchPill)` — first pill (`i === 0`) gets `primary=${true}`, rest get `primary=${false}`.
    - Render the block unconditionally (the `Label` is always visible; `PillRow` is empty when there are no matches).

### Phase 4 — Play mode SFX

- [ ] Add `sfxOn: true` to `DEFAULT_PREFS` in `play-prefs.mjs`; confirm `loadPrefs` merges it for existing stored prefs.
- [ ] Add `sfx` to the parallel fetch in `play-data.mjs` (`fetch('/anytale/sfx').then(r => r.json())`); include `sfx` in the returned and cached object.
- [ ] Add SFX matching helper `findMatchingSfx(pageTagsString, sfxList)` in `play-utils.mjs` (delegates to `findAllMatchingSfx` — see Phase 3).
- [ ] Extend chapter initialisation in `anytale-play.mjs`:
  - Add `pageSfxUrls` and `pageSfxStatuses` state (same shape as `pageVoiceUrls`/`pageVoiceStatuses`).
  - In the per-visible-page loop, call `findMatchingSfx` for each page. If a match is found and `sfxOn` is enabled, queue `POST /anytale/play/generate-sfx` with the SFX record's `prompt`; handle SSE completion into `pageSfxUrls`/`pageSfxStatuses` via a new `subscribeSfxProgress` callback (same pattern as `subscribeVoiceProgress`).
  - When `sfxOn` is disabled, set `pageSfxStatuses[idx] = 'skipped'` (no fetch).
- [ ] Wire SFX playback into page-entry effects:
  - In the existing `useEffect` that fires on `session.pageIndex` changes (stops voice on page turn): add `globalAudioPlayer.stop(1)` to stop the SFX channel.
  - In the display-advance effect: when SFX is settled and `sfxOn`, call `globalAudioPlayer.play(pageSfxUrls[plotIdx], null, null, 1)`.
- [ ] Create `public/js/app-ui/anytale/play/play-toggle-button.mjs` — a new `PlayToggleButton({ icon, enabled, onClick, title })` component used for the three audio-option toggles. When `enabled = false`, renders a `block` icon overlaid on top of the base icon to signal the option is disabled. Reuse the existing `PlayButton` / `GlassButton` styling patterns from the same directory.
- [ ] Replace the existing mute/music buttons in `PortraitPanel` top controls with `PlayToggleButton` instances and add the SFX toggle. Final left-to-right button order: **restart**, **music** (`icon="music"`, tied to `session.musicOn`), **SFX** (`icon="equalizer"`, tied to `session.sfxOn`), **TTS** (`icon="microphone"`, tied to `!session.muted`). Each toggle calls the appropriate `patchPrefs` + `updateSession` handler on click.
  - SFX toggle: on disable — `globalAudioPlayer.stop(1)`; mark all `'generating'` SFX statuses as `'skipped'`. On enable — re-queue SFX for any visible pages whose status is `'skipped'` (same logic as the mute-toggle voice resumption).
- [ ] Update `play-session.mjs` so `sfxOn` is overlaid from prefs in `load()` (same pattern as `muted`/`musicOn`); `sfxOn` is never written to the session key directly — only to prefs.

### Phase 5 — SFX prompt enhancement

- [ ] Add two state variables to `SfxCard`: `enhance` (boolean, default `false`) and `prevPrompt` (string|null, default `null`).
- [ ] Below the prompt `SfxPromptTextarea`, render an `EnhanceRow` (horizontal flex, `HorizontalEdgesLayout` pattern):
  - **Left**: `Checkbox` with label `"Enhance"` bound to `enhance` state.
  - **Right**: `"Revert Prompt"` button — `variant="small-text" color="secondary" icon="undo"` — disabled when `prevPrompt` is `null`.
- [ ] In `handleGeneratePreview`, when `enhance` is `true`, include `enhancePrompt: true` in the `apiGenerateSfxPreview` request body (update the helper to accept and forward an options object). The existing `apiGenerateSfxPreview` sends a JSON body to `POST /anytale/sfx/:uid/generate-preview` — add `enhancePrompt` to that body.
- [ ] In the `queueSSEManager` `onComplete` handler in `SfxCard`: if `data.result.summary` is a non-empty string, store the current `prompt` in `prevPrompt` and replace `prompt` with `data.result.summary` (the enhanced prompt returned by the workflow).
- [ ] Wire the Revert Prompt button: on click, set `prompt` to `prevPrompt` and clear `prevPrompt` to `null`.
- [ ] Update `POST /anytale/sfx/:uid/generate-preview` route to forward `enhancePrompt` from the request body into `requestData` (same pattern as other boolean workflow flags).

### Phase 6 — Docs

- [ ] Update `docs/features/anytale.md`:
  - Add `SfxRecord` shape to Key Data Shapes
  - Add SFX CRUD + generate-preview + generate-sfx endpoints to the Server Endpoints table
  - Add `sfxWorkflow` to the Config keys table
  - Add `sfx-match-pill.mjs` and SFX section expansion to the Component Map
  - Document the SFX matching algorithm and the `sfxOn` pref
- [ ] Review and update affected living docs: `docs/features/anytale.md`, `docs/server.md`, `.claude/rules/client.md`

## Implementation Details (Phase 5)

### Enhance row layout

```
┌─────────────────────────────────────────────────────┐
│ ☑ Enhance                        [↩ Revert Prompt]  │
└─────────────────────────────────────────────────────┘
```

Use `HorizontalEdgesLayout` (already imported) with `align-items: center`.

### prevPrompt lifecycle

| Event | prevPrompt | prompt |
|---|---|---|
| Generate preview with Enhance ON | set to current `prompt` | unchanged until SSE completes |
| SSE complete with non-empty `summary` | unchanged | replaced with `summary` |
| Revert Prompt clicked | cleared to `null` | restored from `prevPrompt` |
| Generate preview with Enhance ON (again) | overwritten with current `prompt` | unchanged until SSE completes |
| Generate preview with Enhance OFF | unchanged | unchanged |

### Request body for generate-preview with enhance

```js
{ clientId: getClientId(), enhancePrompt: true }
```

### Server-side forwarding

In `POST /anytale/sfx/:uid/generate-preview`, add to `requestData`:

```js
if (req.body.enhancePrompt) requestData.enhancePrompt = true;
```

`enhancePrompt` then flows into `generationData` automatically (via `{ ...requestData }`). The workflow reads it as an input node flag. The workflow is expected to write the enhanced prompt into `generationData.summary` before completion.

## Implementation Details

### SfxRecord shape

```js
{
  uid: string,         // server-assigned UUID
  name: string,        // human-readable label shown in editor list and picker modal
  tags: string[],      // matched against plot page prompt tags; any exact match triggers SFX
  prompt: string,      // text prompt sent to the sfxWorkflow
  audioUrl: string,    // URL of the most recently editor-generated preview (not used in play mode)
}
```

### Config key

```js
// config.json → anytale block
{
  "sfxWorkflow": "..."  // name of the ComfyUI audio workflow for SFX generation
}
```

### GlobalAudioPlayer channel refactor

```js
// Internal channel slot structure
{ audioElement: HTMLAudioElement, currentAudioUrl: string|null, currentInstanceId: any, _regionEndHandler: Function|null }

// Updated signatures (backward-compatible; channel defaults to 0)
play(audioUrl, region = null, instanceId = null, channel = 0)
stop(channel = 0)
toggle(audioUrl, region = null, instanceId = null, channel = 0)
isPlaying(audioUrl, instanceId = null, channel = 0)

// Private helpers
_getChannel(idx)              // lazily allocate channel slot and audio element
_clearRegionEnd(ch)           // clears ch._regionEndHandler
_setupRegionEnd(ch, endTime)  // sets ch._regionEndHandler
```

`notifyListeners` is called without channel context — subscribers receive no argument change.

### SFX matching algorithm

```js
// play-utils.mjs
export function findAllMatchingSfx(pageTagsString, sfxList) {
  const tokens = (pageTagsString || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  const results = [];
  for (const token of tokens) {
    for (const sfx of sfxList) {
      if (seen.has(sfx.uid)) continue;
      if ((sfx.tags || []).some(tag => tag.trim().toLowerCase() === token)) {
        seen.add(sfx.uid);
        results.push({ sfx, matchingTag: token });
        break; // one SFX per token pass; move to next token
      }
    }
  }
  return results;
}

export function findMatchingSfx(pageTagsString, sfxList) {
  return findAllMatchingSfx(pageTagsString, sfxList)[0]?.sfx ?? null;
}
```

### Play mode SFX generation request body

```js
{
  workflow: anytaleConfig.sfxWorkflow,
  prompt: sfxRecord.prompt,
  audioFormat: 'mp3',
  seed: Math.floor(Math.random() * 4294967295),
  tags: '',
  description: '',
  summary: '',
  entityType: 'anytale-play-sfx',
  requestOrigin: 'anytale-play',
}
```

### Data migration interface

```js
// scripts/migrate/anytale-data/5-to-6.mjs
export const fromVersion = 5;
export const toVersion = 6;

export function migrate(data) {
  data.sfx = [];
  return data;
}
```

### muted vs sfxOn

`muted` silences TTS (voice/dialog) only. `sfxOn` is the sole control for SFX. Neither affects the other.
