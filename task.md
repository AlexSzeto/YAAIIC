# Sound Editor — Bug Fixes

## Bugs and Design Flaws
- BUG: After edit, exported audio is exactly the same as original audio
- Edited audio name should be same as original audio name
- Files should be in mp3 format, or if not possible, in wav format (brew export, audio edit)
- Change playhead color to red, active select region to gray
- Clip regions should use a less intense shade of primary (blue) and all of them should be visible at all times
- Single clicking should move the playhead and reset the active select region
- Add play/pause button and loop button. They play through the active select region unless it's empty, in which case they play through the entire audio file
- Need icon mapping for trim/crop
- Need icon mapping for loop

## Goal

Fix all bugs and design flaws in the sound editor modal and related audio export flows.

## Tasks

- [ ] Fix `audioBufferRef` being overwritten on every WaveSurfer `ready` event: after a trim or crop, `loadBlob()` re-triggers `ready`, which re-fetches `item.audioUrl` and replaces the edited buffer with the original. Guard the fetch inside the `ready` handler so it only runs on the initial load (e.g., skip if `audioBufferRef.current` is already set).
- [ ] Pass `item.name` as the `name` field in the FormData when uploading the edited audio blob in `handleSave`, so the upload service derives the correct name for the new media entry instead of formatting "Edit" from the filename `'edit.wav'`.
- [ ] Change the brew recording format from `audio/webm` to WAV: render the captured audio through an `OfflineAudioContext` and encode it with `audioBufferToWavBlob` before uploading, since neither MP3 nor WAV is natively supported by `MediaRecorder` in all browsers. Keep `audioBufferToWavBlob` as the encoding path for audio-edit saves (already WAV).
- [ ] Change the WaveSurfer `progressColor` option from `theme.colors.primary.focus` to a red value (e.g. `'#e53935'` or a new `theme.colors.danger.background` token), and change the `enableDragSelection` region color from orange `'rgba(255,165,0,0.3)'` to a neutral gray `'rgba(120,120,120,0.35)'`.
- [ ] Change the clip region fill color in `renderClipRegions` from the hardcoded green `'rgba(0,200,100,0.25)'` to a muted variant of the theme primary color (e.g. `theme.colors.primary.background` at ~20% opacity). Ensure clip regions are always drawn by removing any logic that could suppress their rendering when an active selection region exists.
- [ ] Listen to WaveSurfer's `interaction` (or `click`) event to detect single clicks and: (a) call `remove()` on `activeRegionRef.current` if set, (b) set `activeRegionRef.current = null`, and (c) call `setHasSelection(false)`, so a plain click resets the selection without affecting the playhead.
- [ ] Add `isPlaying` and `isLooping` state variables and two new footer buttons — Play/Pause (toggles `isPlaying`) and Loop (toggles `isLooping`). The play handler uses WaveSurfer's region `play()` if an active region exists, otherwise calls `wavesurferRef.current.play()`. Loop mode calls `play()` again in the `finish` event handler while `isLooping` is true.
- [ ] Add `'cut': 'content_cut'` and `'crop': 'crop'` entries to the `ICON_MAP` in `public/js/custom-ui/layout/icon.mjs` so the Trim and Crop buttons render correctly under the Material Symbols icon system.
- [ ] Add `'repeat': 'repeat'` to the `ICON_MAP` in `public/js/custom-ui/layout/icon.mjs` for the new Loop button.

## Implementation Details

**Root cause — audioBuffer overwrite (Bug 1)**
The `ws.on('ready', ...)` callback unconditionally fetches `item.audioUrl` and calls `decodeAudioData`, replacing `audioBufferRef.current`. Since `loadBlob()` triggers a new `ready` event, every trim/crop silently resets the buffer to the original file. Fix by checking `if (audioBufferRef.current) return;` at the top of the `ready` handler, OR by setting a separate `initialLoadDone` ref flag.

**Upload name (Bug 2)**
In `handleSave`, the FormData is built with:
```js
formData.append('audio', blob, 'edit.wav');
formData.append('origin', String(item.uid));
```
The missing field is `formData.append('name', item.name)`. The upload router already reads `req.body.name` and forwards it to `processMediaUpload` as `extractedName`.

**Brew recording format (Bug 3)**
The brew editor captures audio via `MediaRecorder` → `audio/webm`. To produce a WAV file, connect the `MediaStreamDestination` to a script processor or use the `AudioWorklet` API to collect raw PCM samples and encode via `audioBufferToWavBlob`. Alternatively, record to webm then decode via `AudioContext.decodeAudioData` before re-encoding. The simpler path is the latter: decode the final webm Blob, re-encode to WAV, then upload.

**Icon map entries (Bugs 8 & 9)**
Material Symbols names: `content_cut` (scissors/trim), `crop` (crop), `loop` (loop). All three exist in the Material Symbols font. Add them to the verified section of `ICON_MAP`.

## Future Implementation Rules Suggestions

When features integrate third-party libraries that emit lifecycle events (e.g., WaveSurfer's `ready`) the rules should explicitly require developers to audit all event re-triggers caused by programmatic state changes (e.g., `loadBlob()`) and guard against unintended side-effects such as re-fetching source data; similarly, any time a new icon name is introduced in a `Button` or `Icon` component call, the developer must verify the name exists in `ICON_MAP` and add it to the verified section before shipping, and audio features that record or export audio must declare the intended output format (MP3 preferred, WAV fallback) and document why a particular encoding path was chosen, since browser codec support for `MediaRecorder` varies significantly.
