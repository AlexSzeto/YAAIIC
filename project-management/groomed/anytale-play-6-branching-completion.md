# AnyTale Play Mode — Rollout 6: Branching, Completion & Polish

## Goal

Complete the full play loop by implementing end-of-chapter branching, chapter transitions with loading pages, the epilogue/end screen, cancellation infrastructure, reset functionality, and final polish. After this rollout, a user can experience the complete AnyTale play mode from introduction through multiple chapters to epilogue and end screen, with full reset capability.

## Tasks

- [ ] **End-of-chapter decision page:** When the user reaches the last visible page of a chapter, show a decision page reusing that page's image. Compute the post-chapter slot state by applying all page actions in order (including hidden pages). Find primary candidates: plots matching the current plot's `progressionSections` AND satisfying `slotRequirements` against the post-chapter slot state. If none, fall back to section-match only. If still none, show an error screen. Fourth option: "Let's say goodbye for now" → random epilogue with `slotRequirements` satisfied; fall back to any epilogue if none qualify. **Manual test:** reach end of chapter with fixture plots, verify correct section + slot filtering; verify softlock fallback activates when no slot-compatible plots exist; verify error screen when no progression plots exist at all.

- [ ] **Loading page mechanics:** After the user makes a chapter choice, append a loading page to the timeline and move the user to it. Loading page shows top/bottom controls + giant centered loading spinner (no image). While on the loading page, the user can navigate back to reconsider their choice. Queue all media for the new chapter per the queue strategy. **Manual test:** make choice, verify loading page appears with spinner; navigate back, verify decision page is accessible again.

- [ ] **Chapter transition timeline management:** Once the new chapter is ready (page 1 assets done): auto-fade transition from the loading page into page 1 of the new chapter, then remove the loading page from the timeline to make future navigation seamless. The user can now freely navigate between the previous and new chapters. **Manual test:** wait for chapter to load, verify auto-transition occurs; navigate back to previous chapter, verify seamless timeline with no loading page remnant.

- [ ] **Progress bar chapter switching:** The progress bar shows the current chapter's progress. When navigating back to a completed chapter, the bar shows fully loaded state (all gray + blue position indicator). When entering a new chapter, the bar resets to show the new chapter's loading state. **Manual test:** complete a chapter, enter a new one, navigate back, verify progress bars reflect the correct chapter state.

- [ ] **Timeline persistence:** Append chosen plots to the linear timeline as ordered entries: `{ plotUid, startedAt, pageCount, slotStateAtEntry }`. Persist in the session `localStorage` object. On reload, restore the timeline and slot state and allow navigation across all chapters in the session. **Manual test:** branch through multiple chapters, reload, verify timeline is preserved and cross-chapter navigation works.

- [ ] **Cross-chapter slot state continuity:** The session `slotState` persists across chapter boundaries. When a new chapter is entered, page visibility simulation begins from the carried-over slot state (not reset to initial). Verify the timeline's slot state at each chapter start matches the post-chapter slot state from the previous chapter. **Manual test:** play through two chapters where the first chapter's page actions change slot state; verify the second chapter's prompt assembly and visible pages reflect the updated state.

- [ ] **Epilogue and end screen:** When the epilogue chapter ends, append a final end screen. Reuse image from the final page of the epilogue. Display message "You have reached the end of this tale." in the caption bubble. No explicit "play again" button — the reset button in the top controls serves this purpose. **Manual test:** play through to epilogue end, verify end screen appears with the message and the reset button is functional.

- [ ] **Client cancellation infrastructure:** Build a central session generation controller using `AbortController`, task ID tracking, stale-result guards, and explicit cancel calls. Used by dialog (`/api/chat`), TTS, image jobs, and pre-renders. Late completions must not mutate UI or session state even if backend cancellation is unavailable. **Manual test:** start a slow generation, trigger cancel-all, confirm no late completion mutates UI after cancellation.

- [ ] **Server cancellation endpoints:** Add server-side cancellation support for active ComfyUI workflow tasks using ComfyUI's interrupt/cancel API. Investigate real cancellation for `/api/chat` / Ollama requests — if Ollama cannot be stopped midstream, document that limitation and rely on client-side `AbortController` + stale-result guards for UI correctness. Expose cancel endpoints keyed by task ID where backend cancellation is real. **Manual test:** start a slow ComfyUI generation, cancel it via the endpoint, verify backend work stops; verify documented Ollama limitation if applicable.

- [ ] **Reset UX:** Wire the reset button: show confirmation modal, on confirm: cancel all in-progress generations (dialog, TTS, images, pre-renders) via the cancellation infrastructure, stop `globalAudioPlayer` (voice) and `globalBgmPlayer` (music), perform full cold start reroll (same rules as first visit — random character, outfit, location, music genre, prelude). **Manual test:** mid-chapter, tap reset, confirm dialog, verify audio stops immediately, new session loads, intro appears with fresh random selections.

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

A chapter is "ready" when:
- All page dialogs have completed (or been skipped)
- Page 1 image is generated
- Page 1 voice is generated (if character has a voice sample and is not muted)

### Loading page lifecycle

```
Decision Page → [user picks] → Loading Page (spinner)
                                    ↕ (user can go back)
                              Chapter Ready →  Auto-fade to Page 1
                                              Loading Page removed from timeline
```

The loading page is a transient entry in the timeline array. After auto-transition, it is programmatically spliced out so that navigating backward goes directly from the new chapter's page 1 to the previous chapter's last page.

### Cancellation architecture

```js
// Central controller
const controller = createGenerationController();

// On chapter entry
const chapterSession = controller.createSession(chapterId);
chapterSession.queueImage(pageIndex, taskId);
chapterSession.queueDialog(pageIndex, abortController);
chapterSession.queueVoice(pageIndex, taskId);

// On cancel-all (reset or chapter change)
controller.cancelAll(); // cancels server tasks + aborts fetches + marks all stale

// Stale guard
if (chapterSession.isStale()) return; // discard late completions
```

### Server ComfyUI cancellation

Use the existing ComfyUI API interrupt endpoint. The server cancellation route accepts a task ID, looks up the corresponding ComfyUI prompt ID, and sends the interrupt request.

For Ollama/chat requests: client-side `AbortController.abort()` on the fetch call. If Ollama does not support server-side cancellation, document this as a known limitation. The stale-result guard ensures late responses are discarded regardless.

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
