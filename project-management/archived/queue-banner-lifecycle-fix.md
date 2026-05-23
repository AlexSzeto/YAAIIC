# Queue Banner Lifecycle Fix

## Goal

Fix the queue banner disappearing permanently after the first running task completes. The root cause is a missing `emitUpdated()` call in `_handleTaskCompleted` and a missing re-fetch in `use-queue-status.mjs` on SSE reconnect, meaning clients that miss the transition event never recover the queue state.

## Tasks

- [x] In `server/features/queue/service.mjs` `_handleTaskCompleted`: call `emitUpdated()` immediately after removing the completed item from state and before calling `_runNext()`, so all clients receive an intermediate snapshot showing the completed item removed and the queue still active
- [x] In `public/js/app-ui/use-queue-status.mjs`: re-fetch `/queue/status` when the `queueSSEManager` SSE connection is re-established (on reconnect), so clients that miss a `queue:updated` event recover their view of the queue automatically
- [x] Add a server-side test verifying that a `queue:updated` event is emitted between task completion and next task starting, with correct interim item state (completed item gone, remaining items still present)
- [x] Review and update affected living docs: `.claude/rules/client.md`

## Implementation Details

### Root cause

`_handleTaskCompleted` in `server/features/queue/service.mjs`:
1. Removes the completed item from `_items`
2. Sets `runningTaskId = null`
3. Emits `queue:task-complete` (not `queue:updated`)
4. Calls `_runNext()` — which emits `queue:updated` synchronously before starting the next task

If the SSE connection drops in any window between steps 3 and 4 (or between 4 and the client processing the event), the client misses the transition. `use-queue-status.mjs` only calls `GET /queue/status` on mount, never on reconnect, so the client's stale state (showing an empty queue) is never refreshed.

### Fix 1 — server

Add `this.emitUpdated()` immediately after the completed item is removed, before `_runNext()`:

```js
// _handleTaskCompleted
this._items = this._items.filter(i => i.id !== taskId)
this._runningTaskId = null
this.emitUpdated()   // ← add this
this._runNext()
```

### Fix 2 — client

In `use-queue-status.mjs`, subscribe to SSE reconnect events from `queueSSEManager` and re-fetch on reconnect. The exact reconnect API depends on `queueSSEManager`'s implementation — check `sse-manager.mjs` for the available hook (likely `onConnect` fired on every (re)connect, or a separate `onReconnect`).

### NOTE:

The bug was NOT fixed. Curiously, in a 2 client scenario, the queue updates and dismisses itself correctly in the background, whereas in the client that triggers the generation requests on the main page, the queue falls off after the first generation is complete, so most likely something happening in the progress tracking SSE is causing this issue.

I've attached a log of the SSE for a queued series of 4 generations from the main window (the client initiating these requests). Maybe it would be helpful:

```
[ProgressBanner] subscribing to taskId=task_1779491859796_or3ug05xp
sse-manager.mjs:38 [SSE] subscribe: creating EventSource for task_1779491859796_or3ug05xp
progress-banner.mjs:292 [ProgressBanner] subscribe returned true for taskId=task_1779491859796_or3ug05xp
sse-manager.mjs:59 [SSE] EventSource open for task_1779491859796_or3ug05xp, readyState=1
sse-manager.mjs:68 [SSE] 'complete' listener fired for task_1779491859796_or3ug05xp, inMap=true, readyState=1
sse-manager.mjs:203 [SSE] _dispatch: routing 'complete' to onComplete callback for task_1779491859796_or3ug05xp
progress-banner.mjs:238 [ProgressBanner] handleComplete fired for taskId=task_1779491859796_or3ug05xp
progress-banner.mjs:258 [ProgressBanner] calling onComplete prop for taskId=task_1779491859796_or3ug05xp
sse-manager.mjs:109 [SSE] unsubscribe: task_1779491859796_or3ug05xp (reason: complete-event)
sse-manager.mjs:327 [SSE] _cleanup: removing task_1779491859796_or3ug05xp from map
progress-banner.mjs:285 [ProgressBanner] subscribing to taskId=task_1779491872483_ck2blywq8
sse-manager.mjs:38 [SSE] subscribe: creating EventSource for task_1779491872483_ck2blywq8
progress-banner.mjs:292 [ProgressBanner] subscribe returned true for taskId=task_1779491872483_ck2blywq8
sse-manager.mjs:59 [SSE] EventSource open for task_1779491872483_ck2blywq8, readyState=1
progress-banner.mjs:295 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779491859796_or3ug05xp
sse-manager.mjs:68 [SSE] 'complete' listener fired for task_1779491872483_ck2blywq8, inMap=true, readyState=1
sse-manager.mjs:203 [SSE] _dispatch: routing 'complete' to onComplete callback for task_1779491872483_ck2blywq8
progress-banner.mjs:238 [ProgressBanner] handleComplete fired for taskId=task_1779491872483_ck2blywq8
progress-banner.mjs:258 [ProgressBanner] calling onComplete prop for taskId=task_1779491872483_ck2blywq8
sse-manager.mjs:109 [SSE] unsubscribe: task_1779491872483_ck2blywq8 (reason: complete-event)
sse-manager.mjs:327 [SSE] _cleanup: removing task_1779491872483_ck2blywq8 from map
progress-banner.mjs:285 [ProgressBanner] subscribing to taskId=task_1779491878054_k4kl099jh
sse-manager.mjs:38 [SSE] subscribe: creating EventSource for task_1779491878054_k4kl099jh
progress-banner.mjs:292 [ProgressBanner] subscribe returned true for taskId=task_1779491878054_k4kl099jh
sse-manager.mjs:59 [SSE] EventSource open for task_1779491878054_k4kl099jh, readyState=1
progress-banner.mjs:295 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779491872483_ck2blywq8
sse-manager.mjs:68 [SSE] 'complete' listener fired for task_1779491878054_k4kl099jh, inMap=true, readyState=1
sse-manager.mjs:203 [SSE] _dispatch: routing 'complete' to onComplete callback for task_1779491878054_k4kl099jh
progress-banner.mjs:238 [ProgressBanner] handleComplete fired for taskId=task_1779491878054_k4kl099jh
progress-banner.mjs:258 [ProgressBanner] calling onComplete prop for taskId=task_1779491878054_k4kl099jh
sse-manager.mjs:109 [SSE] unsubscribe: task_1779491878054_k4kl099jh (reason: complete-event)
sse-manager.mjs:327 [SSE] _cleanup: removing task_1779491878054_k4kl099jh from map
progress-banner.mjs:285 [ProgressBanner] subscribing to taskId=task_1779491883687_8grqoanxm
sse-manager.mjs:38 [SSE] subscribe: creating EventSource for task_1779491883687_8grqoanxm
progress-banner.mjs:292 [ProgressBanner] subscribe returned true for taskId=task_1779491883687_8grqoanxm
sse-manager.mjs:59 [SSE] EventSource open for task_1779491883687_8grqoanxm, readyState=1
progress-banner.mjs:295 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779491878054_k4kl099jh
sse-manager.mjs:68 [SSE] 'complete' listener fired for task_1779491883687_8grqoanxm, inMap=true, readyState=1
sse-manager.mjs:203 [SSE] _dispatch: routing 'complete' to onComplete callback for task_1779491883687_8grqoanxm
progress-banner.mjs:238 [ProgressBanner] handleComplete fired for taskId=task_1779491883687_8grqoanxm
progress-banner.mjs:258 [ProgressBanner] calling onComplete prop for taskId=task_1779491883687_8grqoanxm
sse-manager.mjs:109 [SSE] unsubscribe: task_1779491883687_8grqoanxm (reason: complete-event)
sse-manager.mjs:327 [SSE] _cleanup: removing task_1779491883687_8grqoanxm from map
progress-banner.mjs:295 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779491883687_8grqoanxm
```

## Resolution & Permanent Fix

### True Root Cause: Macro-Task Race Condition

After adding extensive trace logs and analyzing the sequence of events across both SSE streams, we uncovered a race condition caused by how Preact's component updates and the progress coalescer interact:

1. **Synchronous Server Transition**: When a task completes, the server-side queue synchronously removes the completed item, starts the next task, and broadcasts `queue:task-started` over `/queue/sse`.
2. **Asynchronous Client Dispatch**: In `sse-manager.mjs` (which handles specific task progress like `/progress/:taskId`), the `complete` listener uses a debounced/coalesced flusher scheduled via `setTimeout(..., 0)`.
3. **The Race Condition**:
   * Because `queue:task-started` is sent synchronously and processed immediately by the main client's persistent listener, the client sets `taskId` to the *new* task ID (e.g., `setTaskId('task_2')`).
   * In the very next event loop tick, the macro-task for the *previous* task's (`task_1`) `complete` event finally executes.
   * The completed task's `onComplete` or `onError` callback was unconditionally calling `setTaskId(null)`.
   * This overwrote the newly set `taskId` back to `null`, completely hiding the active queue banner visually and blocking progress tracking subscriptions for the next task and all subsequent tasks.

### The Fix

Rather than unconditionally setting task IDs to `null` on task terminal states (completion, error, cancellation), all callbacks in the client application now perform a functional check that ensures we only clear the active ID if it actually matches the task that just completed:

```javascript
setTaskId(prev => (!data || !data.taskId || prev === data.taskId) ? null : prev);
```

We applied this robust state-clearing pattern to the following key integration points across all active pages:
1. **Main Generation Page** (`public/js/app.mjs`):
   * `handleGenerationComplete`
   * `handleGenerationError`
   * `handleRegenerateComplete`
   * `handleRegenerateError`
   * `useEffect` reconnect-resume callback
   * `handleSoundEditSaveTask` callback
   * `handleUploadFile` callback
   * Persistent `queueSSEManager.subscribe` on-cancelled callback
2. **AnyTale Scene Generation Page** (`public/js/app-ui/anytale/anytale.mjs`):
   * `handleGenerationComplete`
   * `handleGenerationError`
   * Reconnect-resume callback
   * Persistent subscription on-cancelled callback
3. **AnyTale Character Form** (`public/js/app-ui/anytale/anytale-form.mjs`):
   * Portrait and Voice reconnect-resume callback completion/error/cancelled/dismiss handlers
   * Portrait and Voice persistent subscription completion/error/cancelled/dismiss handlers
4. **Inpaint Page** (`public/js/inpaint.mjs`):
   * `handleGenerationComplete`
   * `handleGenerationError`
   * Reconnect-resume callback
   * Persistent subscription on-cancelled callback

This permanently resolves the queue banner clobbering race condition across every page and component in the V3 app ecosystem.