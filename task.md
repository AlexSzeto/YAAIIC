# SSE Context Refactor

## Goal

Refactor the SSE/ProgressBanner system to use Preact Context so any component can access active task state and trigger progress banners via a unified `useProgress()` hook, eliminating direct `sseManager` imports and prop drilling across page components.

## Tasks

- [x] Refactor `public/js/custom-ui/msg/progress-context.mjs`: remove `sseManager` prop from `ProgressProvider` and import the singleton directly; add `activeTasks` state populated on mount via `sseManager.fetchActiveTasks()`; update `show(taskId, options)` to add to `activeTasks` and remove on completion/error/cancel (wrapping user callbacks); update `hide(taskId)` to also remove from `activeTasks`; update `useProgress()` to return `{ activeTasks, show, hide }`
- [x] Wrap the `app.mjs` render tree with `<ProgressProvider>` and migrate the `App` component to use `useProgress()`: remove the direct `sseManager` import and all inline `<ProgressBanner>` renders, replacing them with `show(taskId, options)` calls
- [x] Wrap the `inpaint.mjs` render tree with `<ProgressProvider>` and migrate `InpaintApp` to use `useProgress()`: remove the direct `sseManager` import and inline `<ProgressBanner>` render, replacing it with a `show(taskId, options)` call
- [x] Wrap the `anytale.mjs` render tree with `<ProgressProvider>` and migrate `anytale-form.mjs` to use `useProgress()`: remove the direct `sseManager` import and inline `<ProgressBanner>` renders, replacing them with `show()`/`hide()` calls; replace the `sseManager.fetchActiveTasks()` call in the reconnect-resume `useEffect` with a read from `activeTasks` in context

## Implementation Details

### `progress-context.mjs` changes

`sseManager` is imported as a singleton at the top of the file rather than accepted as a prop. On mount, `ProgressProvider` calls `sseManager.fetchActiveTasks()` and stores the result as `activeTasks` state (array of `{ taskId, entityType, characterUid, progress }` objects).

`show(taskId, options)` adds an entry to `activeTasks` if the `taskId` is not already present, then proceeds with the existing banner registration logic. It wraps `options.onComplete`, `options.onError`, and `options.onCancelled` so that each removes the task from `activeTasks` before calling the original callback.

`hide(taskId)` removes the task from `activeTasks` in addition to removing the banner from `progresses`.

`useProgress()` returns `{ activeTasks, show, hide }`.

### Reconnect-resume in `anytale-form.mjs`

The existing `useEffect` that calls `sseManager.fetchActiveTasks()` on mount is replaced with a `useEffect` that depends on `activeTasks` from `useProgress()`. When `activeTasks` is populated (non-empty), the component searches for portrait/voice tasks by `entityType` and calls `show(taskId, options)` for any it finds. This effect runs whenever `activeTasks` changes, but the `show()` call is guarded so it only fires once per task (i.e. not re-registered if the banner is already showing).
