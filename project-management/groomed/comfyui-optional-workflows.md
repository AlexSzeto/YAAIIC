# ComfyUI-Optional Workflows

## Goal

Allow workflows to run without a ComfyUI component, enabling them to be used as lightweight background processes (e.g. auto-tagging, visual description generation) that operate on existing media records or produce freeform results. The system is generalized so any combination of pre-generation processors and LLM tasks can run independently of ComfyUI.

## Tasks

### Data & Schema
- [ ] Add `hasComfyUI` boolean field (default `true`) to the workflow schema in `comfyui-workflows.json`.
- [ ] Add `returnGenerationData` boolean field (default `true`) to the workflow schema; backfill all existing workflow entries with `true`.
- [ ] Add `videoUrl` and `videoFormat` as required fields to the media data schema in `media-data.json` (default `null`).

### Template System Migration
- [ ] Update the template interpolation engine to use double-brace syntax `{{variable}}` instead of single-brace `{variable}` system-wide.
- [ ] Update the interpolation engine to support dot-notation paths (`{{images[0].name}}`) that read from `generationData`; bracket notation (`[N]`) must explicitly create an array at that key if one does not exist.
- [ ] Migrate all existing workflow config template strings from `{variable}` to `{{variable}}` syntax.

### New Processors
- [ ] Implement `read-media` processor: accepts `uid` (text field referencing a media DB entry) and `param` (dot-notation path). Retrieves the media record, flattens it, places it into `generationData` at the specified path (creating arrays as needed), and preloads the associated file (from `imageUrl`, `audioUrl`, or `videoUrl`) as a `Buffer` into the `image`, `audio`, or `video` field at that path.
- [ ] Implement `write-media` processor: accepts `uid` and `param`. Reads the data at `generationData[param]`, writes any in-memory `Buffer` fields back to disk at the path derived from their corresponding URL field, and updates the media database record.

### Orchestrator Refactor
- [ ] Standardize blob handling: after ComfyUI execution (and any `extract-output-media` copy), read the output file into a `Buffer` and store it in `generationData` alongside its URL. Add a blob-flush step at the end of the pipeline (before `returnGenerationData` and before the DB entry) that writes all in-memory `Buffer` fields to disk using their paired URL fields as file path references.
- [ ] When `hasComfyUI` is `false`: skip ComfyUI submission, skip post-generation tasks, skip file-exists validation, and skip `addMediaDataEntry`. Results go into `generationData.results`; no media record is created.
- [ ] When `returnGenerationData` is `true` (ComfyUI workflows only): after post-generation tasks and the blob-flush step, copy all `generationData` properties except `results` into `generationData.results`.
- [ ] Update progress step counting: for ComfyUI-optional workflows, total steps = pre-gen task count only (no ComfyUI node count, no post-gen count).

### `executeWorkflow` Processor Update
- [ ] Replace the existing field-by-field input/output mapping with two parameters: `inputDataPath` (dot-notation path into parent `generationData` to pass as child input; empty string = full copy) and `outputDataPath` (dot-notation path in parent `generationData` where child's `results` are written).
- [ ] Migrate all existing `executeWorkflow` usages in workflow configs to the new `inputDataPath`/`outputDataPath` parameters.

### Brew Editor UI
- [ ] Add a "Has ComfyUI" toggle (boolean) to the brew editor next to the workflow JSON file selector.
- [ ] When "Has ComfyUI" is toggled off: hide the ComfyUI workflow JSON selector and the post-generation tasks section; rename the pre-generation section title to "Tasks".
- [ ] Add a "Return Generation Data" checkbox below the post-generation task list (visible only when `hasComfyUI` is `true`); default to checked.

## Implementation Details

### Blob flush step (standardized for both workflow types)

At the end of any workflow pipeline, before returning data, scan `generationData` for fields whose name matches a known blob key (`image`, `audio`, `video`). For each `Buffer` value found, derive the file path from the paired URL field (e.g. `imageUrl` → `STORAGE_DIR + path.basename(imageUrl)`), then write the buffer to disk. This gives ComfyUI-optional workflows (via `write-media`) and ComfyUI workflows identical blob lifecycle management.

### `generationData.results` for ComfyUI-optional workflows

Processors write their outputs anywhere in `generationData`. The workflow produces no standardized output record. The caller (e.g. `executeWorkflow` in a parent workflow) reads from `generationData.results` and maps it to the parent's `outputDataPath`.

### `returnGenerationData` behaviour (ComfyUI workflows)

```js
// Runs after post-gen tasks and blob flush, before addMediaDataEntry
if (workflowConfig.returnGenerationData) {
  generationData.results = Object.fromEntries(
    Object.entries(generationData).filter(([k]) => k !== 'results')
  );
}
```

### `executeWorkflow` new parameter contract

```js
// Parent generationData passed to child (inputDataPath = '' means full copy)
const childInput = inputDataPath
  ? getObjectPathValue(parentGenerationData, inputDataPath)
  : { ...parentGenerationData };

// After child completes, write child results back to parent
setObjectPathValue(parentGenerationData, outputDataPath, childGenerationData.results);
```

### Array bracket notation in template paths

`images[0].name` → the interpolation engine splits on `.` and `[N]`, creating arrays as needed:
```js
// Accessing generationData.images[0].name
// If generationData.images is undefined, create []
// If generationData.images[0] is undefined, create {}
```

### Reminder (out of scope for this feature)
- Purge `parts` and `plot` fields from `media-data.json` entries (no longer stored directly in media DB).
- `_runRegenerateTask` in the orchestrator is superseded by ComfyUI-optional workflows and should be removed in a future cleanup.
