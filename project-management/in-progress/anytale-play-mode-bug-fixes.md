# AnyTale Play Mode Bug Fixes

## Goal

Track and fix AnyTale Play Mode bugs as they are discovered post-ship. This is a living ticket — no tasks are pre-specified. All work items are appended ad-hoc as bugs are reported or found.

## Tasks

#### Fixes and Changes
- [x] Auto-regenerate part preview images that return 404 after a storage purge
  - Add `onError` prop to `ImagePreview` (`public/js/app-ui/anytale/image-preview.mjs`) that forwards to the underlying `<img>`
  - In `part-item.mjs`, pass an `onError` handler to `ImagePreview` that clears `previewImageUrl` to `''` on the part and immediately calls `onPreviewGenerate` if it is available

## Implementation Details

Play Mode source files:

- `public/js/app-ui/anytale-play/anytale-play.mjs` — main Play Mode component
- `public/js/app-ui/anytale-play/play-cache.mjs` — image/asset caching
- `public/js/app-ui/anytale-play/play-data.mjs` — data access layer
- `public/js/app-ui/anytale-play/play-dialog.mjs` — dialog UI
- `public/js/app-ui/anytale-play/play-normalizer.mjs` — data normalization
- `public/js/app-ui/anytale-play/play-utils.mjs` — shared utilities
- `public/js/app-ui/anytale/play/play-prefs.mjs` — user preferences
- `public/js/app-ui/anytale/play/play-progress-bar.mjs` — progress bar component
- `public/js/app-ui/anytale/play/play-session.mjs` — session state management
- `public/js/app-ui/anytale/play/play-toggle-button.mjs` — play/pause toggle
