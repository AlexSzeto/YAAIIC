# Reconnect-Resume for All Generation Pages

## Goal

Extend the reconnect-resume behaviour (introduced for AnyTale portrait/voice generation in feature #100) to all other generation entry points: the main YAAIIC page, the AnyTale image generation, and the inpaint page. When a user returns to any page that has an active generation in progress, the progress banner resumes automatically and the completion event is handled exactly as if the user never left.

## Prerequisites

- **SSE Context refactor** must land first. Once `activeTasks` is reactive state provided by `SSEContext`, reconnect-resume on each page becomes trivial — no per-page `fetchActiveTasks()` calls or prop threading are required.

## Items that need addressing before implementation

- Confirm the SSE Context refactor is complete and `activeTasks` is available via `useSSE()` in all page components.
- Decide whether the inpaint page's completion handler has any state it needs to reconstruct after a reload (e.g. the source image the user was editing), or whether fetching the result from the server by UID is sufficient.

## Design decisions (recorded from planning)

### `requestOrigin` field

A new field `requestOrigin` is stored in the task registry for every generation task. It identifies which page initiated the request, allowing each page to filter active tasks that belong to it.

| Page | `requestOrigin` value |
|---|---|
| Main YAAIIC page | `'yaaiic'` |
| AnyTale page | `'anytale'` |
| Inpaint page | `'inpaint'` |

`requestOrigin` is distinct from `entityType`. `entityType` describes the sub-type of generation within a page (e.g. `'anytale-portrait'`, `'anytale-voice'`). Future pages may introduce their own `entityType` sub-types under the same `requestOrigin`. A task can carry both fields.

### Server-side storage

- The generic `POST /generate` and `POST /generate/inpaint` endpoints read `requestOrigin` from the request body and store it via `updateTask(taskId, { requestOrigin })` immediately after task initialisation.
- The existing AnyTale portrait and voice endpoints in `server/features/anytale/router.mjs` are backfilled with `requestOrigin: 'anytale'` (they already set `entityType`).
- `GET /generation/tasks/active` response shape gains `requestOrigin` alongside the existing `taskId`, `characterUid`, `entityType`, and `progress` fields.

### Client-side resume

Each page component filters the `activeTasks` array from `SSEContext` by its own `requestOrigin` on mount. Within AnyTale, the image task is distinguished from portrait/voice by the absence (or null value) of `entityType`. Each page's existing `onComplete` handler runs unchanged — result data is fetched from the server by UID, so no local state needs to survive the reload.

### Concurrency

At most one active generation exists server-wide at any time. Each page will therefore find at most one matching task on resume. Generation queueing (a future feature) will revisit this assumption.

### `requestOrigin` is sent by the client

Because `POST /generate` is a generic endpoint shared by all pages, the server cannot infer the origin. Each page is responsible for including `requestOrigin` in its request payload.
