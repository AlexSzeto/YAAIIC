# Workflow Import and Edit UI - Bug Fixing (Continued)

## Goals
Fix remaining design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws
- Add an option to delete a workflow. When a workflow is deleted, delete its associated comfyUI workflow JSON file ONLY if none of the other existing workflows is using that file as its base workflow.

When a comfyUI workflow file is uploaded:
- if a node with `class_type` value `VHS_VideoCombine` exists, change the workflow type to `video`.
- The requirement to be able to save a workflow should be one of the following: a `saveImagePath` or `saveAudioPath` replace bindings, or an `extractOutputMediaFromTextFile` post generation task.
- the workflow selection UI shows the workflow as hidden, but in the form, the `Hidden from main UI` checkbox remains unchecked.
- the default state for Name required should be `true` for new workflows. Autocomplete and Optional prompt should remain `false`, as they are currently.
- all primitives (those nodes with `class_type` values of `PrimitiveString`, `PrimitiveStringMultiline`, `PrimitiveInt`, and `PrimitiveFloat`, and `PrimitiveBoolean`) should be checked first to see if their `_meta.title` matches the strings "Name", "Prompt" or "Seed". For every match, one of the key replacements (for `name`, `prompt` and `seed`) are accounted for and there's no need to search for `KSampler`, `CLIPTextEncode`, or other nodes for the `inputs` for those three key values. If the names of other primitives discovered do not match one of those key values, create them as extra inputs - create them as `text`, `number`, or `checkbox` matching their primitive types. Add an appropriate replace mapping into the primitive type node.
- look for the following sets of node attributes:
```
  "class_type": "easy saveText"
  "file_name": "video-filename",
  "file_extension": "txt",
```
If this exists, automatically create a post-generation `process` task for `extraOutputMediaFromTextFile` with `video-filename.txt`
as its output type.
- For other nodes with `class_type` of `easy saveText` that isn't saving to `video-filename`, see if the `file_name` attribute matches one of the expected data properties: (`tag`, `prompt`, `description`, `summary`). If it does, create a post-generation `process` task for `extractOutputTexts` and add an entry for every data property name discovered.

## Tasks

- [x] **Fix `hidden` field binding in `BasicInfoForm`**: The `hidden` property lives at the top level of the workflow object (`workflow.hidden`), but in `BasicInfoForm` in [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs), all four checkboxes (including `hidden`) are bound to `workflow.options` via `updateOpts`. This means the checkbox reads `opts.hidden` (always `undefined`) instead of `workflow.hidden`, causing the UI to always show unchecked even when the workflow is marked hidden. Fix by separating the `hidden` checkbox so it reads from and writes to `workflow.hidden` directly (using `onChange`), while keeping the other three (`autocomplete`, `optionalPrompt`, `nameRequired`) bound to `workflow.options`.

- [x] **Set `nameRequired` default to `true` in `autoDetectWorkflow`**: In [service.mjs](server/features/workflows/service.mjs), `autoDetectWorkflow` initialises `nameRequired: false`. Change this to `nameRequired: true` to match the expected default for newly uploaded workflows.

- [x] **Auto-detect `VHS_VideoCombine` node to set workflow type to `video`**: The first pass of `autoDetectWorkflow` in [service.mjs](server/features/workflows/service.mjs) does not check for the `VHS_VideoCombine` class type. Add detection so that when any node with `class_type === 'VHS_VideoCombine'` is found, `workflowType` is set to `'video'`.

- [x] **Fix save validation to accept `extractOutputMediaFromTextFile` post-task as a valid output binding**: Both `validateWorkflow` in [service.mjs](server/features/workflows/service.mjs) and `validateWorkflowFrontend` in [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs) require a `saveImagePath` or `saveAudioPath` replace binding to pass the output check. Update both to also accept a post-generation task with `process === 'extractOutputMediaFromTextFile'` as a satisfying alternative, so workflows that output via a text file are not incorrectly blocked from saving.

- [x] **Auto-detect `easy saveText` node with `file_name: "video-filename"` and create `extractOutputMediaFromTextFile` post-task**: In `autoDetectWorkflow` in [service.mjs](server/features/workflows/service.mjs), add a detection pass that looks for nodes with `class_type === 'easy saveText'`, `inputs.file_name === 'video-filename'`, and `inputs.file_extension === 'txt'`. When found, automatically add a post-generation task `{ process: 'extractOutputMediaFromTextFile', parameters: { filename: 'video-filename.txt' } }` to the workflow's `postGenerationTasks`.

- [x] **Add delete button to each workflow list item**: In [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs), add a small icon-only delete `Button` (variant `small-icon`, color `danger`) to each `WorkflowListItem` in the workflow selection panel. Clicking it should trigger the same delete confirmation and `handleDelete` logic already used by the form-level Delete button, scoped to that specific workflow name (it should not require the workflow to be loaded into the editor first). Stop propagation on the button click so it does not also select the workflow. The button should be positioned to the right of the existing badges.

- [x] **Delete workflow: automatically clean up orphaned base file**: The current `deleteWorkflow` in [service.mjs](server/features/workflows/service.mjs) accepts a `deleteBaseFile` flag but does not verify whether any remaining workflows share the same base file before deleting it. The frontend's `handleDelete` in [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs) does not pass this flag at all. Update `deleteWorkflow` so that after removing the entry it always checks whether any remaining workflows reference the same `base` filename, and only deletes the physical file if none do. Remove the `deleteBaseFile` parameter from the service and the `?deleteFile` query param from the router accordingly.
