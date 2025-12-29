# SSE Bug Fixes and Progress Event Logging

## Goals
Fix remaining SSE-related bugs affecting the progress UI and add comprehensive progress event logging for debugging.

## Task 1: Fix Page Title Stuck at Final Progress Message
[x] Clear `taskId` and `regenerateTaskId` state to `null` after generation/regeneration completes

> **Root Cause**: In `app.mjs`, after `handleGenerationComplete` runs, `taskId` is never set to `null`. Since `taskId` is still truthy, the ProgressBanner component remains in the render tree. When the component unmounts via `isVisible: false`, the PageTitleManager's cleanup effect runs, but on re-renders (e.g., from form state changes), a NEW ProgressBanner is instantiated with the same `taskId`, causing it to attempt to re-subscribe to an already-deleted task on the server.

1. In `public/js/app.mjs`, modify `handleGenerationComplete` to call `setTaskId(null)` after processing
2. Modify `handleGenerationError` to call `setTaskId(null)` after processing
3. Modify `handleRegenerateComplete` to ensure `setRegenerateTaskId(null)` is called (already exists but verify timing)
4. Modify `handleRegenerateError` to ensure `setRegenerateTaskId(null)` is called (already exists but verify timing)
5. The conditional render `${taskId ? html\`<ProgressBanner ...>\` : null}` will then correctly unmount the banner completely

## Task 2: Fix Client Constantly Re-subscribing on Key Input
[x] Prevent SSE re-subscription after task completion by clearing taskId

> **Root Cause**: Same as Task 1. Since `taskId` persists after completion, every re-render of the App component (triggered by form input changes) causes React's reconciliation to potentially remount the ProgressBanner. The `key={taskId}` prop forces a new instance if the key changes, but since `taskId` remains constant, it's the same instance being unmounted/remounted due to the parent re-rendering while the banner's internal `isVisible` is false.

Once Task 1 is implemented, this issue should be resolved automatically since `taskId` will be `null` after completion, preventing the ProgressBanner from rendering entirely.

## Task 3: Add Progress Event Logging
[x] Create a logging system for SSE progress events similar to `sent-prompt.json`

> Log all progress events from both ComfyUI websocket and events sent to clients for debugging purposes.

1. In `server/sse.mjs`, create logging utilities:
   - Create `resetProgressLog()` to clear/create `logs/sent-progress.json` with empty array at task start
   - Create `logProgressEvent(eventData, source)` to append events to the log file
   - `source` should indicate origin: `'comfyui-ws'`, `'emit-progress'`, `'emit-complete'`, `'emit-error'`

2. Log format for `sent-progress.json`:
```json
[
  {
    "timestamp": "2025-12-29T10:30:00.000Z",
    "source": "comfyui-ws",
    "type": "progress",
    "promptId": "abc-123",
    "taskId": "task_123_xyz",
    "data": { "node": "5", "value": 10, "max": 20, "percentage": 50 }
  },
  {
    "timestamp": "2025-12-29T10:30:01.000Z",
    "source": "emit-progress",
    "taskId": "task_123_xyz",
    "data": { "percentage": 50, "currentStep": "Sampling image...", "currentValue": 2, "maxValue": 5 }
  }
]
```

3. In `server/comfyui-websocket.mjs`, add logging calls in:
   - `handleProgress()` - log ComfyUI progress events
   - `handleExecuting()` - log node execution events
   - `handleExecutionStart()` - log execution start

4. In `server/sse.mjs`, add logging calls in:
   - `emitProgressUpdate()` - log events being sent to clients
   - `emitTaskCompletion()` - log completion events
   - `emitTaskError()` - log error events

5. In `server/generate.mjs` and `server/server.mjs`:
   - Call `resetProgressLog()` at the start of generation/regeneration tasks (similar to `resetPromptLog()`)

6. Also verify/add reset progress calls to regenerate and inpaint processes.

7. Export `resetProgressLog` from `sse.mjs` and import in `generate.mjs` and `server.mjs`