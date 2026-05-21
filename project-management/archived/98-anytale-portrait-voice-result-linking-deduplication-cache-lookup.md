# AnyTale Portrait & Voice Generation — Result Linking, Portrait Deduplication, and Cache Lookup

## Goal
After portrait or voice generation completes, automatically update the character record on the server with the output URL — regardless of whether the client is still connected. Portrait generation always writes to a deterministic hash-addressed filename (same tags → same file, overwriting on regeneration). A separate `request-portrait` endpoint lets the client instantly look up a cached portrait by prompt hash without triggering generation — used whenever part properties (attribute values, base tags, or preview tags) change, so cached results surface immediately and the cached library grows over time as previews are generated.

## TODO Before Implementation
Plan these tasks:
- Preview image for outfits
- outfit preview default tags
- character gender

## Tasks

- [x] Task 1: Shared — add `portraitPromptHash` utility and `updateCharacterField` service helper
  - In `server/features/anytale/router.mjs` (or a new `server/features/anytale/portrait-hash.mjs` if preferred), add:
    ```js
    import crypto from 'crypto';
    export function portraitPromptHash(prompt) {
      const normalized = prompt
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join(',');
      return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    }
    ```
  - In `server/features/anytale/service.mjs`, add `updateCharacterField(uid, field, value)`:
    - Load the character by uid via the repository.
    - Patch the field and save via `upsertCharacter`.
    - Export the function.
  - **Manual test:** No UI yet — verify the hash function produces consistent output by calling it twice with the same prompt string in a quick Node REPL or `console.log` during a later task.

- [x] Task 2: Portrait — deterministic filename and post-completion character record update
  - In `server/features/anytale/router.mjs`, in the `generate-portrait` endpoint:
    1. After `prompt` is assembled, call `portraitPromptHash(prompt)` to get `hash`.
    2. `targetFilename = 'portrait_' + hash + '.png'`
    3. Resolve `targetPath = path.join(<mediaOutputDir>, targetFilename)` — use the same path constant already used elsewhere in the anytale router for media output.
    4. Always proceed with generation (no skip). Replace the fire-and-forget `.catch(...)` with:
       ```js
       processGenerationTask(taskId, requestData, workflowData, config, true, uploadFileToComfyUI)
         .then(async result => {
           const actualPath = result.saveImagePath;
           if (actualPath && actualPath !== targetPath) {
             await fs.promises.rename(actualPath, targetPath);
           }
           await service.updateCharacterField(uid, 'portraitUrl', '/media/' + targetFilename);
         })
         .catch(err => console.error('[anytale] Portrait generation failed:', err));
       ```
  - Import `fs` from `'node:fs'` if not already imported.
  - **Manual test:** Trigger portrait generation for a character. Confirm the output file in the media directory is named `portrait_<16-char-hex>.png`. Confirm `anytale-data.json` for that character has `portraitUrl` set to `/media/portrait_<hash>.png`. Trigger generation again with identical parts/attributes — confirm the file is overwritten (same filename, newer mtime) and the character record still points to the same URL.

- [x] Task 3: Voice — link result to character record
  - In the `generate-voice` endpoint, replace the fire-and-forget `.catch(...)` with:
    ```js
    processGenerationTask(taskId, requestData, workflowData, config, true, uploadFileToComfyUI)
      .then(async result => {
        if (result.audioUrl) {
          await service.updateCharacterField(uid, 'audioUrl', result.audioUrl);
        }
      })
      .catch(err => console.error('[anytale] Voice generation failed:', err));
    ```
  - Reuse `updateCharacterField` from Task 1.
  - **Manual test:** Trigger voice generation for a character, then close the browser tab. After generation completes (watch server logs), confirm `anytale-data.json` has `audioUrl` set. Reload the app and verify the audio URL is populated in the character editor.

- [x] Task 4: New endpoint — `POST /anytale/request-portrait`
  - Add a new route `POST /anytale/request-portrait` in the anytale router.
  - Request body: `{ prompt: string }` — the same assembled prompt that would be passed to `generate-portrait`.
  - Handler:
    1. Compute `hash = portraitPromptHash(req.body.prompt)`.
    2. `targetFilename = 'portrait_' + hash + '.png'`
    3. `targetPath = path.join(<mediaOutputDir>, targetFilename)`
    4. Check if the file exists using `fs.existsSync(targetPath)` (synchronous is fine here — it's a single stat check).
    5. If it **exists**: respond `200` with `{ found: true, portraitUrl: '/media/' + targetFilename }`.
    6. If it **does not exist**: respond `200` with `{ found: false }`.
  - No generation is triggered by this endpoint.
  - **Manual test:** After generating at least one portrait (Task 2), send a `POST /anytale/request-portrait` with the same prompt string via curl or browser console fetch. Confirm the response is `{ found: true, portraitUrl: '/media/portrait_<hash>.png' }`. Send a request with a different prompt — confirm `{ found: false }`.
    ```sh
    curl -X POST http://localhost:3000/anytale/request-portrait \
      -H "Content-Type: application/json" \
      -d '{"prompt": "blue hair, short hair, smile"}'
    ```

- [x] Task 5: Client — call `request-portrait` when part properties change
  - In `public/js/app-ui/anytale/part-item.mjs`, whenever `config.previewBaseline`, `config.baseline`, or `config.type` changes (i.e. in `handleTypeChange` and any `updateConfig` call that touches these fields), trigger a cache lookup:
    1. Assemble the preview prompt the same way the server does for portrait generation — use whatever prompt-assembly logic already exists on the client for the part preview (check `anytale-form.mjs` or the preview generation call site to find how the prompt is built from `config`).
    2. Send `POST /anytale/request-portrait` with `{ prompt: assembledPrompt }`.
    3. If `found: true`, update `data.previewImageUrl` to the returned `portraitUrl` via `updateData({ previewImageUrl: response.portraitUrl })`.
    4. If `found: false`, do nothing — the existing `previewImageUrl` (if any) stays.
  - This call should be fire-and-forget (no loading state, no error display). Use a plain `fetch` without `await` in the event handlers (or use `.then()` without blocking).
  - **Manual test:** Generate a preview for a part. Change one of its attribute values back and forth. Confirm the preview image snaps instantly to the cached portrait when the attributes match a previously generated combination, without triggering a new generation job.

## Bugs

### ~~ProgressBanner `onComplete` never fires after SSE fix~~ (Fixed)

**Root cause:** Race condition in `_handleError`. When the server closes the TCP connection in the same payload as the `complete` event, the EventSource fires `onerror` (readyState CLOSED) before dispatching the queued `complete` event. `_handleError` called `_cleanup(taskId)` immediately, removing the connection from `activeConnections`. When the `complete` listener then fired, `_handleMessage` could not find the connection and returned early — silently dropping `onComplete`.

**Fix:** In `_handleError`, when `readyState === CLOSED`, defer `_cleanup` by one tick via `setTimeout(0)`. The deferred closure checks that the connection is still the same one before cleaning up, so it is safe if `complete` already ran `unsubscribe` first.
