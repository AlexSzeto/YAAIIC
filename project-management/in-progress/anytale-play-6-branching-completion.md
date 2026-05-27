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
