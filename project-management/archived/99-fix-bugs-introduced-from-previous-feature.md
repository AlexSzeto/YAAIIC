# Fix Bugs Introduced From Previous Feature (98-anytale-portrait-voice-result-linking-deduplication-cache-lookup)

## Goal
Fix all outstanding bugs introduced by the previous feature implementation that leaves all media generations associated with the feature (thus, the entire AnyTale page) broken.

## Bug Details
- Server side: Partially Broken.
1. Requests to update the Portrait appear to be working on the server side - as refreshing after a Generate Portrait request appears to show a new portrait image associated with the data entry.
2. Requests to update the Voice only works if the client stays on the same page until the server completes the media generation workflow and returns its results. If the client refreshes before generation is complete, the information is lost - even if the server finishes generation successfully.
3. Requests to generate Part previews appears to be generating hashed names and sending them back to the client correctly.

- Client side: Completely Broken.
1. Requests to update the Portrait always fail to update the client data after generation completion - the new portrait wouldn't be seen until a manual refresh is complete.
2. Requests to generation Voice: Again, if the client navigates away from or refreshes the AnyTale page while voice generation is happening, that generation information is lost. It is not being stored in the server properly unless the task completes and returns to the client.
3. The ability to pull up cached images for parts is failing completely. If I generate a parts preview, it shows up. If I change tags or attributes, the preview image remains - which shouldn't happen, because the client should be looking up a hashed image assocaited with the new tag combination. If I generate a new preview image and try to navigate between two tag configurations that should have cached images, still nothing happens. The expected result is that the client should toggle between the two hashed images, because a pre-generated image is available for those tag combinations and they should be pulled up whenever I try to load a part or switch its attributes. These should all happen whether the preview is being generated in the Parts & Plot tab or Character & Outfits tab.

## Debug logs
Parts Preview Image Generation:
```
[ProgressBanner] subscribing to taskId=task_1779000386129_jh24tcuif
sse-manager.mjs:36 [SSE] subscribe: creating EventSource for task_1779000386129_jh24tcuif
progress-banner.mjs:275 [ProgressBanner] subscribe returned true for taskId=task_1779000386129_jh24tcuif
sse-manager.mjs:55 [SSE] EventSource open for task_1779000386129_jh24tcuif, readyState=1
sse-manager.mjs:64 [SSE] 'complete' listener fired for task_1779000386129_jh24tcuif, inMap=true, readyState=1
sse-manager.mjs:139 [SSE] _handleMessage: routing 'complete' to onComplete callback for task_1779000386129_jh24tcuif
progress-banner.mjs:230 [ProgressBanner] handleComplete fired for taskId=task_1779000386129_jh24tcuif
progress-banner.mjs:241 [ProgressBanner] calling onComplete prop for taskId=task_1779000386129_jh24tcuif
sse-manager.mjs:105 [SSE] unsubscribe: task_1779000386129_jh24tcuif (reason: complete-event)
sse-manager.mjs:267 [SSE] _cleanup: removing task_1779000386129_jh24tcuif from map
progress-banner.mjs:278 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779000386129_jh24tcuif
```

Portrait Generation:
```
[ProgressBanner] subscribing to taskId=task_1779000421632_nk70sphn6
sse-manager.mjs:36 [SSE] subscribe: creating EventSource for task_1779000421632_nk70sphn6
progress-banner.mjs:275 [ProgressBanner] subscribe returned true for taskId=task_1779000421632_nk70sphn6
sse-manager.mjs:55 [SSE] EventSource open for task_1779000421632_nk70sphn6, readyState=1
sse-manager.mjs:64 [SSE] 'complete' listener fired for task_1779000421632_nk70sphn6, inMap=true, readyState=1
sse-manager.mjs:139 [SSE] _handleMessage: routing 'complete' to onComplete callback for task_1779000421632_nk70sphn6
progress-banner.mjs:230 [ProgressBanner] handleComplete fired for taskId=task_1779000421632_nk70sphn6
progress-banner.mjs:241 [ProgressBanner] calling onComplete prop for taskId=task_1779000421632_nk70sphn6
sse-manager.mjs:105 [SSE] unsubscribe: task_1779000421632_nk70sphn6 (reason: complete-event)
sse-manager.mjs:267 [SSE] _cleanup: removing task_1779000421632_nk70sphn6 from map
progress-banner.mjs:278 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779000421632_nk70sphn6
```

Voice Generation (if the client stays on the page):
```
[ProgressBanner] subscribing to taskId=task_1779000445611_udanmpyke
sse-manager.mjs:36 [SSE] subscribe: creating EventSource for task_1779000445611_udanmpyke
progress-banner.mjs:275 [ProgressBanner] subscribe returned true for taskId=task_1779000445611_udanmpyke
sse-manager.mjs:55 [SSE] EventSource open for task_1779000445611_udanmpyke, readyState=1
sse-manager.mjs:64 [SSE] 'complete' listener fired for task_1779000445611_udanmpyke, inMap=true, readyState=1
sse-manager.mjs:139 [SSE] _handleMessage: routing 'complete' to onComplete callback for task_1779000445611_udanmpyke
progress-banner.mjs:230 [ProgressBanner] handleComplete fired for taskId=task_1779000445611_udanmpyke
progress-banner.mjs:241 [ProgressBanner] calling onComplete prop for taskId=task_1779000445611_udanmpyke
sse-manager.mjs:105 [SSE] unsubscribe: task_1779000445611_udanmpyke (reason: complete-event)
sse-manager.mjs:267 [SSE] _cleanup: removing task_1779000445611_udanmpyke from map
progress-banner.mjs:278 [ProgressBanner] useEffect cleanup: unsubscribing taskId=task_1779000445611_udanmpyke

```

Unfortunately, none of these tracked points appear to the the cause of any of the issues.

## Tasks

- [x] Remove hash-based filename from portrait generation in `server/features/anytale/router.mjs`. The hash system belongs to part previews only; character portrait generation accidentally inherited it. Remove `portraitPromptHash`, the `hash`/`targetFilename`/`targetPath` variables, and the `saveImagePath: targetPath` field from `requestData` in the `generate-portrait` endpoint. The orchestrator will then assign a sequential `image_<n>.png` path automatically. Update the `.then()` callback to use `result.imageUrl` (returned from `processGenerationTask`) for `updateCharacterField` instead of the pre-computed `'/media/' + targetFilename`. Using sequential filenames means every portrait generation produces a unique URL, eliminating both the Preact VDOM no-op and the browser cache staleness that caused the portrait to appear unrefreshed after generation.

- [x] Fix voice and portrait server-side persistence for unsaved characters (no uid) in `server/features/anytale/router.mjs`.
  - [x] Also persist `introTranscript` (from `result.summary`) alongside `audioUrl` in the voice generation `.then()` callback; previously only `audioUrl` was written to the character record, so transcript was lost on reload. Both `generate-portrait` and `generate-voice` routes fall back to `'temp-portrait'` / `'temp-voice'` as the uid when the character is unsaved. `updateCharacterField` then throws `Character not found` for these fake uids, silently swallowed by `.catch()`. Fix by skipping the `updateCharacterField` call (and logging a warning) when the uid is not a real character uid.

- [x] Fix client not syncing server-authoritative fields after page reload in `public/js/app-ui/anytale/character-section.mjs`. On mount, the character is loaded from localStorage. If voice generation completed while the client was away, the server's `audioUrl` (and possibly `portraitUrl`) is newer than what localStorage has. After the character list is fetched on mount, if the current character uid is found in the list, merge the server's `portraitUrl`, `audioUrl`, and `introTranscript` into the local character state so the UI reflects the server's latest values.

- [x] Create `POST /anytale/generate-part-preview` in `server/features/anytale/router.mjs` and wire both preview-generation call sites to it. Part preview generation in `public/js/app-ui/anytale/anytale-form.mjs` and `public/js/app-ui/anytale/character-section.mjs` both POST to `/generate/silent/async`, which saves files as `image_<n>.png`. The `requestPortraitCache` function in `public/js/app-ui/anytale/part-item.mjs` looks for `portrait_<hash>.png` via `POST /anytale/request-portrait`. These schemes are incompatible, so the cache lookup always returns `found: false`. The new endpoint accepts `{ prompt }`, computes `portraitPromptHash(prompt)`, and if `portrait_<hash>.png` already exists returns `{ found: true, portraitUrl }` immediately (no generation). Otherwise it initiates generation via `initializeGenerationTask` / `processGenerationTask` with `saveImagePath` set to `portrait_<hash>.png`, and returns `{ found: false, taskId }`. Update both `handlePreviewGenerate` functions in `anytale-form.mjs` and `character-section.mjs` to call this new endpoint instead of `/generate/silent/async`; if `found` is true in the response, update the part's `previewImageUrl` directly without showing a ProgressBanner. The `portraitPromptHash` function should be moved from `router.mjs` into a shared helper (e.g. `server/features/anytale/portrait-hash.mjs`) so both the existing `request-portrait` endpoint and the new endpoint can import it.

- [x] Fix stale preview image persisting after attribute value changes in `public/js/app-ui/anytale/part-item.mjs`. `handleAttrValueChange` updates `data.attributeValues` but does not clear `data.previewImageUrl` or call `requestPortraitCache`. When the user selects a different attribute value, the previous generation's preview image continues to show (even though the configuration has changed). Fix by updating `handleAttrValueChange` to: (1) include `previewImageUrl: ''` in the data patch to clear the stale preview, and (2) call `requestPortraitCache` with the updated part after calling `onChange`, so a cached image for the new combination is loaded automatically if available.

- [x] Fix same stale-preview / missing-cache-lookup problem for character parts in the Character & Outfits tab. In `public/js/app-ui/anytale/character-section.mjs`, `handlePartChange` forwards part updates to `setCharacter` but never clears `previewImageUrl` or triggers a cache lookup when attribute values change. Add a `requestPortraitCache`-style helper inside `CharacterSection` and call it from `handlePartChange` when it detects a change in `attributeValues`, clearing `previewImageUrl` on the updated part before requesting the cached image.

## Future Implementation Rules Suggestions

When implementing a feature that involves server-side persistence of generated results (images, audio, etc.) linked to a client-side entity (character, outfit, part), the following patterns must be addressed upfront: (1) **Fake/fallback UIDs must be guarded** — server endpoints that accept a uid as a route parameter and then update a database record must validate that the uid refers to a real record before performing work that depends on it, or skip the update for placeholder values; (2) **Client must re-sync from server on mount** — whenever a server-side background task can modify entity fields independently of the SSE `complete` callback (e.g., the client can navigate away mid-generation), the client must fetch the server's latest values on page load rather than relying solely on localStorage; (3) **Filename scheme must match scope of use** — a hash-based deduplication scheme only makes sense if every code path that generates those files uses the same scheme; if a feature introduces hash-addressed filenames for one purpose (part previews), it must not be grafted onto other generation paths (character portraits) that do not share the same lookup semantics, because mixed schemes silently break the cache lookup for all parties.
