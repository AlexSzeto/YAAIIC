# Reconnect-Resume for All Generation Pages

## Goal

Extend reconnect-resume behaviour to all generation entry points (main YAAIIC page, AnyTale image generation, and inpaint page) so that when a user returns to any page with an active generation in progress, the progress banner resumes automatically and the completion event is handled exactly as if the user never left.

## Tasks

- [ ] Add `requestOrigin` to the server-side task registry: update `updateTask` / task storage so the field is persisted, and include it in the `GET /generation/tasks/active` response alongside existing fields
- [ ] Update `POST /generate` to read `requestOrigin` from the request body and store it on the task immediately after initialisation
- [ ] Update `POST /generate/inpaint` to read `requestOrigin` from the request body and store it on the task immediately after initialisation
- [ ] Backfill AnyTale portrait and voice generation endpoints in `server/features/anytale/router.mjs` with `requestOrigin: 'anytale'` alongside their existing `entityType` values
- [ ] On the main YAAIIC page, send `requestOrigin: 'yaaiic'` in every generate request payload
- [ ] On the main YAAIIC page, add a reconnect-resume `useEffect` that filters `activeTasks` from `useProgress()` by `requestOrigin === 'yaaiic'` and calls `show(taskId, onComplete)` for any match not already showing
- [ ] On the main YAAIIC page, fix `onComplete` to jump to the newly generated image after adding it to the results
- [ ] On the AnyTale page, send `requestOrigin: 'anytale'` in every image generate request payload
- [ ] On the AnyTale page, add a reconnect-resume `useEffect` that filters `activeTasks` by `requestOrigin === 'anytale'` and absent/null `entityType`, and calls `show(taskId, onComplete)` for any match not already showing
- [ ] On the AnyTale page, fix `onComplete` for image generation to jump to the newly generated image after adding it to the viewer
- [ ] On the inpaint page, send `requestOrigin: 'inpaint'` in every inpaint generate request payload
- [ ] On the inpaint page, add a reconnect-resume `useEffect` that filters `activeTasks` by `requestOrigin === 'inpaint'` and calls `show(taskId, onComplete)` for any match not already showing

## Implementation Details

### `requestOrigin` values by page

| Page | `requestOrigin` |
|---|---|
| Main YAAIIC page | `'yaaiic'` |
| AnyTale page | `'anytale'` |
| Inpaint page | `'inpaint'` |

`requestOrigin` identifies which page initiated the request. It is distinct from `entityType`, which identifies a sub-type within a page (e.g. `'anytale-portrait'`, `'anytale-voice'`). AnyTale image generation tasks carry `requestOrigin: 'anytale'` with no `entityType`; portrait/voice tasks carry both.

### Server changes

`GET /generation/tasks/active` response objects gain a `requestOrigin` field:
```json
{ "taskId": "...", "requestOrigin": "yaaiic", "entityType": null, "progress": 0.5 }
```

### Reconnect-resume pattern (same as AnyTale portrait/voice, already implemented)

```js
useEffect(() => {
  for (const task of activeTasks) {
    if (task.requestOrigin !== PAGE_ORIGIN) continue;
    // additional filter by entityType if needed
    if (progresses[task.taskId]) continue; // already showing
    show(task.taskId, buildOnComplete(task));
  }
}, [activeTasks]);
```

### Jump-to-result

After adding the new image to the results list, scroll or navigate so the new item is visible. The exact mechanism depends on each page's viewer component — verify current behaviour before implementing.

### Inpaint `onComplete` note

The existing inpaint `onComplete` already prepends the result to history (making it the current item) and applies `data.result.inpaintArea` from the server response. No changes are needed beyond wiring up the reconnect-resume effect. Verify this claim before committing changes.
