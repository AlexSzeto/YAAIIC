# AnyTale Play Mode — Rollout 6: Branching, Completion & Polish

## Goal

Complete the full play loop by implementing end-of-chapter branching, chapter transitions with loading pages, the epilogue/end screen, cancellation infrastructure, reset functionality, and final polish. After this rollout, a user can experience the complete AnyTale play mode from introduction through multiple chapters to epilogue and end screen, with full reset capability.

## Tasks

- [x] **End-of-chapter decision page:** When the user reaches the last visible page of a chapter, show a decision page reusing that page's image. Compute the post-chapter slot state by applying all page actions in order (including hidden pages). Find primary candidates: plots matching the current plot's `progressionSections` AND satisfying `slotRequirements` against the post-chapter slot state. If none, fall back to section-match only. If still none, show an error screen. Fourth option: "Let's say goodbye for now" → random epilogue with `slotRequirements` satisfied; fall back to any epilogue if none qualify. **Manual test:** reach end of chapter with fixture plots, verify correct section + slot filtering; verify softlock fallback activates when no slot-compatible plots exist; verify error screen when no progression plots exist at all.

- [x] **Loading page mechanics:** After the user makes a chapter choice, the timeline immediately advances to the first page of the next chapter. If the page is not yet loaded, the standard loading state (spinner, preserved background) is shown; play controls disappear until the page is fully ready. Navigating back from the new chapter's first page returns to the previous chapter's last page. **Manual test:** make choice, verify loading state shows; navigate back, verify previous chapter's last page is accessible.

- [x] **Chapter transition timeline management:** Once the new chapter is ready (image, dialog, voice all complete), the page auto-transitions to the ready state. The user can freely navigate between all chapters in the timeline. **Manual test:** wait for chapter to load, verify display transitions; navigate back to previous chapter, verify seamless timeline.

- [x] **Progress bar chapter switching:** The progress bar shows the current chapter's progress. When navigating back to a completed chapter, the bar shows fully loaded state. When entering a new chapter, the bar resets to show the new chapter's loading state. Chapter number shown is `timelineIndex + 1`. **Manual test:** complete a chapter, enter a new one, navigate back, verify progress bars reflect the correct chapter state.

- [x] **Timeline persistence:** Append chosen plots to the linear timeline as ordered entries: `{ plotUid, pageCount, slotStateAtEntry }`. Persist in the session `localStorage` object. On reload, restore the timeline and slot state and allow navigation across all chapters in the session. **Manual test:** branch through multiple chapters, reload, verify timeline is preserved and cross-chapter navigation works.

- [x] **Cross-chapter slot state continuity:** The session `slotState` persists across chapter boundaries. When a new chapter is entered, page visibility simulation begins from the carried-over slot state (not reset to initial). `computeVisiblePages` accepts an optional `initialStatuses` parameter; `initChapter` reads `slotStateAtEntry` from the current timeline entry. **Manual test:** play through two chapters where the first chapter's page actions change slot state; verify the second chapter's prompt assembly and visible pages reflect the updated state.

- [x] **Epilogue and end screen:** When the last page of an epilogue-section chapter becomes ready, auto-transition to `phase: 'end'` after a 2-second delay. Generate an image from the 'end' section plot. Display "You have reached the end of this tale." in the caption bubble. No explicit "play again" button — the reset button in the top controls serves this purpose. **Manual test:** play through to epilogue end, verify end screen appears with the message and the reset button is functional.

- [x] **Client cancellation infrastructure:** `chapterStaleRef` (incrementing integer) is incremented at the start of each `initChapter` call; all SSE completion callbacks capture the stale ID and discard results if the ID no longer matches. `dialogAbortControllerRef` holds an `AbortController` that is replaced and the previous one aborted on each `initChapter` call, aborting in-flight `/api/chat` requests. AbortError in dialog generation is treated as skipped (non-blocking). **Manual test:** start a slow generation, trigger cancel-all (reset), confirm no late completion mutates UI after cancellation.

- [x] **Server cancellation endpoints:** Existing infrastructure used: `POST /generate/cancel` (by task ID, triggers ComfyUI interrupt) and `DELETE /queue/items/source/anytale-play` (bulk cancel all play-mode items). No new server endpoints needed. Ollama chat cancellation relies on client-side `AbortController` + stale-result guards; backend Ollama cancellation is not available (known limitation). **Manual test:** start a slow ComfyUI generation, cancel it via the endpoint, verify backend work stops.

- [x] **Reset UX:** `handleReset` shows a confirmation modal ("Start over?") via `showModal`. On confirm, `doReset()` aborts dialog generation, cancels the play queue, stops both audio players, clears all caches, clears the session, and performs a full cold-start reload. **Manual test:** mid-chapter, tap reset, confirm dialog, verify audio stops immediately, new session loads, intro appears with fresh random selections.

- [ ] **Polish and regression:** Confirm editor `localStorage` keys (`anytale-state`, `anytale-plot`, `anytale-character`) are unchanged after play mode usage. Test mobile viewport layout for all UI states (intro, chapter navigation, decision points, loading, end screen). Fix any broken global navigation. Run full scripted walk: cold start → intro → character change → mood changes → begin tale → chapter navigation → autoplay → end-of-chapter branch → new chapter → epilogue → end screen → reset → verify clean restart. **Manual test:** complete the full scripted walk without errors on both desktop and mobile viewports.

#### Bug fixes round 2

- [ ] **Cold start always shows placeholder background:** The audio-unlock screen must always show `media/anytale-background.png`, regardless of whether a session is in progress. Currently, if returning to a tale in progress, the character's `introImageUrl` is displayed. Fix by unconditionally setting `backgroundUrl='media/anytale-background.png'` on the unlock screen.

- [ ] **Intro-to-chapter transition uses intro image:** When transitioning from the introduction phase to the first chapter, the background should carry over from the intro (i.e., `session.introImageUrl`), not snap to `media/anytale-background.png`. Ensure the `displayedImageUrl` is seeded with `session.introImageUrl` (or the last intro image) rather than the placeholder at the moment `initChapter` starts.

- [ ] **Epilogue chapter requires explicit next to trigger end screen:** Remove the auto-advance from the last content page of the last chapter to `phase: 'end'`. Instead treat the ending/epilogue as its own chapter entry: the user must click Next (or autoplay must finish the page timer) to advance past it. The transition to `phase: 'end'` fires only when the user (or autoplay) navigates forward from the last visible page of the epilogue chapter.

- [ ] **Fix crossfade glitch on rapid image changes:** When a new `backgroundUrl` arrives while a crossfade is still in progress (pendingUrl is already set and `crossfading` is true), the current logic queues a new pending image but the in-flight `setTimeout` still completes with the old pending URL, leaving state inconsistent. Fix by: (1) storing a cancellation ref for the crossfade timeout so the old timer is always cancelled when a new image arrives mid-transition; (2) when a new URL arrives during an active crossfade, abort the current transition, immediately commit the current pending image as `shownUrl`, then start a fresh crossfade to the new URL. This prevents the break-and-flicker on rapid navigation.

- [ ] **Show disabled play button on last content page:** On the last content page (one before the decision page), render a disabled play button in the button bar so button positions remain stable. Currently the play button disappears, shifting all other buttons left and causing layout jank. Pass a falsy `onPlay` but always render the play button slot; use `disabled` state when `onPlay` is absent rather than omitting the element.

- [ ] **Next button enabled on completed chapter decision page:** When browsing an already-completed chapter (a successor already exists in the timeline), the decision page is locked (no choice buttons), but `canGoNext` is currently evaluated in a way that leaves it `false` for non-autoplay navigation. Fix so that `canGoNext` is `true` when `isAtDecisionPage && isChapterCompleted`, allowing the user to advance to the next chapter manually via the Next button.

- [ ] **End screen image uses background tags only:** `generateEndScreenImage` currently assembles a prompt from the 'end' section plot's page content and enabled parts. Replace this with a background-only prompt: use only the active background part (the location part currently in the session), including its preview base tags and any tags that the slot rules associate with that background. Do not include character, outfit, or other slot-driven parts in the end screen prompt.

- [x] **Fix media generation order — sequential per-page image→TTS submission:** Despite earlier attempts, the actual server queue order is still `[img0, img1, img2, …, tts0, tts1, tts2, …]` instead of the required `[img0, tts0, img1, tts1, …]`. Root cause 1 (server): `POST /anytale/play/generate-speech` does `await readFile + await uploadFileToComfyUI` before calling `enqueue`; image requests have no pre-enqueue async work, so all images are enqueued while TTS requests are still uploading. Fix by adding a module-level voice-upload cache (`Map<voiceSampleUrl, filename>`) with pending-Promise deduplication so that the first TTS request for a given voice URL uploads and caches, while any concurrent requests for the same URL await the same Promise. Root cause 2 (client): phase 3 of `initChapter` fires all submissions fire-and-forget. Fix by making `queuePageImage` and `queuePageSpeech` return their `fetchJson` Promises, then in phase 3 doing `await Promise.all([imagePromise, ttsPromise])` per page (with stale check after each await) before advancing to the next page. Together these two changes guarantee server queue order `[img0, tts0, img1, tts1, …]`.

#### Fixes and Changes

- [x] **Separate last content page from decision page:** The last content page shows dialog/image/TTS as normal. A virtual decision page (`pageIndex === visiblePageIndices.length`) follows it; its background is the last content page's image URL (not `displayedImageUrl`), its caption is the hardcoded string `"What's your next move?"`, and its options use `plot.description || plot.name` (not name). `goToNext` allows advancing to `visiblePageIndices.length`; canGoNext gates on last content page readiness and blocks epilogue chapters from advancing past last content page (epilogue auto-transitions to end). Guard voice/image advance effect against the decision page index.

- [x] **Autoplay persists across chapters:** Remove `setIsAutoplay(false)` from the autoplay effect's terminal branch (when `nextVisIdx >= visiblePageIndices.length`). Just `return` to pause; the flag remains true so autoplay resumes when the next chapter loads.

- [x] **End screen uses evolved slot state:** `generateEndScreenImage` currently calls `resolveSlotStatuses(activeParts, [], 0)` which resets to the initial slot state, ignoring all story slot actions. Fix by: (1) adding `pageSlotStatusesRef` to mirror the `pageSlotStatuses` state as a stable ref; (2) rewriting `generateEndScreenImage(endPlot, sess, data, initialSlotStatuses = null)` to call `computeVisiblePages(activeParts, endPlot, slotRules, initialSlotStatuses)` and `buildEnabledPartsForPage` with the resulting per-page slot statuses; (3) in the `phase: 'end'` useEffect, read the final evolved state from `pageSlotStatusesRef.current[currentPlotRef.current.pages.length - 1]` and pass it as `initialSlotStatuses`.

- [x] **Autoplay advances to decision page:** When `isAutoplay` is true and the player reaches the final content page, autoplay should continue: after the page has displayed for its full duration (same timer/voice logic as normal page advance), advance `pageIndex` to `visiblePageIndices.length` to show the decision page.

- [x] **Completed chapter decisions are locked:** Once the user has picked a next chapter (i.e., a timeline entry exists beyond the current chapter), navigating back to that chapter's decision page must not show decision buttons. Instead show the decision page UI in a non-interactive state (no decision buttons, no `onBack` that would let them branch again). The chapter progression is finalised for this session.

- [x] **Autoplay transitions between completed chapters:** When autopaying through a chapter that already has a successor in the timeline (i.e., `timelineIndex + 1 < timeline.length`), on reaching the last content page autoplay should automatically advance to the first page of the next chapter in the timeline (same cross-chapter navigation logic as `goToNext` / `goToPrev`), rather than pausing at the decision page.

- [x] **Show chapter name in header instead of "Chapter X":** Replace the chapter number label (e.g., "Chapter 3") with the current chapter's plot name (e.g., `currentPlot.name`). The page label format becomes `"[chapter name], Page Y"`.

- [x] **Chapter decision options show plot description:** `computeChapterDecisions` uses `plot.description || plot.name`, but `playData.plots` are summary objects that may not include the `description` field. Verify whether `description` is returned in the plots list from the server; if not, either (a) include it in the server response for the plots list, or (b) fetch full plot objects before building the decisions array. Options should display the plot's description text, not its name.

- [x] **Reorder bottom action buttons and show/hide UI:** New bottom bar order (left to right): Hide UI, Autoplay, Prev, Next. The "Show UI" button (the one that re-appears the UI when hidden) moves to the left edge so it aligns with the Hide UI position. During autoplay, replace Autoplay with Stop, and show Hide UI to the left of Stop so Stop aligns with the Autoplay position.

- [x] **Persistent back-to-home button:** Add a persistent icon button (e.g., ✕ or a home icon) fixed to the top-right corner of the play page that navigates back to the root page (`/` or the app's home route). Always visible in all phases.

- [x] **Hide play button on intro home screen:** The play/autoplay button is non-functional on the first screen of the introduction phase (`phase: 'intro-main'`). Do not render it there.

- [x] **"I'm feeling lucky!" option in all intro change screens:** The character-pick, outfit-pick, location-pick, and music-pick phases each have a randomised selection option. Add a fourth option labelled "I'm feeling lucky!" that picks a completely random item from the **full library** (all characters / outfits / location parts / genres, not just the current draft of 3). This is in addition to the existing "Maybe someone else?" / "Nevermind" options, not a replacement.

- [x] **Placeholder background during reset and initial load:** (a) When a reset is confirmed and the session is being cleared, immediately replace the background image with `media/anytale-background.png` so there is no blank/black frame between the old story image and the new intro loading state. (b) On initial page load, before the user has clicked through the audio-unlock screen, use `media/anytale-background.png` as the background if no `introImageUrl` is stored in the session yet.

## Implementation Details

### Media library exclusion (mandatory)

All ComfyUI generation tasks initiated by play mode **must not** appear in the media library. Any image or audio generation added in this rollout must use an endpointKey prefixed `anytale-play-` and that key must be added to the `silent` list in `server/features/generation/orchestrator.mjs` in the same task. Do not ship a generation endpoint without verifying it is in the silent list.

### Decision page layout

The decision page uses the decision point layout defined in the parent spec:
- Top controls (same as normal page — reset, mute, music)
- Caption bubble for the decision hint text (no speech triangle)
- Decision option buttons for the chapter choices (glass panel style, rounded rect, optional images)
- Single back button at the bottom that returns to the most recent page on the timeline

### Chapter readiness

A page is "ready" when:
- Its image is generated (status: 'complete')
- Its dialog has completed or been skipped
- Its voice has completed, been skipped, or is not applicable (no voice sample / muted)

### Simplified navigation model

Per implementation decisions, there is no "loading page" sentinel in the timeline. Instead:
- After a chapter choice, the new chapter is appended to the timeline and `timelineIndex` advances
- Any page that is not fully loaded shows the standard loading state (spinner + preserved background image)
- Play controls disappear during loading
- Cross-chapter prev navigation: at `pageIndex=0`, going back decrements `timelineIndex` and sets `pageIndex` to `pageCount-1` of the previous chapter

### Cancellation architecture

- `chapterStaleRef` — integer ref incremented at the start of each `initChapter`; callbacks capture their stale ID and check before mutating UI state
- `dialogAbortControllerRef` — holds the current `AbortController` for dialog generation; previous one is aborted on chapter change
- Server-side: reuses existing `DELETE /queue/items/source/anytale-play` bulk cancel

### Session model additions

```js
// Added to DEFAULT_SESSION in play-session.mjs:
timeline: [],        // TimelineEntry[]
timelineIndex: 0,    // current chapter index in timeline
endImageUrl: null,   // image for the 'end' phase screen

// TimelineEntry shape:
{ plotUid, pageCount, slotStateAtEntry }  // slotStateAtEntry: { [slotType]: string }
```

### Server ComfyUI cancellation

Existing `POST /generate/cancel` endpoint triggers `interruptGeneration()`. For Ollama/chat requests, client-side `AbortController.abort()` is used; Ollama does not support server-side cancellation (known limitation).

### Full regression test script

The scripted walk covers every major feature across all 6 rollouts:
1. Cold start → verify intro with generated image
2. Change character → verify image regenerates
3. Open mood page → change outfit, background, music
4. "Begin the tale" → verify chapter loads
5. Navigate pages → verify images + dialog + voice
6. Start autoplay → verify auto-advance
7. Reach end of chapter → verify decision page
8. Pick next chapter → verify loading → transition
9. Navigate back to previous chapter → verify seamless
10. Reach epilogue → verify end screen
11. Reset → verify clean restart to intro
