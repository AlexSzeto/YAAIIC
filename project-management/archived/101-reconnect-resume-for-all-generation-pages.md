# Reconnect-Resume for All Generation Pages

## Goal

Extend reconnect-resume behaviour to all generation entry points (main YAAIIC page, AnyTale image generation, and inpaint page) so that when a user returns to any page with an active generation in progress, the progress banner resumes automatically and the completion event is handled exactly as if the user never left.

## Tasks

- [x] Add `requestOrigin` to the server-side task registry: update `updateTask` / task storage so the field is persisted, and include it in the `GET /generation/tasks/active` response alongside existing fields
- [x] Update `POST /generate` to read `requestOrigin` from the request body and store it on the task immediately after initialisation
- [x] Update `POST /generate/inpaint` to read `requestOrigin` from the request body and store it on the task immediately after initialisation
- [x] Backfill AnyTale portrait and voice generation endpoints in `server/features/anytale/router.mjs` with `requestOrigin: 'anytale'` alongside their existing `entityType` values
- [x] On the main YAAIIC page, send `requestOrigin: 'yaaiic'` in every generate request payload
- [x] On the main YAAIIC page, add a reconnect-resume `useEffect` that filters `activeTasks` from `useProgress()` by `requestOrigin === 'yaaiic'` and calls `show(taskId, onComplete)` for any match not already showing
- [x] On the main YAAIIC page, fix `onComplete` to jump to the newly generated image after adding it to the results
- [x] On the AnyTale page, send `requestOrigin: 'anytale'` in every image generate request payload
- [x] On the AnyTale page, add a reconnect-resume `useEffect` that filters `activeTasks` by `requestOrigin === 'anytale'` and absent/null `entityType`, and calls `show(taskId, onComplete)` for any match not already showing
- [x] On the AnyTale page, fix `onComplete` for image generation to jump to the newly generated image after adding it to the viewer
- [x] On the inpaint page, send `requestOrigin: 'inpaint'` in every inpaint generate request payload
- [x] On the inpaint page, add a reconnect-resume `useEffect` that filters `activeTasks` by `requestOrigin === 'inpaint'` and calls `show(taskId, onComplete)` for any match not already showing
