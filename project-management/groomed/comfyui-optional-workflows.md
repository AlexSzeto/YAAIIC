# ComfyUI-Optional Workflows

## Goal

Allow workflows to run without a ComfyUI component, enabling them to be used as lightweight background processes (e.g. auto-tagging, visual description generation) that operate on existing media records or produce freeform results. The system is generalized so any combination of pre-generation processors and LLM tasks can run independently of ComfyUI.

## Tasks

### Data & Schema
- [ ] Add `hasComfyUI` boolean field (default `true`) to the workflow schema in `comfyui-workflows.json`.
- [ ] Add `videoUrl` and `videoFormat` as required fields to the media data schema in `media-data.json` (default `null`).

### Template System Migration
- [ ] Update the template interpolation engine to use double-brace syntax `{{variable}}` instead of single-brace `{variable}` system-wide; support dot-notation paths (`{{imageData.url}}`) for reading nested values from `generationData`.
- [ ] Migrate all existing workflow config template strings from `{variable}` to `{{variable}}` syntax.

### New Processors
- [ ] Implement `read-media` processor: accepts `uid` (a media DB entry UID; may be a `{{template}}` expression) and `key` (a top-level key name). Retrieves the media record from the database and preloads its associated file (from `imageUrl`, `audioUrl`, or `videoUrl`) as a `Buffer`. Places the record fields and file buffer together into `generationData[key]`.
- [ ] Implement `write-media` processor: accepts `uid` and `key`. Reads `generationData[key]`, writes any `Buffer` field to disk at the path derived from its paired URL field, and updates the media database record. This is the only mechanism for persisting file buffers — no implicit flush occurs anywhere in the pipeline.

### Orchestrator Refactor
- [ ] After ComfyUI execution, read the output file into a `Buffer` and store it in `generationData` alongside its URL so downstream processors can access the file contents.
- [ ] When `hasComfyUI` is `false`: skip ComfyUI submission, skip the workflow parameter replacement section, skip post-generation tasks, skip file-exists validation, and skip `addMediaDataEntry`. No media record is created; all persistence is handled explicitly via `write-media` processors in the task list.
- [ ] Update progress step counting: for ComfyUI-optional workflows, total steps = pre-gen task count only (no ComfyUI node count, no post-gen count).

### `executeWorkflow` Processor Update
- [ ] Replace the existing field-by-field input/output mapping with two parameters: `inputKey` (name of a key in the parent's `generationData` to pass as the child's starting data; omit to pass the full parent `generationData`) and `outputKey` (name of a key in the parent's `generationData` where the child's completed `generationData` is written back).
- [ ] Migrate all existing `executeWorkflow` usages in workflow configs to the new `inputKey`/`outputKey` parameters.

### Brew Editor UI
- [ ] Add a "Has ComfyUI" toggle (boolean) to the brew editor.
- [ ] When "Has ComfyUI" is toggled off: hide the ComfyUI workflow JSON selector, the workflow parameter replacement section, and the post-generation tasks section; rename the pre-generation section title to "Tasks".

## Implementation Details

### `read-media` / `write-media` processor contract

```js
// read-media: places record fields and file buffer together at generationData[key]
generationData[key] = {
  ...mediaRecord,   // all DB fields: uid, imageUrl, audioUrl, videoUrl, tags, etc.
  buffer: Buffer,   // file contents loaded from whichever URL field is populated
};

// write-media: reads from generationData[key], flushes buffer to disk, updates DB record
const entry = generationData[key];
if (entry.buffer) {
  const filePath = resolveStoragePath(entry.imageUrl ?? entry.audioUrl ?? entry.videoUrl);
  fs.writeFileSync(filePath, entry.buffer);
}
await mediaRepository.update(uid, omit(entry, ['buffer']));
```

### `executeWorkflow` parameter contract

```js
// Pass a named slice of parent data to the child (or a full copy if inputKey is omitted)
const childInput = inputKey
  ? { ...parentGenerationData[inputKey] }
  : { ...parentGenerationData };

// Child runs its full task list, building up its own generationData
const childGenerationData = await runWorkflow(childWorkflow, childInput);

// Write child's completed generationData back into parent at outputKey
parentGenerationData[outputKey] = childGenerationData;
```

### ComfyUI-optional pipeline (`hasComfyUI: false`)

1. Run the task list in order — each processor reads and writes `generationData`.
2. Done. No ComfyUI submission, no post-gen tasks, no media record creation, no implicit file flush.
3. If called as a sub-workflow via `executeWorkflow`, the child's completed `generationData` is returned as-is to the parent.

### Template interpolation

Processor config values use `{{variable}}` syntax. The interpolation engine reads from `generationData` using dot-notation:

- `{{uid}}` → `generationData.uid`
- `{{imageData.url}}` → `generationData.imageData.url`

Undefined paths produce an empty string. No array creation occurs during interpolation — templates are read-only against `generationData`.

### Reminder (out of scope for this feature)
- Purge `parts` and `plot` fields from `media-data.json` entries (no longer stored directly in media DB).
- `_runRegenerateTask` in the orchestrator is superseded by ComfyUI-optional workflows and should be removed in a future cleanup.
