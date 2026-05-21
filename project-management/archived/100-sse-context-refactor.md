# SSE Context Refactor

## Goal

Refactor the SSE/ProgressBanner system to use Preact Context so any component can access active task state and trigger progress banners via a unified `useProgress()` hook, eliminating direct `sseManager` imports and prop drilling across page components.

## Tasks

- [x] Refactor `public/js/custom-ui/msg/progress-context.mjs`: remove `sseManager` prop from `ProgressProvider` and import the singleton directly; add `activeTasks` state populated on mount via `sseManager.fetchActiveTasks()`; update `show(taskId, options)` to add to `activeTasks` and remove on completion/error/cancel (wrapping user callbacks); update `hide(taskId)` to also remove from `activeTasks`; update `useProgress()` to return `{ activeTasks, show, hide }`
- [x] Wrap the `app.mjs` render tree with `<ProgressProvider>` and migrate the `App` component to use `useProgress()`: remove the direct `sseManager` import and all inline `<ProgressBanner>` renders, replacing them with `show(taskId, options)` calls
- [x] Wrap the `inpaint.mjs` render tree with `<ProgressProvider>` and migrate `InpaintApp` to use `useProgress()`: remove the direct `sseManager` import and inline `<ProgressBanner>` render, replacing it with a `show(taskId, options)` call
- [x] Wrap the `anytale.mjs` render tree with `<ProgressProvider>` and migrate `anytale-form.mjs` to use `useProgress()`: remove the direct `sseManager` import and inline `<ProgressBanner>` renders, replacing them with `show()`/`hide()` calls; replace the `sseManager.fetchActiveTasks()` call in the reconnect-resume `useEffect` with a read from `activeTasks` in context
