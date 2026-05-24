# AnyTale Play Mode — Rollout 4: Chapter Navigation & Queue

## Goal

Implement the core chapter playthrough experience — entering the prelude chapter from the introduction, navigating through pages with generated images, autoplay mode, the image generation queue strategy, live progress bar updates, and the generated asset cache. After this rollout, the user can "Begin the tale" from the introduction, watch images generate and display page-by-page with fade transitions, use manual or autoplay navigation, and see the progress bar reflect loading/loaded/current state.

## Tasks

- [ ] **"Begin the tale" chapter entry:** Wire the intro's "Begin the tale" button to: exit intro phase, set UI phase to `plot`, load the pre-selected prelude chapter, set page index to 0 (page 1), and trigger media queuing for the entire chapter. **Manual test:** complete intro, tap "Begin the tale", verify transition to chapter view at page 1.

- [ ] **Page visibility simulation and slot state:** At chapter entry, simulate the slot state evolution page-by-page using the current session `slotState`. For each page in order: check `requirements` against the current simulated slot state — if unmet, the page is invisible to the user; apply the page's `actions` to advance the slot state regardless. Store the list of visible page indices and the per-page slot state snapshots. Only queue image/voice generation for visible pages. **Manual test:** create a plot with a page whose requirements won't be met at entry; verify that page is skipped in the UI and the chapter shows the correct reduced page count.

- [ ] **Prompt assembly for chapter pages:** Build `enabledParts` from session character parts + outfit parts + location part. Use the slot state snapshot for the current page to determine which outfit parts are active (skip parts whose slot type is `removed`; pass `isRevealing` from the outfit part entry). Call `assemblePrompt` and use the result for image generation via the config-selected workflow. **Manual test:** generated image reflects the current page's tags combined with character/outfit/location and active slot state.

- [ ] **Queue strategy — image batch queuing:** When entering a chapter, queue images only for **visible** pages (those whose requirements passed during page visibility simulation), page 1 first then remaining in order. Include `clientId: getClientId()` and `requestOrigin: 'anytale-play'` in every enqueue request. Subscribe to `queue:task-started` with ownership gate (`event.clientId === getClientId()`). **Manual test:** open a second tab; verify the second tab does not open SSE task connections for play mode tasks started by the first tab. Images go through the existing ComfyUI queue system. Track queue status per page. **Manual test:** enter a multi-page chapter, verify all images are queued in the correct order in the server queue.

- [ ] **Chapter navigation (forward/back):** Implement prev/next navigation clamped to page count (page 1 to page N). Persist `currentPlotUid` + `pageIndex` in session on every change. Display the generated image for the current page (or loading spinner if not ready). **Manual test:** step through pages, reload, verify resume at same page.

- [ ] **Fade transitions between pages:** When navigating between pages, use a fade out / fade in transition on the portrait image area. Same transition style as the editor's slideshow mode. **Manual test:** navigate forward/back, verify smooth fade between images.

- [ ] **Navigation modes (manual + autoplay):** Manual mode shows `[prev] [▶ play] [next] [show/hide]`. Autoplay mode shows `[⏹ stop]`. In autoplay, auto-advance to the next page when it is loaded (content-readiness pacing, not a fixed timer). If the next page isn't loaded yet, wait until it is. **Manual test:** start autoplay, verify pages advance when ready; stop autoplay, verify manual controls return.

- [ ] **Progress bar live behavior:** Wire the three-layer progress bar to real chapter data. Loading layer (red) = full bar width representing total pages. Loaded layer (gray) = percentage of pages with image ready (voice readiness added in Rollout 5). Current layer (blue) = current page position. Update on every image completion and page navigation. **Manual test:** enter chapter, watch red bar gradually fill with gray as images complete; navigate forward and see blue indicator move.

- [ ] **Generated asset cache:** Store generated image URLs, task IDs, status, and timestamps by stable signature: plot uid + page index + character uid + outfit uid + location part uid + location attribute signature + slot state hash for that page. On page entry, check cache first before generating. Character/outfit/location changes invalidate entries by signature change (no destructive clearing needed). **Manual test:** navigate back to a previously generated page, verify no re-generation; verify that changing session character in a test scenario causes new generation for the same page index.

- [ ] **Chapter and page labels:** Display `Chapter X  Page Y` in the bottom-left area below the progress bar. Chapter number derived from timeline position. **Manual test:** verify labels update on navigation and match expected values.

- [ ] **Show/hide UI wired:** Connect the show/hide toggle button to hide/show all top controls, speech bubble area, and bottom bar. When hidden, only the show button remains visible. **Manual test:** hide UI, verify only show button visible; show UI, verify all controls return.

## Implementation Details

### Queue integration

The queue system reuses the existing server queue (`server/features/queue/`). Play mode enqueues image tasks through the standard generation endpoint, including `clientId: getClientId()` (from `public/js/app-ui/client-id.mjs`) in every request body so the server can associate each task with the submitting tab.

Subscribe to `queue:task-started` via `queueSSEManager`. Every handler **must** check `if (event.clientId !== getClientId()) return;` before subscribing to task progress or updating the asset cache — idle tabs must not open SSE task connections for tasks they didn't submit.

For reconnect-resume: call `queueSSEManager.onConnect(() => fetch('/queue/status').then(...))` on mount so that if the SSE connection drops and reconnects, play mode re-fetches queue status and restores any in-progress generation state. Use `requestOrigin: 'anytale-play'` on all generation requests so the reconnect handler can filter relevant active tasks.

### Autoplay pacing

Autoplay advances on content readiness rather than a fixed timer. The system checks if the next page's image is cached and ready. If ready, advance with a fade transition. If not ready, wait and advance once the SSE completion event fires. In Rollout 5, this check expands to include voice readiness when applicable.

### Asset cache storage

The asset cache lives inside the session `localStorage` object. Each entry is keyed by a composite signature string. Example signature structure:

```
`${plotUid}:${pageIndex}:${characterUid}:${outfitUid}:${locationPartUid}:${locationAttributeHash}:${slotStateHash}`
```

Cache entry shape:
```js
{
  imageUrl: string | null,
  imageTaskId: string | null,
  imageStatus: 'pending' | 'generating' | 'complete' | 'error',
  // dialog and voice fields added in Rollout 5
  generatedAt: number // timestamp
}
```

### Prompt assembly

Reuse `assemblePrompt(enabledParts, activePage)` from `public/js/app-ui/anytale/prompt-assembler.mjs`. The `enabledParts` structure mirrors the editor's shape: an array of part objects with selected `attributeValues`. The `activePage` is the current plot page object containing `tags`, etc.

Build `enabledParts` using the per-page slot state snapshot computed during page visibility simulation: outfit parts whose slot type is `removed` in the slot state are excluded; the `isRevealing` value is taken from the outfit part entry and passed through to the part object.

### Dialog and voice

Dialog and voice are NOT part of this rollout. The progress bar "loaded" state considers only image readiness for now. Speech bubble area remains empty during chapter navigation until Rollout 5 wires dialog generation.
