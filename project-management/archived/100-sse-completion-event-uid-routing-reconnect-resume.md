# SSE Completion Event UID Routing & Reconnect Resume

## Goal

Fix stale SSE completion events incorrectly updating the wrong character's UI, add UID-aware event routing so each completion result is applied to the correct entity, implement reconnect-resume for in-progress tasks, and cancel in-flight generation when the user switches characters.

## Tasks

### Server

- [x] Store `characterUid` and `entityType` in the task registry when portrait or voice generation is initiated in `server/features/anytale/router.mjs`
- [x] Include `characterUid` from the task registry in the SSE completion event's `result` payload inside `server/core/sse.mjs`
- [x] Export a `getActiveTasks()` function from `server/core/sse.mjs` that returns only in-progress tasks (excluding completed, cancelled, and errored tasks)
- [x] Add a `GET /generation/tasks/active` endpoint that returns the active task list

### Client — SSE Manager

- [x] Add a `fetchActiveTasks()` method to `SSEManager` in `public/js/app-ui/sse-manager.mjs` that calls `GET /generation/tasks/active` and caches the result
- [x] Add a `getActiveTasks(entityType)` method to `SSEManager` that filters the cached result by `entityType`

### Client — Task State & Progress Banner

- [x] Lift `portraitTaskId` and `voiceTaskId` state from `character-section.mjs` up to `anytale-form.mjs`, passing them down as props and exposing setter callbacks; `character-section.mjs` calls the callbacks when initiating generation
- [x] Move `ProgressBanner` rendering for portrait and voice generation from `character-section.mjs` to `anytale-form.mjs` so the banner persists when the user switches characters

### Client — Cancel on Character Switch

- [x] In `anytale-form.mjs`, when the user selects a different character, send `POST /generate/cancel` for any active `portraitTaskId` or `voiceTaskId` before updating the selected character state

### Client — UID Mismatch Handling

- [x] In the portrait `onComplete` callback (now in `anytale-form.mjs`): if `data.result.uid` matches the currently displayed character's `uid`, update the UI normally; if it does not match and the `uid` is a real saved character UID (not `'temp-portrait'`), silently re-fetch that character's data from the server to sync its `portraitUrl` in background state; if the `uid` is `'temp-portrait'`, discard the result entirely
- [x] Apply the same three-way mismatch logic to the voice `onComplete` callback for `audioUrl` and `introTranscript` (discard when `uid` is `'temp-voice'`)

### Client — Reconnect Resume

- [x] On mount of `anytale-form.mjs`, call `sseManager.fetchActiveTasks()` and for any returned task with `entityType` of `'anytale-portrait'` or `'anytale-voice'`, restore the corresponding `portraitTaskId`/`voiceTaskId` state so the `ProgressBanner` resumes displaying progress
