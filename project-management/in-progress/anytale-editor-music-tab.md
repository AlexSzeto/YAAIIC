# AnyTale Editor Music Tab

## Goal

Add a Music tab to the AnyTale editor for managing genres and their track playlists. Expand the global audio player with a dedicated BGM looping channel (Web Audio API). Support generating new tracks via the AceStep workflow from within the editor. Play mode will consume this library; auto-seeding one track per empty genre is deferred to the play mode spec.

## Tasks

### Phase 1 — BGM looping player

- [x] Add `globalBgmPlayer` export to `public/js/custom-ui/global-audio-player.mjs` — a Web Audio API–based looping player that accepts a playlist of URLs, advances on track end, emits track-start events `{ url, label, index, total }`, and resets the playlist on stop; `globalAudioPlayer` (voice channel) is left completely unchanged
- [x] Implement configurable transition between tracks: crossfade (overlap + blend) or fade mode (fade out tail of track A, fade in head of track B); transition config object `{ mode: 'crossfade'|'fade', durationSeconds }`
- [x] Add render entry and usage examples for `globalBgmPlayer` in `public/js/custom-ui/test.html`
- [x] Add vitest tests for `globalBgmPlayer`: playlist advance, track-start events, stop resets playlist, voice and BGM channels coexist without stopping each other

#### Fixes and Changes
- [x] Redesign `GlobalBgmPlayer` to use `HTMLAudioElement` + `createMediaElementSource` (fixes CORS "Failed to fetch" on external URLs); expose `getCurrentAudioElement()`, `getCurrentTime()`, `getDuration()`; support segment playlist items `{ url, startTime?, duration? }` in addition to plain strings
- [x] Rebuild test.html BGM demo as a full AudioPlayer-style UI (progress bar, current/total time, track name/index); preload soundhelix track and create 5 random 20-second segments as the playlist to test crossfade transitions
- [x] Replace custom-bordered div in BgmPlayerDemo with `Panel variant="glass" padding="small"` to match AudioPlayer backdrop convention
- [x] Replace external soundhelix URL in BgmPlayerDemo with static local audio files (user will provide segments + album images); update demo to use a hardcoded playlist of local file paths

### Phase 2 — Server: genres and track generation

- [x] Write migration script `scripts/migrate/anytale-data/0-to-1.mjs` adding `genres: []` to `anytale-data.json`; bump `anytale-data` `currentVersion` to `1` in `server/core/data-versions.mjs`
- [x] Add `musicWorkflow` (string) and `defaultMusicLength` (number, seconds) to `config.default.json` under the `anytale` block
- [x] Implement genre CRUD endpoints (`GET /anytale/genres`, `POST /anytale/genres`, `PUT /anytale/genres/:uid`, `DELETE /anytale/genres/:uid`) in `server/features/anytale/router.mjs`, `service.mjs`, and `repository.mjs`
- [x] Implement `POST /anytale/genres/:uid/generate-track`: assembles prompt from genre template + random variation, picks random key/BPM/time signature/adjective/noun, queues AceStep generation; orchestrator completion saves the new track (with all generation parameters) nested inside the genre and returns `{ genreUid, track }` in the result
- [x] Add co-located tests for genre CRUD routes and track generation endpoint
- [x] Fix `readData` in `repository.mjs` to preserve the `version` field when reading so that `writeData` never strips it and the migrator does not re-trigger on every restart
- [x] Extend `POST /anytale/genres/:uid/generate-track` to accept optional `genreOverrides` in the request body (merged over the DB genre before param picking); client passes `editToGenre(edit, genre)` so unsaved form values are used; add test coverage

### Phase 3 — Music tab UI

- [x] Extract a reusable `MultiSelect` component to `public/js/custom-ui/io/multi-select.mjs` — renders a button that opens an inline popover checklist anchored below the trigger (or above if near the bottom of the viewport); use `e.currentTarget.getBoundingClientRect()` in the click handler for positioning — do not ref a styled component; add to `test.html` and `test.vitest.mjs`
- [x] Add a Music tab to `anytale-form.mjs`; tab id `'music'`; persists active tab in `localStorage` alongside existing tabs
- [x] Build genre `DynamicList` with collapsible cards; each expanded card contains: name (`Input`), music prompt (`Input` textarea), variations (`Input` textarea, comma-separated), adjectives (`Input` textarea, comma-separated), nouns (`Input` textarea, comma-separated), keys (`MultiSelect`), BPM range slider (`min`/`max`), time signatures (`MultiSelect`); bottom button row: Save/Update (change-detected, disabled when clean) + Delete (with confirmation dialog, deletes genre and all nested tracks)
- [x] Build compact track sub-list per genre: compact `DynamicList` rows showing track name + key / BPM / time signature metadata + icon play button (queues track to `globalBgmPlayer` playlist) + delete icon; Generate Track button below the list, disabled while a generation task is in flight for that genre
- [x] Wire Generate Track to `POST /anytale/genres/:uid/generate-track` with SSE progress tracking via `queueSSEManager` + `progressShow` (same pattern as portrait/voice); on complete, refresh genre's track list
- [x] Build fixed BGM player section at bottom of Music tab: row 1 — track name, genre name, index/total labels (updated via `globalBgmPlayer` track-start events); row 2 — `AudioPlayer`-styled BGM controls backed by `globalBgmPlayer`; Playlist icon button to the right of the two rows opens playlist management modal
- [x] Build playlist management modal: currently-playing track pinned at top, remaining tracks listed below with drag-to-reorder and delete; mirrors queue management modal conventions
- [x] Review and update affected living docs: `docs/features/anytale.md`, `docs/components.md`, `.claude/rules/client.md`

#### Fixes and Changes
- [x] Fix time signature values: use numeric strings `['2', '3', '4', '6']` (AceStep expects these, meaning 2/4, 3/4, 4/4, 6/8); update `TIME_SIGNATURES` constant in `music-section.mjs` and corresponding test data in `router.test.mjs`
- [x] Add `optionLabels?: string[]` prop to `MultiSelect` so values and display labels can differ; use it in `music-section.mjs` to show verbose time signature labels (2/4, 3/4, 4/4, 6/8) while storing numeric values; update `test.html`, `test.vitest.mjs`, and `docs/components.md`
- [x] Give Variations and Adjectives their own full-width rows in `GenreCard` (remove shared 2-column layout)
- [x] Move BPM Range slider above Keys in `GenreCard`
- [x] Fix `apiGenerateTrack` to inline `getClientId()` directly in the payload instead of taking it as a parameter (matches `character-api.mjs` pattern)
- [x] Add `audioFormat: 'mp3'` to `requestData` in the generate-track router handler (orchestrator requires this field for audio workflows)
- [x] Extend `globalBgmPlayer._normalise` to preserve a `label` field; use `item.label || _urlToLabel(item.url)` in `getCurrentTrack()` and `_playTrackAt()`; update `handleTrackPlay` to pass `{ url, label }` objects; update `PlaylistModal` to use item label
- [x] Move Generate Track, Save, and Delete buttons above the Tracks header in `GenreCard`
- [x] Save button: use `save` icon, label `'Update'` when genre has a uid (i.e. already saved to server)
- [x] Remove disabled/loading state from Generate Track button (allow unlimited concurrent generations per genre)
- [x] Add reconnect-resume effect to `MusicSection` that watches `activeTasks` for `anytale-music` tasks and calls `progressShow` for each — mirrors the pattern in `anytale-form.mjs` so banners reappear after tab switches and concurrent generations are tracked
- [x] Redesign `globalBgmPlayer` to consume-from-front queue: advance removes the played track from the front (`_playlist.splice(0, 1)`) and plays next if available, otherwise stops; add `appendToPlaylist(item)` that normalises and pushes to `_playlist`, auto-starting playback if not already playing
- [x] Add `hideDelete?: boolean` prop to `DynamicList`, `DynamicListItem`, and `CondensedDynamicListItem`; when true, suppress per-item delete buttons in both item variants
- [x] Update `handleTrackPlay` in `MusicSection` to call `appendToPlaylist({ url, label })` instead of `setPlaylist + play`; redesign `PlaylistModal` to show queue items without reorder drag handles, delete blocked on index 0 (currently-playing); apply `hideDelete={true}` and disable drag on genres `DynamicList`
- [x] Fix `QueueStatusBanner` offset for music generation: pass `progressVisible={activeTasks.length > 0}` in `anytale.mjs` instead of `!!taskId` so the banner shifts up for any active progress, not just story image tasks
- [x] Conform `PlaylistModal`: add `hideCloseButton` and `minWidth` props to `Modal`; update `PlaylistModal` to set `minWidth="500px"`, `hideCloseButton={true}`, and pass a footer `Close` button
- [x] Add `skipCurrent()` to `globalBgmPlayer`: cancel advance timer, increment `_playId`, call `_consumeAndAdvance()` to immediately crossfade/fade into the next track (or stop if empty); update `PlaylistModal` to call `skipCurrent()` for index-0 delete instead of blocking it; show delete icon for all items with tooltip `'Skip track'` for index 0; auto-append newly generated tracks to the BGM playlist in `MusicSection` `onComplete` using `data.result.audioUrl` + `data.result.name` + genre name from refreshed genres; update `BgmPlayerBar` sub-label to `'Genre Name - N tracks queued'`; update playlist item labels to `'Track Name - Genre'` via `handleTrackPlay` and `getTrackLabel`

## Implementation Details

### Genre data shape

```js
{
  uid: string,
  name: string,
  musicPrompt: string,      // template; use {{variation}} as insertion point
  variations: string[],     // stored as comma-separated textarea; one picked randomly at generation
  adjectives: string[],     // comma-separated textarea; one picked randomly for track name
  nouns: string[],          // comma-separated textarea; one picked randomly for track name
  keys: string[],           // subset of constrained musical keys
  bpmMin: number,
  bpmMax: number,
  timeSignatures: string[], // subset of constrained time signature set
  tracks: Track[],
}
```

### Track data shape

```js
{
  uid: string,
  name: string,             // "[random adjective] [random noun]" assigned at generation
  key: string,
  bpm: number,
  timeSignature: string,
  audioUrl: string,
}
```

### Prompt assembly (server-side, at generation time)

```js
const variation = pick(genre.variations);
const prompt = genre.musicPrompt.replace('{{variation}}', variation);
const key = pick(genre.keys);
const bpm = randomInt(genre.bpmMin, genre.bpmMax);
const timeSignature = pick(genre.timeSignatures);
const name = `${pick(genre.adjectives)} ${pick(genre.nouns)}`;
```

### AceStep workflow parameters

| Parameter | Value |
|---|---|
| `name` | `[adjective] [noun]` |
| `prompt` | assembled template string |
| `lyrics` | `""` (blank → instrumental) |
| `bpm` | random integer in `[bpmMin, bpmMax]` |
| `key` | random from `keys` |
| `time_signature` | random from `timeSignatures` |
| `length` | `config.anytale.defaultMusicLength` |

### Migration interface

```js
// scripts/migrate/anytale-data/0-to-1.mjs
export const fromVersion = 0;
export const toVersion = 1;
export function migrate(data) {
  data.genres = [];
  return data;
}
```

### globalBgmPlayer API sketch

```js
globalBgmPlayer.setPlaylist(urls: string[])
globalBgmPlayer.play()
globalBgmPlayer.stop()          // also resets playlist
globalBgmPlayer.isPlaying(): boolean
globalBgmPlayer.getCurrentTrack(): { url, label, index, total } | null
globalBgmPlayer.setTransition({ mode: 'crossfade'|'fade', durationSeconds: number })
globalBgmPlayer.subscribe(callback): () => void  // fires on play, stop, track-start
```

### endpointKey for orchestrator

| endpointKey | Trigger | Completion action |
|---|---|---|
| `anytale-music` | `POST /anytale/genres/:uid/generate-track` | Saves track nested in genre; returns `{ genreUid, track }` |

`anytale-music` is added to the orchestrator's `silent` set (no global notification popup).

### MultiSelect positioning

Use `e.currentTarget.getBoundingClientRect()` in the trigger button's click handler to get anchor coordinates. Do not attach a `ref` to a `styled()` component — this yields the Preact instance, not the DOM node. Render the popover into a portal at the document body level, positioned absolutely using the captured coordinates.

### Play mode auto-seed (out of scope — deferred to play mode spec)

When play mode starts, for each genre with `tracks.length === 0`, queue one `anytale-music` generation. This is a play mode concern and is not implemented here.
