# Main Gallery & Inpaint Feature

The main page is the primary generation hub. It combines a workflow selector, a generation form, an SSE-driven results panel, and a full-screen gallery. Inpaint is a sub-flow accessible from any generated image result.

## User Flow

### Standard generation
```
Select workflow → Fill form (prompt, name, seed, extra inputs, input images/audio)
→ Click Generate → SSE progress stream → GeneratedResult panel
→ Reprompt / Export / Delete / Inpaint
```

### Inpaint flow
```
GeneratedResult → Click "Inpaint" → InpaintCanvas (draw region)
→ InpaintForm (adjust prompt/seed) → Click Inpaint
→ SSE progress → GeneratedResult
```

### Gallery browsing
```
Click "Gallery" button → Gallery modal (search/filter/paginate)
→ Select item (selection mode) OR bulk delete/move
```

## Component Map

```
app-ui/main/
  gallery.mjs           — full-screen modal grid with search, pagination, bulk ops
  gallery-preview.mjs   — single gallery item (thumbnail, metadata, checkbox)
  generation-form.mjs   — prompt/name/seed/extra-inputs/upload form
  generated-result.mjs  — result display with metadata editing + action buttons

app-ui/inpaint/
  inpaint-canvas.mjs    — HTML5 canvas for drawing rectangular inpaint regions
  inpaint-form.mjs      — prompt/seed/extra-inputs form for inpaint generation
```

### Component communication

- The **page root** (not in `main/`) owns top-level state: selected workflow, form state, current result, inpaint area.
- `GenerationForm` and `InpaintForm` are controlled — all field values flow in via props and changes are reported via `onFieldChange`.
- `Gallery` is opened modally; the parent passes a `previewFactory` to render each item, allowing the same gallery component to be reused across contexts (main page, image input picker, audio picker).
- `GeneratedResult` calls `onEdit(uid, field, value)` for inline metadata edits; the parent writes the change to the server.

## Server Endpoints Used

| Method | Path | Description |
|--------|------|-------------|
| GET | `/media-data` | Fetch gallery items; query params: `query`, `tags`, `limit`, `folder` |
| DELETE | `/media-data/delete` | Bulk delete; body: `{ uids: number[] }` |
| POST | `/edit` | Bulk update (e.g. move to folder); body: array of updated entries |
| POST | `/generate` | Start image/video/audio generation; returns `{ taskId }` |
| POST | `/generate/inpaint` | Start inpaint generation; body includes image and mask files, `inpaintArea` |
| GET | `/exports` | List export destinations; query: `type` |
| POST | `/export` | Export to destination; body: `{ exportId, mediaId }` |

SSE progress is consumed from the standard SSE endpoint (see `architecture.md`). The client subscribes using the `taskId` returned by `/generate`.

## Generation Form Details

`generation-form.mjs` renders dynamically based on the selected `WorkflowDefinition.options`:

| Option field | Effect on form |
|---|---|
| `autocomplete: true` | Shows `TagSelectorPanel` on right-click in prompt textarea |
| `inputImages: N` | Shows N image upload slots (gallery picker or file upload) |
| `inputAudios: N` | Shows N audio upload slots (gallery picker) |
| `optionalPrompt: true` | Allows empty prompt |
| `nameRequired: true` | Disables Generate button until name is filled |
| `extraInputs: [...]` | Renders additional input fields from `ExtraInput[]` (see `WorkflowOptions` typedef in `workflow-validator.mjs`) |

The Generate button is disabled when:
- No workflow selected
- Required fields missing (name, prompt, input images/audio)
- Same task is already queued (checked via `useQueueStatus`)

When queued (queue not empty), button label changes to "Queue" and uses secondary styling.

## Gallery Component Details

`gallery.mjs` fetches all matching items at once (limit 1200) and paginates client-side (24 per page). Grid column count is responsive: 8 / 6 / 4 / 3.

**Modes:**

| Mode | Behaviour |
|------|-----------|
| Viewing (default) | Checkbox selection, bulk delete/move, item click shows `GalleryPreview` |
| Selection (`selectionMode: true`) | Single-click selects item and closes modal, calls `onSelect(item)` |

**Filtering:**
- `fileTypeFilter` prop disables items of the wrong type (used when selecting input images vs audio).
- `folder` prop restricts to a specific folder UID.
- Search field queries either description text or tags (toggle button).

## Inpaint Details

`InpaintCanvas` renders at the image's natural resolution. The user drags to draw a rectangular selection; coordinates are stored as `{ x1, y1, x2, y2 }` in image-native pixels. The selected area is visualised with a semi-transparent overlay drawn outside the rect.

The Inpaint button is disabled until a valid area (`x1 !== x2 && y1 !== y2`) is drawn.

The inpaint request body adds:
- `imagePath`: absolute server path to the original image
- `maskPath`: path where the server will write the mask PNG
- `inpaintArea`: `{ x1, y1, x2, y2 }` rect in image pixels
- `inpaint: true`

The resulting `MediaEntry` has `inpaint: true` and `inpaintArea` set; its `type` is saved as `'image'` (not `'inpaint'`).
