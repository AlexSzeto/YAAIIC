# SSE Completion Event UID Routing & Reconnect Resume

## Goal

Fix stale SSE completion events incorrectly updating the wrong character's UI, add UID-aware event routing so each completion result is applied to the correct entity, implement reconnect-resume for in-progress tasks, and cancel in-flight generation when the user switches characters.

## Tasks

### Server

- [ ] Store `characterUid` and `entityType` in the task registry when portrait or voice generation is initiated in `server/features/anytale/router.mjs`
- [ ] Include `characterUid` from the task registry in the SSE completion event's `result` payload inside `server/core/sse.mjs`
- [ ] Export a `getActiveTasks()` function from `server/core/sse.mjs` that returns only in-progress tasks (excluding completed, cancelled, and errored tasks)
- [ ] Add a `GET /generation/tasks/active` endpoint that returns the active task list

### Client — SSE Manager

- [ ] Add a `fetchActiveTasks()` method to `SSEManager` in `public/js/app-ui/sse-manager.mjs` that calls `GET /generation/tasks/active` and caches the result
- [ ] Add a `getActiveTasks(entityType)` method to `SSEManager` that filters the cached result by `entityType`

### Client — Task State & Progress Banner

- [ ] Lift `portraitTaskId` and `voiceTaskId` state from `character-section.mjs` up to `anytale-form.mjs`, passing them down as props and exposing setter callbacks; `character-section.mjs` calls the callbacks when initiating generation
- [ ] Move `ProgressBanner` rendering for portrait and voice generation from `character-section.mjs` to `anytale-form.mjs` so the banner persists when the user switches characters

### Client — Cancel on Character Switch

- [ ] In `anytale-form.mjs`, when the user selects a different character, send `POST /generate/cancel` for any active `portraitTaskId` or `voiceTaskId` before updating the selected character state

### Client — UID Mismatch Handling

- [ ] In the portrait `onComplete` callback (now in `anytale-form.mjs`): if `data.result.uid` matches the currently displayed character's `uid`, update the UI normally; if it does not match and the `uid` is a real saved character UID (not `'temp-portrait'`), silently re-fetch that character's data from the server to sync its `portraitUrl` in background state; if the `uid` is `'temp-portrait'`, discard the result entirely
- [ ] Apply the same three-way mismatch logic to the voice `onComplete` callback for `audioUrl` and `introTranscript` (discard when `uid` is `'temp-voice'`)

### Client — Reconnect Resume

- [ ] On mount of `anytale-form.mjs`, call `sseManager.fetchActiveTasks()` and for any returned task with `entityType` of `'anytale-portrait'` or `'anytale-voice'`, restore the corresponding `portraitTaskId`/`voiceTaskId` state so the `ProgressBanner` resumes displaying progress

## Implementation Details

### Why this feature exists

When a user starts voice or portrait generation for Character A then loads Character B before generation completes, the SSE `complete` event arrives and updates Character B's `audioUrl`/`portraitUrl` instead of Character A's. The root cause is that the task registry carries no entity UID, the completion payload carries no entity UID, and task state is local to `character-section.mjs` which gets re-used across character switches.

### entityType values

| Generation type | `entityType` string |
|---|---|
| AnyTale portrait | `'anytale-portrait'` |
| AnyTale voice | `'anytale-voice'` |

These are the only two types in scope for this feature. Future generation types (e.g. queued generations) should register their own `entityType` strings when added.

### Task registry changes (`server/core/sse.mjs`)

`createTask()` already accepts an arbitrary data object. After `initializeGenerationTask()` returns a `taskId`, call `updateTask(taskId, { characterUid: uid, entityType: 'anytale-portrait' })` immediately in `anytale/router.mjs`.

`createCompletionResponse()` should read `task.characterUid` from the stored task and merge it into the `result` object before emitting the SSE `complete` event. This is the single place where `uid` enters the client-side payload.

### `GET /generation/tasks/active` response shape

```json
[
  {
    "taskId": "task_1716000000000_abc",
    "characterUid": "abc-123",
    "entityType": "anytale-portrait",
    "progress": { "percentage": 45, "currentStep": "Rendering" }
  }
]
```

Only tasks where `status` is not `'completed'`, `'cancelled'`, or `'error'` are returned. Completed-but-missed events are intentionally excluded to avoid cluttering the UI with stale generation info.

### Unsaved character UIDs

When a character has not been saved, the client sends `'temp-portrait'` or `'temp-voice'` as the UID. The server already skips the database write for these placeholder UIDs. On the client, the mismatch handler must treat these as discard-only — there is no saved character record to back-fill.

### Cancel-on-switch semantics

Switching characters sends `POST /generate/cancel` for any active portrait or voice task. If the cancel arrives before the generation completes, the task is cleaned up server-side and will not appear in `GET /generation/tasks/active`, so reconnect has nothing to resume. If the generation completes before the cancel arrives (race condition):
- For unsaved characters: the server skips the DB write regardless; the client mismatch handler discards the result.
- For saved characters: the server DB write is legitimate and kept; the client mismatch handler silently refreshes that character's background state without disrupting the currently displayed character.

### Reconnect resume scope

Only in-progress tasks are resumed. A task that completed during a page reload is intentionally not recovered — the server's 5-minute cleanup window means the task entry still exists, but the client ignores it to avoid surfacing irrelevant completion info.

### Manual test instructions

**Task: store characterUid in task registry + active tasks endpoint**
1. Start the server and open the AnyTale page
2. Select any saved character and click Generate Portrait or Generate Voice
3. While generation is running, open a new browser tab and run:
   `curl http://localhost:<PORT>/generation/tasks/active`
4. Verify the response includes the correct `characterUid`, `entityType`, and non-zero `progress.percentage`

**Task: uid in SSE completion payload**
1. Open the browser DevTools Network tab and filter for EventStream
2. Trigger a portrait or voice generation
3. When the `complete` event arrives, inspect the `data` field
4. Verify `result.uid` matches the character's UID shown in the AnyTale UI

**Task: progress banner persists across character switch**
1. Start a portrait or voice generation for Character A
2. While it is running, switch to Character B using the character selector
3. Verify the `ProgressBanner` is still visible at the page level
4. Verify Character B's portrait/voice fields are not modified when generation completes

**Task: cancel on character switch**
1. Start a portrait generation for Character A
2. While it is running, switch to Character B
3. Run `curl http://localhost:<PORT>/generation/tasks/active` immediately after switching
4. Verify the task is no longer listed (cancelled)
5. Confirm no portrait update is applied to either character

**Task: reconnect resume**
1. Start a portrait or voice generation for any saved character
2. While it is running, refresh the page
3. Verify the `ProgressBanner` reappears and continues showing progress
4. Verify generation completes normally and updates the correct character

**Task: uid mismatch — discard for unsaved character**
1. Create a new, unsaved character (do not save it)
2. Trigger voice generation for it
3. Switch to a different character before it completes
4. When generation finishes, verify neither character's `audioUrl` was updated
