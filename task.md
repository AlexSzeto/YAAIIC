# Remove Redundant `upload` Field from Workflow Configuration

## Goal

Eliminate the `upload` array from workflow config entries in `comfyui-workflows.json` by making the generation router auto-derive which files to upload to ComfyUI from the already-present `options.inputImages`, `options.inputAudios`, and `options.type` fields. This removes a source of duplication where the same information is declared twice — once in `options` (for validation and UI) and again in `upload` (for the router).

## Tasks

- [ ] Update `POST /generate` in `server/features/generation/router.mjs` to derive upload specs from `options` instead of `workflowData.upload`
- [ ] Remove the `upload` array from all 12 affected workflow entries in `server/resource/comfyui-workflows.json`
- [ ] Update `autoDetectWorkflow` in `server/features/workflows/service.mjs` to emit `replace` entries for `image_N_filename` / `audio_N_filename` instead of `upload` entries
- [ ] Remove the `upload` property and `uploadMapping` definition from `server/resource/comfyui-workflows.schema.json`

## Implementation Details

### Context: What `upload` currently does

`workflowData.upload` is an array like `[{ "from": "image_0" }, { "from": "mask" }]`. In `router.mjs` lines 101–147, the router iterates this array, uploads each named multipart file field to ComfyUI, and stores the result as `req.body["{from}_filename"]` (e.g., `image_0_filename`). The `replace` mappings in the workflow then reference those variables (e.g., `{ "from": "image_0_filename", "to": ["13", "inputs", "image"] }`).

The `upload` array is consumed **only** in the `POST /generate` handler. The `POST /generate/inpaint` endpoint hardcodes its own upload logic and ignores `workflowData.upload` entirely.

### Task 1 — Update `POST /generate` router

Replace the `workflowData.upload`-driven block (lines 101–147 of `router.mjs`) with logic that derives upload specs directly from `workflowData.options`:

**Derivation rules:**
- For each index `i` from `0` to `options.inputImages - 1`: upload field `image_i` as type `image`
- For each index `i` from `0` to `options.inputAudios - 1`: upload field `audio_i` as type `audio`
- If `options.type === 'inpaint'`: also upload field `mask` as type `image`

The filename resolution logic (using `` req.body[`${from}_uid`] `` to look up an existing media URL, falling back to a timestamped name) and the `` req.body[`${from}_filename`] `` assignment must remain unchanged — only the source of the field names changes.

The guard condition changes from `if (workflowData.upload && ...)` to `if (req.files && req.files.length > 0)`.

### Task 2 — Remove `upload` from `comfyui-workflows.json`

The 12 affected workflow entries and their current `upload` arrays (all of which are fully derivable from `options`):

| Workflow | options.type | options.inputImages | options.inputAudios | upload entries |
|---|---|---|---|---|
| Image Style Transfer (Illustrious) | image | 1 | 0 | `image_0` |
| Inpaint (Realistic Vision Fantasy) | inpaint | 0 | 0 | `image_0`, `mask` |
| Inpaint (Waifu Anime) | inpaint | 0 | 0 | `image_0`, `mask` |
| Image Edit (Qwen) | image | 1 | 0 | `image_0` |
| Image Edit (Flux Klein) | image | 1 | 0 | `image_0` |
| Multi Source Image Edit (Flux Klein) | image | 2 | 0 | `image_0`, `image_1` |
| Image to Video (WAN22) | video | 2 | 0 | `image_0`, `image_1` |
| Image to Video Loop (WAN5b) | video | 1 | 0 | `image_0` |
| Image to Video (WAN5b) | video | 2 | 0 | `image_0`, `image_1` |
| Text to Speech (Chatterbox) | audio | 0 | 1 | `audio_0` |
| Text to Speech (Qwen3-TTS) | audio | 0 | 1 | `audio_0` |
| Remove Background (RMBG) | image | 1 | 0 | `image_0` |

Note: Inpaint workflows have `inputImages: 0` in options because they route exclusively through `/generate/inpaint`, which hardcodes its own upload logic and never reads `workflowData.upload`. The `upload` array on inpaint entries is already ignored at runtime — simply delete it.

The `replace` mappings that reference `image_0_filename`, `image_1_filename`, `audio_0_filename`, `mask_filename` in each workflow must **not** be changed — they are unaffected.

### Task 3 — Update `autoDetectWorkflow` in `service.mjs`

Currently `autoDetectWorkflow` builds an `upload` array with entries that include an undocumented `to` property (which the schema forbids via `additionalProperties: false`). These entries were never actually used by the router for the `to` field, only `from`.

After this change, `autoDetectWorkflow` should instead emit proper `replace` entries:

**For each `LoadImage` node** (0-indexed `i` starting at 0):
- Currently: `` upload.push({ from: `image_${imageCount}`, to: [nodeId, 'inputs', 'image'] }) ``
- After: `` replace.push({ from: `image_${i}_filename`, to: [nodeId, 'inputs', 'image'] }) ``

**For each `LoadAudio` node** (0-indexed `i` starting at 0):
- Currently: `` upload.push({ from: `audio_${audioCount}`, to: [nodeId, 'inputs', 'audio'] }) ``
- After: `` replace.push({ from: `audio_${i}_filename`, to: [nodeId, 'inputs', 'audio'] }) ``

Also fix the pre-increment bug: currently `imageCount++` is called before the push, so the first image becomes `image_1` (1-indexed). Change to use a 0-based index variable (e.g., iterate with `let i = 0` and increment after use, or use `imageCount - 1` after incrementing for options but 0-based for replace).

The `upload` local variable and the `upload` property on the returned `workflow` object should be removed entirely. `options.inputImages` and `options.inputAudios` are already being set correctly and remain unchanged.

### Task 4 — Update `comfyui-workflows.schema.json`

Remove two sections:
1. The `"upload"` property from the main workflow object definition (lines 106–112)
2. The `"uploadMapping"` definition from the `definitions` block (lines 255–266)

### Manual Testing

After all four tasks are complete, test the following scenarios:

**Image input workflow (e.g., "Remove Background"):**
- Open the app, select "Remove Background (RMBG)"
- Upload an image and submit
- Verify the generation completes successfully and the background is removed

**Multi-image workflow (e.g., "Image to Video (WAN5b)"):**
- Select a workflow requiring 2 images
- Upload 2 images and submit
- Verify both frames are used in the generated video

**Audio input workflow (e.g., "Text to Speech (Chatterbox)"):**
- Select "Text to Speech (Chatterbox)"
- Provide a reference audio and prompt
- Verify generation completes with expected audio output

**Auto-detect new workflow:**
- Use the workflow editor to upload a new ComfyUI workflow JSON that contains `LoadImage` nodes
- Verify the auto-detected config no longer includes an `upload` array
- Verify the auto-detected config includes `replace` entries like `{ "from": "image_0_filename", "to": [...] }`

**Inpaint (unchanged endpoint):**
- Open an image in the gallery and use the inpaint tool
- Confirm inpainting still works (this routes through `/generate/inpaint` which is untouched)

---

# Schema Correctness Fixes

## Goal

Fix accuracy issues in `comfyui-workflows.schema.json` that were revealed by the upload removal work. These are independent corrections to make the schema match the actual runtime behaviour and data.

## Tasks

- [ ] Move the `hidden` property from `workflowOptions` to the top-level `workflow` definition in `comfyui-workflows.schema.json`
- [ ] Update the `from` field description in `directReplacement` to document the auto-derived upload variables (`image_N_filename`, `audio_N_filename`, `mask_filename`)

## Implementation Details

### Task 5 — Fix `hidden` field location

`hidden` is currently defined as a property of `workflowOptions` (lines 197–200 of the schema), but in every workflow entry in `comfyui-workflows.json` and in `autoDetectWorkflow` in `service.mjs`, `hidden` is set as a **top-level property of the workflow object**, not inside `options`:

```json
{
  "name": "...",
  "hidden": true,
  "options": { ... }
}
```

Because the `workflow` definition has `"additionalProperties": false`, any workflow with a top-level `hidden` field technically fails schema validation. The fix is:

1. Remove `hidden` from the `workflowOptions` properties block
2. Add `hidden` to the `workflow` properties block (alongside `name`, `base`, `options`, etc.) with the same type and description

The `required` arrays for both objects are unaffected — `hidden` is optional in both locations.

### Task 6 — Update `directReplacement.from` description

After the upload removal, the `image_N_filename`, `audio_N_filename`, and `mask_filename` variables are no longer an implementation detail of `upload` entries — they are the primary mechanism by which uploaded files reach workflow nodes, set by the router from `options.inputImages` / `options.inputAudios` / `options.type`.

Update the `from` field description in the `directReplacement` definition to document these variables explicitly. Current description:

> `"Source variable name (e.g., 'prompt', 'seed', 'saveImagePath', 'imagePath', 'firstFramePath', 'ollamaAPIPath', 'saveAudioPath')"`

Updated description should add: `image_N_filename` (where N = 0 to inputImages-1), `audio_N_filename` (where N = 0 to inputAudios-1), and `mask_filename` (for inpaint workflows).

### Manual Testing

**Validate `hidden` fix:**
- Use a JSON schema validator (e.g., `ajv`) to validate `comfyui-workflows.json` against `comfyui-workflows.schema.json`
- Confirm no errors are reported for workflows that have `hidden: true` at the top level
- Before the fix, these same entries should report an `additionalProperties` error

**Validate description update:**
- Open `comfyui-workflows.schema.json` and confirm the `directReplacement.from` description mentions `image_N_filename`, `audio_N_filename`, and `mask_filename`
- Open a workflow entry with file inputs (e.g., "Remove Background") and confirm its `replace` mapping uses `image_0_filename` — matching the documented variable names
