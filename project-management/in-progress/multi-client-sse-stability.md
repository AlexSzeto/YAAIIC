# Multi-Client SSE Stability

## Goal

Two browser tabs open to the same section of the site should coexist without breaking each other: no frozen progress banners, no swallowed completion events, no gallery requests timing out, and no unsolicited UI changes appearing in an idle tab.

## Tasks

### Phase 1 — Server: reliable replay + clientId threading
- [x] Remove the buffer-clear in `handleSSEConnection` so the message buffer is replayed to every connecting client and is only discarded at task cleanup (`scheduleTaskCleanup`)
- [x] Accept an optional `clientId` field in queue submission request bodies and store it on the queue item record in `enqueue()`
- [x] Include `clientId` in the `queue:task-started` SSE event payload so clients can determine ownership

### Phase 2 — Client: persistent tab identity
- [x] Create `public/js/app-ui/client-id.mjs` exporting `getClientId()`, which reads from `sessionStorage` and generates + stores a `crypto.randomUUID()` on first call
- [x] Pass `clientId` (from `getClientId()`) in the request body of every queue submission fetch across all callers

### Phase 3 — Client: SSEManager event coalescing
- [x] Add `pendingEvents` (array) and `flushTimer` (timer handle) to each `activeConnections` entry
- [x] Replace the immediate-dispatch path in `_handleMessage` with a `_queueEvent` → `_scheduleFlush` pipeline; implement `_flushEvents` with the terminal-pruning rule and `_dispatch` containing the existing switch logic
- [x] Clear and cancel `flushTimer` in `_cleanup` to prevent flushes firing after unsubscribe

### Phase 4 — Client: ownership-gated task SSE subscriptions
- [x] In all `queue:task-started` handlers, only call `sseManager.subscribe()` when the event's `clientId` matches `getClientId()`
- [x] Fix the stale-event race in `useQueueTaskId`: after subscribing to `queue:task-started`, immediately fetch `/queue/status` and resolve the promise if the target item already has a `taskId` (i.e. it started running before the hook subscribed)

### Phase 5 — Client: ProgressBanner fast-complete bypass
- [x] In `handleComplete`, if `state.status` is still `'starting'` (no prior `progress` event was received), call `onComplete` and `onDismiss` immediately without the 2-second wait and without updating banner state — the task was already done when the banner mounted

### Phase 6 — Verification and docs
- [x] Verify the two-tab scenario end-to-end: queue a generation in Tab A, confirm Tab B shows no progress banner and no unsolicited gallery refresh; confirm Tab A receives completion normally
- [x] Verify the refresh scenario: queue a generation in Tab A, refresh Tab A mid-generation, confirm Tab A reconnects and receives the completion event
- [x] Review and update affected living docs: `docs/server.md` (SSE buffer behaviour change), `.claude/rules/client.md` (clientId pattern, coalescing pattern)

#### Fixes and Changes
- [ ] Add PM2-based remote restart: run server under PM2, expose `POST /admin/restart` endpoint that flushes a response then calls `process.exit(0)` so PM2 auto-restarts the process

## Implementation Details

### Why two tabs break today

**Buffer cleared on first reader.** `handleSSEConnection` in `sse.mjs` replays buffered messages to the first client that connects, then sets `task.messageBuffer = []`. Any subsequent client connects to silence — the server sends an initial `progress(0%, 'Starting...')` state and nothing more. The second tab freezes.

**Browser HTTP/1.1 connection limit.** Browsers allow 6 concurrent connections per origin. Two tabs × 2 SSE connections (queue + task) = 4 slots consumed. Gallery queries and other REST calls compete for the remaining 2, causing delays and apparent timeouts.

**Duplicate side effects.** Both tabs receive every `queue:task-started` and `queue:task-complete` broadcast. Without ownership filtering, both subscribe to the same task SSE and both fire `onComplete` callbacks (gallery refreshes, state updates), causing duplicate work and potential UI stomping.

### Server: buffer change

Remove `task.messageBuffer = []` from the post-replay block in `handleSSEConnection`. The buffer already lives on the task object and is garbage-collected when `scheduleTaskCleanup` deletes the task after 5 minutes. No other change needed.

### Server: clientId threading

`enqueue()` in `queue/service.mjs` spreads the incoming record onto the item object. Adding `clientId` to the request body and including it in the record is enough — it will appear on the item in every `queue:updated` payload automatically. The `queue:task-started` emit in `_runNext()` must explicitly forward it:

```js
emit('queue:task-started', {
  id: next.id,
  taskId,
  clientId: next.clientId || null,  // add this
  // ... rest of fields
});
```

### Client: persistent tab identity (`client-id.mjs`)

```js
const KEY = 'clientId';

export function getClientId() {
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}
```

`sessionStorage` is isolated per tab and survives page refreshes within that tab. Opening a new tab gives it a fresh empty `sessionStorage` and therefore a new UUID. The one known edge case is browser "duplicate tab" (right-click → Duplicate), which copies `sessionStorage` to the new tab; both tabs would share a `clientId` and subscribe to each other's tasks. This is an acceptable edge case — it degrades to today's behaviour for just that pair, not all open tabs.

### Client: SSEManager event coalescing

**Why `setTimeout(0)` works for batching.** The browser queues each SSE message as a separate macro-task. When a TCP packet carries multiple SSE frames, they are enqueued consecutively. `setTimeout(0)` appends a new task at the end of the current queue, so all frames from that packet are processed (pushed to `pendingEvents`) before the flush fires.

For live streaming, events arrive seconds apart. The flush timer fires between arrivals, so each live event gets its own flush with exactly one entry — no batching occurs and no latency is added beyond the browser's ~4ms minimum timer resolution, which is imperceptible on a progress bar.

**The pruning rule.** When `_flushEvents` runs:

1. Find the last terminal event in `pendingEvents` (`complete`, `error`, or `cancelled`), if any.
2. **Terminal present:** discard all `progress` events. Dispatch the terminal only. (Optionally dispatch the single last `progress` immediately before the terminal as a final-state snapshot — not required.)
3. **No terminal:** discard all `progress` events except the last. Dispatch that one.

Result: a fully-replayed completed task triggers at most one `onComplete` call. Intermediate progress states are never surfaced.

**Connection entry shape after change:**

```js
{
  eventSource,
  callbacks,
  timeoutTimer,
  timeoutMs,
  pendingEvents: [],  // events queued within current flush window
  flushTimer: null    // handle to the scheduled setTimeout(0)
}
```

**Call chain:**

```
_handleMessage  →  _queueEvent  →  _scheduleFlush
                                         ↓  (next macro-task)
                                    _flushEvents  →  _dispatch  (0–2 calls)
```

`_dispatch` contains the existing `switch` logic: parse `event.data`, route to the appropriate callback, call `unsubscribe(taskId, reason)` on terminal types.

`_cleanup` must cancel `flushTimer` and clear `pendingEvents` to prevent a scheduled flush from firing after the connection has been removed.

### Client: ownership-gated subscriptions

`queue:task-started` is received by every tab on the shared queue SSE. The owning tab is the one whose `clientId` matches the event's `clientId`. Only that tab should call `sseManager.subscribe(taskId, ...)`.

Idle tabs still receive `queue:task-started` and can use it for display purposes (e.g. showing which item is running in the queue dashboard) — they just must not open a task SSE connection for it.

### Client: `useQueueTaskId` stale-event fix

```js
export function useQueueTaskId() {
  return (queueId) => new Promise((resolve) => {
    const unsubscribe = queueSSEManager.subscribe({
      'queue:task-started': ({ id, taskId }) => {
        if (id === queueId) { unsubscribe(); resolve(taskId); }
      },
    });
    // Race: item may have already started before this hook subscribed
    fetch('/queue/status')
      .then(r => r.json())
      .then(({ items }) => {
        const item = items.find(i => i.id === queueId && i.taskId);
        if (item) { unsubscribe(); resolve(item.taskId); }
      })
      .catch(() => {});
  });
}
```

### Client: ProgressBanner fast-complete bypass

When `handleComplete` fires and `state.status` is still `'starting'`, the banner never received a `progress` event — meaning the task was already done when the subscription was opened (replay delivered only the terminal event). In this case:

- Do **not** call `setState` (no banner flash)
- Call `onCompleteRef.current(data)` immediately
- Call `onDismissRef.current()` immediately (no 2-second wait)

This prevents a "Starting generation... → Complete!" flicker for tasks that were already finished.
