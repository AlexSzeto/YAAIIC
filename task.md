# Media Generation Queue

## Goal
Replace direct fire-and-forget generation calls with a persistent, server-managed serial task queue. All non-instant generation workloads (ComfyUI, Ollama) are enqueued before executing. The queue persists across server restarts, emits real-time SSE status events, and provides a client-side dashboard for monitoring, reordering, cancelling, and clearing tasks.

## Tasks

### Phase 1 — Outfit Preview Bug Fix
*Standalone fix. App is fully functional after this phase.*

- [ ] Fix outfit part preview in `public/js/app-ui/anytale/outfit-section.mjs` to use `/anytale/generate-part-preview` instead of `/generate/silent/async`, and add cache-busting (`?t=${Date.now()}`) to the resulting image URL on completion — matching the implementation in `anytale-form.mjs`. Remove any props on `OutfitSection` that were only needed for the old generic endpoint (e.g. `partPreviewWorkflow`).

---

### Phase 2 — Queue Infrastructure, Endpoint Migration, and SSE Integration
*After this phase: all generation requests flow through the queue; progress tracking continues to work; queue state is observable via SSE and REST. The app is fully functional — generation works, progress banners appear, and queue state can be inspected via `curl /queue/status` and the browser's DevTools EventSource.*

#### Server — Queue Domain

- [ ] Create `server/features/queue/` with three files:
  - `repository.mjs` — reads/writes `server/database/queue-data.json` (flat JSON array); creates the file with `[]` if absent; exports `loadQueue()`, `saveQueue(items)`
  - `service.mjs` — owns in-memory queue state (`items[]`, `state`); syncs to repository on every mutation; exports `enqueue(record)`, `deleteItem(id)`, `reorder({ id, toIndex })`, `clear()`, `start()`, `pause()`, `skip()`, `getStatus()`, `resume()`, and `setTaskCancelledCallback(fn)` for wiring into the per-task SSE cancellation path
  - `router.mjs` — mounts all `/queue/*` REST endpoints and the `/queue/sse` stream; imports from `service.mjs`

- [ ] Implement the queue SSE stream at `GET /queue/sse` inside `queue/router.mjs`:
  - Separate from `/progress/:taskId`; tracks its own connected clients
  - Exports an `emitQueueEvent(event, payload)` helper used by `service.mjs`
  - Named events: `queue:updated`, `queue:started`, `queue:stopped`, `queue:task-started`, `queue:task-complete`, `queue:task-cancelled`
  - Every state mutation in `service.mjs` calls `emitQueueEvent('queue:updated', getStatus())` after the mutation, plus the specific named event
  - `queue:task-started` payload must include `taskId` (the per-task SSE id assigned by the orchestrator) so clients can bridge from `queueId` to `taskId` for progress tracking

- [ ] Implement queue REST endpoints in `queue/router.mjs`:
  - `GET /queue/status` — returns `{ state, items }` (no side effects)
  - `POST /queue/start` — resumes a paused/stopped queue; starts executing the head item; 409 if already running
  - `POST /queue/pause` — cancels the in-progress task; on cancel-complete the task stays at head and queue state becomes `paused`; 409 if nothing running
  - `POST /queue/skip` — cancels the in-progress task; on cancel-complete the task is removed and the next item starts (or queue stops if empty); 409 if nothing running
  - `DELETE /queue/item/:id` — removes a `queued` or `failed` item immediately; if the item is `running`, behaves like `skip` (removes on cancel-complete, starts next) unless no next item exists (then behaves like `pause` but removes the item); 404 if not found
  - `POST /queue/clear` — cancels the running task (if any), then deletes all items; emits `queue:stopped` with `reason: 'user-paused'`
  - `PATCH /queue/reorder` — body `{ id, toIndex }`; 400 if `toIndex === 0` and queue state is `running | cancelling | skipping | pausing`

- [ ] Mount `queueRouter` in `server/server.mjs` and wire queue resume into the server startup sequence: after `startReadinessPolling` confirms both ComfyUI and Ollama are online, call `queueService.resume()` to begin processing any persisted incomplete items. Support a `--clear-queue` CLI argument that calls `queueService.clear()` silently before `resume()`.

#### Server — Generation Endpoint Migration

- [ ] Refactor `server/features/generation/orchestrator.mjs` to expose an `executeQueuedTask(queueItem)` function that accepts a fully-formed queue record and runs it through the existing pipeline (`initializeGenerationTask` + `processGenerationTask`). The queue service's `_runNext()` calls this; `_runNext()` assigns the `taskId` returned by `initializeGenerationTask` to the queue record and includes it in the `queue:task-started` SSE event.

- [ ] Migrate `POST /generate` (main page / AnyTale story image) to enqueue: extract all form fields (including `seed`) into `taskData`, build a queue record (see schema in Implementation Details), call `queueService.enqueue(record)`, and return `{ queueId }` immediately. The `type` is inferred from the workflow metadata (image/video/audio). The `source` is determined by a `source` field the client sends: `'yaaiic'` (default) or `'anytale'`.

- [ ] Migrate `POST /generate/inpaint` to enqueue with `source: 'yaaiic-inpaint'`, `type: 'image'`.

- [ ] Migrate `POST /regenerate` (field regen / LLM description) to enqueue with `source: 'yaaiic'`, `type: 'text'`, `name` resolved from the target media entry's `name` field at enqueue time.

- [ ] Migrate AnyTale generation endpoints to enqueue:
  - `POST /anytale/generate-part-preview` → `source: 'anytale'`, `type: 'image'`, `subLabel: 'Part Preview'`, `name` from part name (sent in request body)
  - `POST /anytale/characters/:uid/generate-portrait` → `source: 'anytale'`, `type: 'image'`, `subLabel: 'Portrait'`, `name` from character record
  - `POST /anytale/characters/:uid/generate-voice` → `source: 'anytale'`, `type: 'audio'`, `subLabel: 'Voice'`, `name` from character record

- [ ] Route per-task cancellation events upstream to the queue service: when the existing per-task SSE emits `cancelled` for a `taskId` that matches the queue's running item, call the appropriate queue service method based on current queue state — `pausing` → mark task as `queued` again + set state to `paused`; `skipping` or delete-triggered → remove task + call `_runNext()`; emit corresponding `queue:task-cancelled` and `queue:updated` events.

#### Client — Queue SSE Integration

- [ ] Add a `queueSseManager` singleton in `public/js/app-ui/queue-sse-manager.mjs` that opens a persistent `EventSource` to `/queue/sse` on page load and exposes `subscribeQueue(id, callbacks)` / `unsubscribeQueue(id)` with callbacks `{ onUpdated, onStarted, onStopped, onTaskStarted, onTaskComplete, onTaskCancelled }`. Import and initialize it alongside `sseManager` in each page's entry file (e.g. `app.mjs`, `inpaint.mjs`, `anytale.mjs`).

- [ ] Add a `useQueueStatus` hook in `public/js/app-ui/use-queue-status.mjs` that returns `{ state, items }` from the latest `queue:updated` event. On first mount, calls `GET /queue/status` to hydrate before SSE events arrive. Pages use this hook wherever they need live queue data.

- [ ] Update all client-side generate handlers to bridge from `queueId` to `taskId` for per-task progress tracking. Currently each handler receives `{ taskId }` and calls `progressShow(taskId, callbacks)` directly. After migration the endpoint returns `{ queueId }` instead. Each handler must:
  1. Receive `{ queueId }` from the enqueue response
  2. Subscribe to `queueSseManager` for `queue:task-started` events
  3. When a `queue:task-started` event arrives with a matching `queueId`, extract its `taskId` and call `progressShow(taskId, callbacks)` as before; unsubscribe from the queue SSE listener immediately after
  - Affected files: `generation-form.mjs` (main page), `inpaint.mjs`, `anytale.mjs` (story image), `anytale-form.mjs` (part preview), `character-section.mjs` (portrait and voice)
  - The `onComplete` / `onError` / `onCancel` / `onCancelled` callbacks on `progressShow` remain unchanged; only the handshake to obtain `taskId` changes

---

### Phase 3 — Generate Button Queue Awareness
*After this phase: buttons display live queue depth and are automatically disabled when an identical task is already queued or running.*

- [ ] Update all generate buttons that have text labels to display the current total queue count when non-zero, e.g. `"Generate (3)"`. Use `useQueueStatus` to read the count live. Check if `widthScale="normal"` (200px) fits the longest expected label; if not, introduce a new `widthScale` value between `normal` and `wide` in `util.mjs` and `Button`, or switch to `widthScale="wide"` (400px). Update `public/js/custom-ui/test.html` if `Button`'s API changes.

- [ ] Implement duplicate-detection to selectively disable each generate button using the `items` array from `useQueueStatus`:
  - **Main page & inpaint**: the button is disabled if any `queued` or `running` item with the same `endpointKey` has a `taskData` that deep-equals the current form's intended `taskData` (including seed). Seed must be captured from the current form state at comparison time.
  - **AnyTale tasks** (Portrait, Voice, Part Preview): the corresponding action button is disabled if any `queued` or `running` item matches `source === 'anytale'` AND the same `name` AND the same `subLabel`, regardless of `taskData`.

---

### Phase 4 — Queue Dashboard
*After this phase: users can monitor, reorder, pause, skip, and clear the queue from any page via the hamburger menu.*

- [ ] Add a `canDrop(fromIndex, toIndex) => bool` prop to `public/js/custom-ui/layout/dynamic-list.mjs`. When provided, the drag-and-drop handler calls it before committing a drop; if it returns `false`, the drop is cancelled. Also disable the arrange-up button on a row when `canDrop(index, index - 1)` would return `false`. Add a usage example to `public/js/custom-ui/test.html`.

- [ ] Create `public/js/app-ui/queue-dashboard.mjs` as a modal component:
  - **Header**: `"Task Queue"` with a status badge showing current state in parentheses, e.g. `"(running)"`, `"(paused)"`, `"(stopped)"`
  - **Body**: `DynamicList` of active queue items (status `queued`, `running`, or `failed`); each row shows `[type icon] [source label] – [name][ (subLabel)]` and a delete icon button; when queue state is `running | cancelling | skipping | pausing`, pass `canDrop` to pin index 0 (see Implementation Details)
  - **Footer**: `Start` / `Pause` toggle button (icon + text, swaps label/icon based on state), `Clear` button (calls `showDialog` for confirmation before `POST /queue/clear`), and `Close` button
  - Responds live to all `queue:*` SSE events via `queueSseManager`

- [ ] Register `"Task Queue"` in `public/js/app-ui/hamburger-menu.mjs`: add a menu item that toggles a `showQueueDashboard` state flag, and render `<${QueueDashboardModal} open=${showQueueDashboard} onClose=${() => setShowQueueDashboard(false)} />` inside `HamburgerMenu`.

---

## Implementation Details

### Queue Task Record Schema
```json
{
  "id": "uuid-v4",
  "type": "image | video | audio | text",
  "source": "yaaiic | yaaiic-inpaint | anytale",
  "name": "Gentle Forest Scene",
  "subLabel": null,
  "status": "queued | running | failed",
  "endpointKey": "generate | generate-inpaint | regenerate | anytale-part-preview | anytale-portrait | anytale-voice",
  "taskData": {},
  "createdAt": "2026-05-18T00:00:00.000Z"
}
```
- `taskData` contains all fields required to re-execute the task without outside state. For main page and inpaint, this includes the `seed` value. For AnyTale tasks, seed is excluded (user is expected to visually inspect results before re-queuing).
- Completed and permanently cancelled items are removed from `queue-data.json`. Only `queued`, `running`, and `failed` items persist.
- `taskData` is included in `GET /queue/status` responses so the client can perform deep-equality checks for duplicate detection.

### Queue State Machine
| State | Meaning |
|---|---|
| `stopped` | Queue is empty or has never started |
| `paused` | Items are queued but processing is halted |
| `running` | The head item is actively executing |
| `cancelling` | Head item is cancelling; no more items follow |
| `skipping` | Head item is cancelling; more items will follow |
| `pausing` | Head item is cancelling; it will stay at head after cancel (user-pause) |

### Queue SSE Event Payloads
```
queue:updated        → { state, items: QueueTaskRecord[] }
queue:started        → { state: 'running' }
queue:stopped        → { state, reason: 'user-paused' | 'task-failed' | 'service-down' | 'missing-data' }
queue:task-started   → { id, taskId, type, source, name, subLabel }
queue:task-complete  → { id }
queue:task-cancelled → { id }
```
`queue:task-started.id` is the `queueId`; `queue:task-started.taskId` is the per-task SSE id used by `progressShow`. Clients that called `enqueue` and received a `queueId` listen for this event to obtain the `taskId` and begin progress tracking.

### Auto-Label Rules
| Trigger | source | type | name source | subLabel |
|---|---|---|---|---|
| `POST /generate` (main page) | `yaaiic` | from workflow | `name` field in request | null |
| `POST /generate` (anytale story) | `anytale` | `image` | story title | null |
| `POST /generate/inpaint` | `yaaiic-inpaint` | `image` | `name` field in request | null |
| `POST /regenerate` | `yaaiic` | `text` | media entry `name` (resolved server-side) | null |
| `POST /anytale/generate-part-preview` | `anytale` | `image` | part name (in request body) | `Part Preview` |
| `POST /anytale/characters/:uid/generate-portrait` | `anytale` | `image` | character `name` (from DB) | `Portrait` |
| `POST /anytale/characters/:uid/generate-voice` | `anytale` | `audio` | character `name` (from DB) | `Voice` |

The client sends `source: 'anytale'` on story-image generate requests so the server can distinguish them from main-page requests to `POST /generate`.

### Dashboard Source Display Labels
| source field | Display string |
|---|---|
| `yaaiic` | `YAAIIC` |
| `yaaiic-inpaint` | `YAAIIC Inpaint` |
| `anytale` | `AnyTale` |

### Type Icons (material symbols)
| type | icon name |
|---|---|
| `image` | `image` |
| `video` | `movie` |
| `audio` | `music_note` |
| `text` | `article` |

### Server Startup Queue Resume
1. Config loaded, services initialized (existing behavior)
2. `startReadinessPolling` polls until both ComfyUI and Ollama are healthy (existing behavior)
3. On "all services ready" callback: if `--clear-queue` CLI arg is present, call `queueService.clear()` silently; then call `queueService.resume()`
4. `resume()` finds the first item with status `queued` or `running` (interrupted mid-session) and begins executing it; if none, state is `stopped`

### DynamicList `canDrop` Usage in Queue Dashboard
```js
canDrop=${(from, to) => {
  const isActive = ['running', 'cancelling', 'skipping', 'pausing'].includes(state);
  if (isActive && (from === 0 || to === 0)) return false;
  return true;
}}
```
The arrange-up button on the item at index 1 is also disabled when this condition holds.

### Manual Test Instructions

**Phase 1 — Outfit preview fix:**
1. Open AnyTale → Character & Outfits tab → select or create an outfit with at least one part that has attribute values
2. Click the preview (image) button on a part row — confirm the image generates and displays correctly
3. Change an attribute value and click preview again — confirm the image updates (not stale from cache)

**Phase 2 — Queue endpoints:**
```bash
# Check status
curl http://localhost:3000/queue/status

# Submit a generation (enqueues, returns queueId)
curl -X POST http://localhost:3000/generate \
  -F "workflow=<existing_workflow_name>" \
  -F "name=Test Item" \
  -F "prompt=a red cat" \
  -F "source=yaaiic"

# Start the queue
curl -X POST http://localhost:3000/queue/start

# Pause (cancels current, keeps it at head)
curl -X POST http://localhost:3000/queue/pause

# Skip (cancels current, removes it, starts next)
curl -X POST http://localhost:3000/queue/skip

# Delete a specific queued item
curl -X DELETE http://localhost:3000/queue/item/<id>

# Reorder
curl -X PATCH http://localhost:3000/queue/reorder \
  -H "Content-Type: application/json" \
  -d '{"id":"<id>","toIndex":1}'

# Clear all
curl -X POST http://localhost:3000/queue/clear

# Subscribe to queue SSE stream (keep open, watch events fire)
curl -N http://localhost:3000/queue/sse
```

**Phase 2 — Progress tracking bridge:**
1. Submit a generation from the main page — confirm the progress banner still appears and updates as before
2. Let it complete — confirm the result appears in the media list as before
3. Submit a generation from the AnyTale page (portrait or voice) — confirm the progress banner appears and the result is saved

**Phase 2 — Server restart persistence:**
1. Queue 2–3 tasks, let one start generating
2. Kill and restart the server
3. Confirm `queue-data.json` still contains the tasks
4. Once services are ready, confirm the queue resumes automatically (check server logs and `curl /queue/status`)

**Phase 3 — Generate button queue awareness:**
1. Submit 3 generate requests rapidly from the main page without waiting for completion
2. Confirm the button text updates to show the current count after each submission
3. Submit the exact same request again (same prompt, same seed) — confirm the button is disabled
4. Click the dice/cycle-seed button to get a new seed — confirm the button re-enables

**Phase 4 — Queue dashboard:**
1. Queue 3 generation requests from the main page
2. Open hamburger menu → Task Queue — confirm items appear with correct icons, source labels, and names
3. Drag-reorder the 2nd and 3rd items — confirm reordering works
4. Attempt to drag the in-progress item (1st) — confirm it cannot be moved
5. Click Pause — confirm the current task cancels and header shows `(paused)`
6. Click Start — confirm the paused task retries and header shows `(running)`
7. Delete a non-running item — confirm it disappears from the list
8. Click Clear — confirm the confirmation dialog appears; after accepting, confirm all items are gone and header shows `(stopped)`
