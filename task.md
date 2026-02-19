
# Workflow Editor - Auto-detection Fixes and New Features

## Goals
Fix the remaining auto-detection bug for typed primitive nodes, complete the `easy saveText` detection for `extractOutputTexts`, and add new workflow editor capabilities: selecting a base file from available files on disk and duplicating existing workflows.

## Tasks

- [ ] **Auto-detect typed primitive nodes (`PrimitiveString`, `PrimitiveStringMultiline`, `PrimitiveInt`, `PrimitiveFloat`, `PrimitiveBoolean`) in `autoDetectWorkflow`**: Add a new early detection pass in [service.mjs](server/features/workflows/service.mjs) that iterates over all nodes before the existing `PrimitiveNode` passes. For each typed primitive node, check `_meta.title` (case-insensitively) against `"Name"`, `"Prompt"`, and `"Seed"`. If matched, add the corresponding replace binding (`{ from: 'name'|'prompt'|'seed', to: [nodeId, 'inputs', 'value'] }`) and skip further processing of that node. For unmatched typed primitives, create an `extraInputs` entry with the correct input type (`text` for `PrimitiveString`/`PrimitiveStringMultiline`, `number` for `PrimitiveInt`/`PrimitiveFloat`, `checkbox` for `PrimitiveBoolean`) and add a replace mapping pointing to `[nodeId, 'inputs', 'value']`. After testing, `prompt` and `seed` processed correctly but not unmatched node such as `Width` and `Height`

- [ ] **Auto-detect other `easy saveText` nodes for `extractOutputTexts` post-task**: In `autoDetectWorkflow` in [service.mjs](server/features/workflows/service.mjs), after detecting the `video-filename` save-text node, scan remaining `easy saveText` nodes whose `inputs.file_name` matches one of the known data property names: `tag`, `prompt`, `description`, `summary`. Collect all matches and add a single post-generation task `{ process: 'extractOutputTexts', parameters: { properties: [...matchedNames] } }` if any are found.

- [ ] **Add `GET /api/workflows/base-files` endpoint**: In [service.mjs](server/features/workflows/service.mjs), add a `listBaseFiles()` function that reads all `.json` filenames from `COMFYUI_WORKFLOWS_DIR` and returns them as a sorted array. In [router.mjs](server/features/workflows/router.mjs), mount `GET /api/workflows/base-files` (before any `/:name` routes to avoid shadowing) returning `{ files: [...filenames] }`.

- [ ] **Add `GET /api/workflows/base-files/:filename` endpoint**: In [router.mjs](server/features/workflows/router.mjs), add a `GET /api/workflows/base-files/:filename` route (mounted before `/:name`) that reads the named `.json` file from `COMFYUI_WORKFLOWS_DIR` and returns its parsed JSON. Reject filenames that contain path traversal characters (e.g. `..` or `/`). This lets the frontend load the raw ComfyUI JSON for any available base file independently of a named workflow entry.

- [ ] **Replace Base file `Input` with a `Select` in `BasicInfoForm`**: In [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs):
  - Add a `baseFiles` state to `WorkflowEditor` (array of filename strings). Fetch it from `GET /api/workflows/base-files` on mount and after every upload. Pass `baseFiles` and a `onBaseChange` callback as props to `BasicInfoForm`.
  - In `BasicInfoForm`, replace the disabled `Input` for "Base file" with a `Select` whose options are built from `baseFiles` (label and value both equal to the filename). Keep the `style={{ maxWidth: '200px' }}` sizing.
  - When the user picks a different base file, update `workflow.base` via `onChange` and fetch the new raw JSON from `GET /api/workflows/base-files/:filename` to replace `workflowJson` in the parent. Wire this fetch through the `onBaseChange(filename)` callback so `WorkflowEditor` handles the fetch and state update.

- [ ] **Add duplicate button to each workflow list item**: In [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs), add a small icon-only `Button` (variant `small-icon`, color `secondary`, icon `copy`) to each `WorkflowListItem`, positioned between the type badge and the delete button. Stop propagation on click. Clicking it should:
  1. Fetch the full workflow for that name via `GET /api/workflows/:name`.
  2. Build a copy: strip any trailing `" (copy)"` or `" (copy N)"` suffix from the original name and append `" (copy)"` to form the new name. Set `base` from the original. All other fields are cloned from the fetched workflow.
  3. Load the copy into the editor (call `setWorkflow(copy)`) and fetch its base file JSON via `GET /api/workflows/base-files/:filename` to populate `workflowJson`. The copy is not auto-saved; the user must rename it and click Save to persist it.

## Implementation Details
