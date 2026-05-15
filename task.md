# Generation Progress Tracking & Cancellation

## Goal
Add SSE progress visibility and cancellation support to all generation types. Introduce a new async-silent generation endpoint for headless callers (Anytale), migrate Anytale away from blocking sync generation, and add a cancel action to the progress banner that interrupts the active ComfyUI job.

## Tasks

### Server

- [x] Rename `POST /generate/sync` to `POST /generate/silent/sync` in `server/features/generation/router.mjs`
- [x] Add `interruptGeneration()` to `server/features/generation/comfy-client.mjs` that calls `POST /interrupt` on the ComfyUI API
- [x] Add cancellation support to `server/core/sse.mjs`: add a `cancelled` boolean field to the task object, add `cancelTask(taskId)` that sets the flag, and add `emitTaskCancelled(taskId)` that broadcasts `event: cancelled` to all SSE clients for that task
- [x] Add cancellation check points in `server/features/generation/orchestrator.mjs` `processGenerationTask`: after each major await (pre-gen tasks, ComfyUI run, post-gen tasks), check `getTask(taskId)?.cancelled` and throw a `CancellationError` if set
- [x] Add `POST /generate/cancel` endpoint to `server/features/generation/router.mjs`: validates `taskId`, calls `cancelTask(taskId)` + `interruptGeneration()`, responds 202 immediately; `emitTaskCancelled` is called once the orchestrator's cancellation error propagates
- [x] Add `POST /generate/silent/async` endpoint to `server/features/generation/router.mjs`: identical validation logic to `/generate/silent/sync` but returns `{ taskId }` immediately (like `/generate`) and runs `processGenerationTask` with `silent=true` in the background

### Client

- [x] Add `onCancelled` callback support to the SSE subscription in `public/js/custom-ui/msg/progress-context.mjs` (listen for `event: cancelled` events alongside existing `complete` and `error`)
- [x] Update `ProgressBanner` in `public/js/custom-ui/msg/progress-banner.mjs`: add `onCancel` prop; during `starting`/`in-progress` states replace the X icon button with a trash icon button; on click call `onCancel(taskId)`, disable button and set message to "Cancelling…"; on `cancelled` SSE event dismiss the banner and show a toast "Generation cancelled"
- [x] Migrate `public/js/app-ui/anytale/anytale-form.mjs` from `/generate/sync` to `/generate/silent/async`: receive `taskId`, subscribe to SSE progress, show `ProgressBanner` with `onCancel` wired to `POST /generate/cancel`, handle `onComplete` to continue the existing post-generation logic
- [x] Migrate `public/js/app-ui/anytale/character-section.mjs` from `/generate/sync` to `/generate/silent/async` following the same pattern as `anytale-form.mjs`
- [x] Migrate `public/js/app-ui/anytale/outfit-section.mjs` from `/generate/sync` to `/generate/silent/async` following the same pattern as `anytale-form.mjs`

## Implementation Details

### Endpoint summary

| Old | New |
|-----|-----|
| `POST /generate/sync` | `POST /generate/silent/sync` (renamed) |
| _(new)_ | `POST /generate/silent/async` — returns `{ taskId }`, runs pipeline with `silent=true`, emits SSE |
| _(new)_ | `POST /generate/cancel` — body `{ taskId }`, 202 response |

### `POST /generate/cancel` flow
1. Validate `taskId` exists in SSE task map; return 404 if not found.
2. Call `cancelTask(taskId)` (sets `task.cancelled = true`).
3. Call `interruptGeneration()` on `comfy-client.mjs` (`POST /interrupt` on ComfyUI).
4. Respond `202 Accepted` immediately — the `cancelled` SSE event is emitted by the orchestrator once it detects the flag.
5. Note: if an Ollama LLM post-gen task is running, the orchestrator will emit `cancelled` only after that awaited call resolves (Ollama cannot be mid-stream interrupted).

### `interruptGeneration()` in `comfy-client.mjs`
```js
export async function interruptGeneration() {
  if (!comfyUIAPIPath) return;
  await fetch(`${comfyUIAPIPath}/interrupt`, { method: 'POST' });
}
```

### Cancellation check in `orchestrator.mjs`
After each major `await` in `processGenerationTask`, insert:
```js
if (getTask(taskId)?.cancelled) {
  emitTaskCancelled(taskId);
  setTimeout(() => deleteTask(taskId), 5000);
  return;
}
```

### `emitTaskCancelled(taskId)` in `sse.mjs`
Broadcasts `event: cancelled\ndata: {...}\n\n` with payload:
```json
{ "taskId": "...", "status": "cancelled", "message": "Generation cancelled", "timestamp": "..." }
```

### `ProgressBanner` cancel UX states
| Banner state | Button shown | Button behaviour |
|---|---|---|
| `starting` / `in-progress` | Trash icon (enabled) | Calls `onCancel(taskId)`, then → |
| `cancelling` (local state) | Trash icon (disabled) | — |
| `completed` / `error` | X icon | Dismiss |

On `cancelled` SSE event: call `onDismiss()` then `showToast('Generation cancelled')`.

### Anytale migration pattern
Each of the three Anytale generation sites currently does:
```js
const response = await fetch('/generate/sync', { method: 'POST', body: JSON.stringify({...}) });
const result = await response.json();
// use result
```
After migration:
```js
const { taskId } = await fetch('/generate/silent/async', { method: 'POST', ... }).then(r => r.json());
progress.show(taskId, {
  onComplete: (data) => { /* existing post-gen logic using data.result */ },
  onCancelled: () => showToast('Generation cancelled'),
  onCancel: async () => { await fetch('/generate/cancel', { method: 'POST', body: JSON.stringify({ taskId }) }); }
});
```

### Manual testing

**Async silent endpoint:**
```sh
curl -X POST http://localhost:3000/generate/silent/async \
  -H "Content-Type: application/json" \
  -d '{"workflow":"Text to Image","prompt":"a cat"}'
# Expect: { "taskId": "...", "success": true }
# Then subscribe to SSE: GET /events?taskId=<taskId>
```

**Cancel endpoint:**
```sh
# 1. Start a generation and note taskId
curl -X POST http://localhost:3000/generate -H "Content-Type: application/json" -d '{"workflow":"Text to Image","prompt":"a cat"}'
# 2. Cancel it
curl -X POST http://localhost:3000/generate/cancel \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<taskId>"}'
# Expect: 202 and subsequent `event: cancelled` on the SSE stream
```

**UI cancellation (Anytale):**
1. Open Anytale, trigger any generation (parts preview, portrait, voice, or image preview)
2. Verify the progress banner appears with a trash icon
3. Click the trash icon — confirm it becomes disabled and message changes to "Cancelling…"
4. Confirm the banner dismisses and a toast "Generation cancelled" appears
5. Confirm ComfyUI stops processing (check ComfyUI UI or logs)

