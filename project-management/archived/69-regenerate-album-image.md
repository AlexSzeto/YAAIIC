# Regenerate Album Image

## Goal

Allow users to regenerate the album art for an audio media item from the `GeneratedResult` display, without re-uploading the audio file, by triggering the full album art generation workflow using the item's stored name as the prompt, patching only the `imageUrl` field on completion, and notifying the client to update its local cache.

## Tasks

- [x] Fix bug: all generation-triggering buttons (generate, per-field regenerate, and the new album art regenerate button) must be disabled whenever `taskId` **or** `regenerateTaskId` is set in `app.mjs`.
- [x] Add a `POST /regenerate-image` endpoint in `server/features/generation/router.mjs` that accepts `{ uid }`, looks up the media record by uid, and delegates to the generation service.
- [x] Implement `regenerateAlbumImage(uid)` in `server/features/generation/` (or an appropriate service) that reads the stored `name` from the media record, runs the full album art generation workflow with that name as the prompt, patches only `imageUrl` back onto the record, persists the change, and emits the task completion event with updated `mediaData`.
- [x] Add a refresh/regenerate icon button pinned to the top-right corner of the album image in the `GeneratedResult` component, visible only for audio-type media items.
- [x] Wire the regenerate album art button in the client to call `handleRegenerate(uid, 'imageUrl')` (reusing the existing regenerate flow in `app.mjs`), and handle `imageUrl` as a special case on the server side when it is the sole field in the `fields` array.
- [x] On regeneration completion, ensure the client updates `generatedImage` and the matching history entry with the returned `mediaData` (already handled by `handleRegenerateComplete` — verify it covers `imageUrl`).

## Implementation Details

### Endpoint

```
POST /regenerate
Body: { uid: string, fields: ['imageUrl'] }
Response: { taskId: string }
```

The existing `/regenerate` endpoint in `server/features/generation/router.mjs` should detect when `fields` contains only `'imageUrl'` and route to the full album art generation workflow instead of the standard per-field regeneration task.

### Server-side special case

```js
// In the regenerate service/handler:
if (fields.length === 1 && fields[0] === 'imageUrl') {
  // Fetch the stored media record
  const record = await mediaRepository.findByUid(uid);
  // Run the full album art workflow using record.name as the prompt
  // On completion, patch only record.imageUrl and persist
}
```

### Album art workflow input

The album art generation workflow only requires a text prompt. The prompt is the audio item's stored `name` field. No audio file re-read is needed.

### Client-side button

- Location: `public/js/app-ui/main/generated-result.mjs`
- Visible only when `image.type === 'audio'`
- Pinned to the top-right corner of the album image using `position: absolute; top: 0; right: 0`
- Uses the existing refresh/regenerate icon available in the icon set
- Calls `onRegenerate(image.uid, 'imageUrl')`
- Disabled when `isGenerating` (passed as a prop, representing any active task)

### Disabled state fix

In `app.mjs`, the `isGenerating` prop passed to `GeneratedResult` (and `GenerationForm`) should reflect `!!(taskId || regenerateTaskId)` so all buttons are blocked during any active workflow.

```js
const isAnyTaskActive = !!(taskId || regenerateTaskId);
// Pass isAnyTaskActive as isGenerating to GeneratedResult and GenerationForm
```

### SSE / task completion

The existing `handleRegenerateComplete` in `app.mjs` already handles updating `generatedImage` and `history` from `data.mediaData`. The server must emit the completion event with `mediaData` set to the full updated record (same shape as other regeneration completions).

### Manual test (curl)

After implementation, test the endpoint directly:

```bash
curl -X POST http://localhost:3000/regenerate \
  -H "Content-Type: application/json" \
  -d '{"uid": "<valid-audio-uid>", "fields": ["imageUrl"]}'
```
