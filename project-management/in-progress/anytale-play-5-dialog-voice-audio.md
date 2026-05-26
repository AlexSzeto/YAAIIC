# AnyTale Play Mode — Rollout 5: Dialog, Voice & Audio

## Goal

Add the dialog (LLM), voice (TTS), and background music systems to play mode. After this rollout, dialog text appears in speech bubbles during chapter navigation, character voice plays automatically via a new TTS endpoint, background music loops with genre selection, and the mute/music controls work. The queue strategy is expanded to include dialog and voice ordering.

## Tasks

- [x] **AnyTale dialog config (server):** Add AnyTale dialog settings to `server/config.default.json` and the AnyTale config endpoint (`GET /anytale/config`). Settings: `model`, `systemMessage` (template with `{{profile}}` and `{{location}}` placeholders), `parameters` (`temperature`, `topP`, `maxTokens`), `mode` (`chat` or `completion`), optional `format` (`chatml`), and `stream` (boolean, default false). **Manual test:** change config values, verify `GET /anytale/config` returns updated dialog settings.

- [x] **Chat client adapter:** Add a play-mode client module that renders the configured `systemMessage` template (substituting `{{profile}}` with character personality, `{{location}}` with background location attribute value), sends the page's `dialogPrompt` as the user message, calls `POST /api/chat` with configured mode/parameters, normalizes the response. Expose a `generateDialog({ character, background, page, signal })` API. Map parameter names to Ollama options (`topP` → `top_p`, `maxTokens` → `num_predict`). **Manual test:** call adapter from a page with a dialog prompt, verify response contains dialog text.

- [x] **Dialog generation flow:** When entering a chapter, queue all page dialogs concurrently (separate from ComfyUI queue since Ollama is independent). Skip dialog for pages where `dialogPrompt` is empty/blank, character personality is missing, or background location attribute is missing. Cache successful dialog text in the asset cache by stable signature. On page display, show cached dialog in the speech bubble. **Manual test:** step through pages, verify speech bubble shows dialog for qualifying pages and is empty for others; back navigation reuses cached dialog.

- [x] **Dialog TTS endpoint (server):** Add a play-mode server endpoint that accepts character uid (or voice sample reference) plus dialog text. Preprocesses inputs for a configured TTS workflow (Chatterbox/Qwen-style), runs ComfyUI generation, returns speech audio URL + metadata. This is NOT the existing personality-to-voice-sample endpoint (`/anytale/characters/:uid/generate-voice`). Use endpointKey `anytale-play-speech` and add it to the `silent` list in `server/features/generation/orchestrator.mjs` — **generated audio must NOT enter the media library**. **Manual test:** POST with character voice sample + dialog text, verify returned audio speaks the provided text.

- [x] **Audio channel wiring:** Wire `globalBgmPlayer` as the music channel and `globalAudioPlayer` as the voice/dialog channel. On session start, load random tracks from the stored genre into `globalBgmPlayer` and begin playback. On page entry with a generated voice URL, play it via `globalAudioPlayer`. Both players support independent mute/stop. On reset/leave, stop both players and clear the BGM playlist. **Manual test:** play music and voice simultaneously; mute voice — music continues; stop music — voice continues; reset stops both.

- [x] **Voice integration:** When a page has dialog text and the character has a voice sample, queue TTS generation and play the result through the voice channel. Respect mute (no playback, no new TTS requests while muted). If character has no voice sample, treat as muted for speech (show text only, no TTS request). Store voice URL in session asset cache. **Manual test:** mute during voice playback — audio stops immediately; unmute — next page voice plays; character without voice sample shows text only.

- [x] **Background music control:** Wire the music play/stop button to `globalBgmPlayer`. On session start, load random tracks from the stored genre into `globalBgmPlayer` and begin playback with fade-in. Music persists across chapters (does not change on chapter transition). Music play/stop toggles `globalBgmPlayer`. **Manual test:** start play, verify music plays continuously; stop, verify silence; restart, verify fade-in.

- [x] **Queue integration for dialog + voice ordering:** Expand the chapter queue strategy to the full ordering: (1) all dialogs (concurrent, via Ollama), (2) page 1 image (ComfyUI), (3) page 1 voice if applicable (ComfyUI), (4) remaining images (pages 2+), (5) remaining voices (pages 2+). Play cannot proceed until all dialogs AND page 1 image + voice (if applicable) are ready. **Manual test:** enter a chapter, verify queue order in network/server logs matches the specified sequence.

- [x] **Dynamic voice reprioritization:** When the user navigates to a page whose voice is not yet generated and voice is enabled: pause the queue (leave running generation in place), move that page's voice task to the top position, restart the queue. **Manual test:** navigate ahead of pre-render progress, verify voice task for the current page is reprioritized.

- [x] **Progress bar voice awareness:** Update the progress bar "loaded" layer to consider voice readiness when voice is applicable (character has voice sample and is not muted). When muted, loaded state considers only images. When unmuted, loaded state requires both image + voice. **Manual test:** mute/unmute and verify progress bar loaded percentage changes accordingly.

- [x] **Asset cache expansion:** Extend the generated asset cache entries to store dialog text + status and voice URL + status alongside the existing image data, all keyed by the same stable signature. **Manual test:** reload page, verify cached dialog and voice are reused without re-generation.

- [x] **Optional streamed dialog UI:** If `anytale.dialog.stream` is enabled in config, parse the `/api/chat` SSE response incrementally, append partial assistant content to the speech bubble, finalize cached dialog only on completion. Keep non-streaming as the default path. **Manual test:** enable streaming in config, verify partial text appears progressively in the speech bubble.

## Implementation Details

### Media library exclusion (mandatory)

All ComfyUI generation tasks initiated by play mode **must not** appear in the media library. This applies to every generation endpoint added in this and all future play mode rollouts. Enforce via the `silent` flag in `server/features/generation/orchestrator.mjs`:

```js
const silent = ...
  || endpointKey === 'anytale-play-intro'
  || endpointKey === 'anytale-play-chapter'
  || endpointKey === 'anytale-play-speech';  // Rollout 5 — add any new play endpointKey here
```

When adding any new play mode generation endpoint, the endpointKey **must** be added to this list in the same task. Do not ship a generation endpoint without verifying it is in the silent list.

### Dialog system architecture

Dialog text always generates when conditions are met — there is no on/off toggle. The mute button controls only voice/TTS playback, not dialog text generation.

The chat client adapter renders the system message template at call time:
```js
const systemMessage = config.systemMessage
  .replace('{{profile}}', character.personality || '')
  .replace('{{location}}', locationAttributeValue || '');
```

Skip conditions (any one triggers skip):
- Page's `dialogPrompt` is empty or blank after trimming
- Character's `personality` field is missing/empty
- Location part's location attribute value is not selected

### TTS endpoint

The new endpoint is distinct from the existing personality-to-voice-sample endpoint. It accepts dialog text (the output of `/api/chat`) and a character voice sample reference, then runs a TTS ComfyUI workflow to produce spoken audio.

Endpoint shape: `POST /anytale/play/generate-speech`
```json
{
  "characterUid": "...",
  "voiceSampleUrl": "/media/audio_xxx.mp3",
  "dialogText": "The generated dialog line to speak",
  "signal": "optional-abort-signal-id"
}
```

### Audio channel architecture

No custom audio runtime is needed. Play mode uses two existing players:

- **`globalBgmPlayer`** — music channel. Load random tracks from the selected genre on session start (and on reload). The player manages continuous playback via periodic playlist insertions and handles crossfade internally.
- **`globalAudioPlayer`** — voice/dialog channel. Called with a TTS audio URL on page entry when voice is available and not muted. Stop it immediately on mute or page navigation.

### Queue ordering

Voice generation goes through the ComfyUI queue (same as images), so it competes for queue slots. Dialog generation goes through Ollama (`POST /api/chat`) and can run concurrently with ComfyUI work. The queue module should track dialog tasks separately from ComfyUI tasks.

### Asset cache entry (expanded)

```js
{
  imageUrl: string | null,
  imageTaskId: string | null,
  imageStatus: 'pending' | 'generating' | 'complete' | 'error',
  dialogText: string | null,
  dialogStatus: 'pending' | 'generating' | 'complete' | 'error' | 'skipped',
  voiceUrl: string | null,
  voiceTaskId: string | null,
  voiceStatus: 'pending' | 'generating' | 'complete' | 'error' | 'skipped',
  generatedAt: number
}
```

#### Fixes and Changes

- [x] **Sequential per-page generation order:** Change chapter initialization so images and TTS are queued in per-page order, not all at once. Order: (1) all dialogs concurrently, (2) page 1 image queued, (3) page 1 TTS queued immediately after page 1 image completes (if voice applicable), (4) page 2 image queued after page 1 TTS is queued, (5) page 2 TTS, … continuing in page order.

- [x] **Chapter transition gate:** Do not show chapter page mode until page 1 image AND page 1 TTS (when voice applicable) are both settled (complete/skipped/error). The `currentPageReady` flag on the current visible page must include voice readiness.

- [x] **TTS cancel on mute:** When `session.muted` becomes true, immediately cancel all in-queue and in-progress TTS (`anytale-play-speech`) tasks. Collect voiceTaskIds from the cache for all visible pages whose voiceStatus is `generating`, send `DELETE /queue/:id` for each, and reset their voiceStatus to `skipped` locally.

- [x] **TTS re-queue and backward navigation on unmute:** When `session.muted` becomes false, re-queue TTS for all visible pages that have complete dialog text but no settled voice. After re-queuing, navigate backward to the earliest visible page that is now waiting for TTS (or remain on the loading screen if page 1 is still missing voice).

- [x] **Immediate voice playback on unmute:** When `session.muted` becomes false and the current page already has a voice URL, play it immediately via `globalAudioPlayer`.

- [x] **Stop intro audio on character change:** When the user initiates a character pick from the introduction screen, call `globalAudioPlayer.stop()` before transitioning, so the outgoing character's intro transcript stops immediately.

- [x] **Hide dialog text during loading:** Do not pass `currentDialogText` as `bubbleText` when the page is still loading (`currentPageReady` is false). Loading mode should always receive an empty `bubbleText` so it shows "Loading", not the pre-fetched dialog.

- [x] **initChapter rewrite — two-phase flush+generate:** Rewrite `initChapter` to be async with two distinct phases: (1) clear `taskToPageRef`/`pendingChapterEventsRef`, then `DELETE /queue/items/source/anytale-play` to flush all anytale-play items (queued and running); (2) hydrate from cache, generate all missing dialog sequentially (if `dialogEnabled`), wait for dialog to complete, then for each visible page queue image (if missing) and TTS (if missing and dialog enabled and voice applicable). Add `currentPlotRef` and `initChapterRef` stable refs. On reconnect (when phase is `plot`), call `initChapterRef.current` instead of fetching `/queue/status`. On unmute (when character has voice sample), reset any 'skipped' cache voice entries that have dialog text back to 'pending', then call `initChapterRef.current` to re-queue.

- [x] **Reset stale voice cache after Phase 1 flush:** In the hydration loop (after the queue flush), reset any voice cache entries with status `'generating'` or `'error'` to `'pending'` so Phase 3 correctly re-queues TTS instead of treating them as in-progress. Rename inner Steps to "Phase 2" (dialog) and "Phase 3" (images + TTS) in comments to match the user-visible description.

- [x] **BGM not playing during introduction** causing the page to be silent throughout despite music being turned on and if forced to start by using the BGM button, continues playing the same track when the genre is being changed. Music is restored properly if the user returns to a partially or completely loaded chapter.

- [x] Add a color cycling animation between the loaded color (secondary) and the unloaded error (danger) in the progress bar, for the unloaded sections only. If this is being maintained through javascript, start the updates when a chapter begins loading, then stop updating when the chapter completes loading.

- [x] Change the autoplay behavior: when dialog (TTS) is turned off, add a 5 seconds delay betwen page transition, and add 3 seconds if text is currently on screen (from generated dialogs). when dialog is turned off, tie the transition to the voice - when the voice audio file finishes playing, add 3 seconds before transitioning to the next page. Use the dialog off behavior when no voice is tied to the current page.

- [x] **Simultaneous asset transition:** When navigating to a page, do not crossfade to the new background image when it finishes loading. Keep displaying the previous page's image until all assets (image, dialog, TTS if applicable) are ready, then simultaneously: crossfade to the new image, reveal dialog text, and begin voice playback. Preload the image in the background so the crossfade is instant when readiness is achieved.