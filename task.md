
# Workflow Editor - Auto-detection Fixes and New Features

## Goals
Fix the remaining auto-detection bug for typed primitive nodes, complete the `easy saveText` detection for `extractOutputTexts`, and add new workflow editor capabilities: selecting a base file from available files on disk and duplicating existing workflows.

## Tasks

- [ ] In the workflow pre/post generation task configuration, the LLM task model selection should be a select input with the list of models currently installed on ollama as its options. This requires a new endpoint that fetches the list of ollama models. Put the base functionality into llm.mjs since it will be used to validate the existance of LLM models during workflow execution at a later time.
- []
- [x] **Convert the workflow selection panel into a `ListSelectModal`**: Replace the inline workflow list panel in [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs) with a modal, and extend [list-select.mjs](public/js/custom-ui/overlays/list-select.mjs) with new capabilities to support it. This task has three parts:

  **Part A – Refactor `list-select.mjs`**:
  - **Remove** the `showActions`, `onEdit`, and `onDelete` props from `ListSelectModal`, `ListItem`, and `showListSelect` entirely. `itemActions` replaces them as the sole mechanism for per-item action buttons.
  - **Add `itemActions` prop** to `ListSelectModal` and `showListSelect` – an array of `{ icon: string, color?: string, title?: string, onClick: (item) => void, closeAfter?: boolean }`. `ListItem` renders one `Button` per entry using `variant="small-icon"`, the given `icon` and `color`. `onClick` receives the item. If `closeAfter: true` the modal closes after the callback returns. When `itemActions` is absent or empty, no action buttons are rendered.
  - **Add `variant` prop** (`'default'` | `'narrow'`) to `ListSelectModal` and `showListSelect`. `'default'` keeps the existing 500px width; `'narrow'` sets it to 340px. Pass through to `ModalWrapper`.
  - **Fix `emptyMessage` prop**: the current template hardcodes `"No items available"` and ignores the prop. Replace with `this.props.emptyMessage || 'No items available'`.
  - **Update [folder-select.mjs](public/js/app-ui/folder-select.mjs)**: replace `showActions: true, onEdit: ..., onDelete: ...` with an `itemActions` array: `[ { icon: 'edit', title: 'Rename', onClick: async (item) => { <existing rename logic> }, closeAfter: false }, { icon: 'trash', color: 'danger', title: 'Delete', onClick: async (item) => { <existing delete logic> }, closeAfter: false } ]`. Both use `closeAfter: false` because they re-open the modal themselves after completing.
  - **Update [test.html](public/js/custom-ui/test.html)**: replace the `showActions: true, onEdit: ..., onDelete: ...` call with `itemActions: [ { icon: 'edit', title: 'Edit', onClick: (item) => console.log('Edit:', item) }, { icon: 'trash', color: 'danger', title: 'Delete', onClick: (item) => console.log('Delete:', item) } ]`. Add a new example demonstrating the `variant: 'narrow'` prop.

  **Part B – Add `eye-slash` icon to [icon.mjs](public/js/custom-ui/layout/icon.mjs)**:
  - Add `'eye-slash': 'visibility_off'` to the icon map in the Verified section.

  **Part C – Update [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs)**:
  - **Remove** the entire `WorkflowListPanel` `<Panel>` block (the "Workflows" section containing the list, badges, and upload button/input). Its responsibilities move into the modal.
  - **Add `isModalOpen` state** (initially `false`). Use this to drive an inline `<ListSelectModal>` rendered at the bottom of the `PageRoot` JSX so the component re-renders with the latest `workflowList` after deletes or uploads.
  - **Add an "Open" button** to the page header `<div>`, between `HamburgerMenu` and `H1`, using `variant="medium-icon-text"`, `icon="folder"`, `color="secondary"`, label `"Open"`. Its `onClick` sets `isModalOpen = true`.
  - **Move the hidden file input** (for upload) to be a sibling of the `<ListSelectModal>` (not inside the removed panel). Keep the same `fileInputRef` and `onChange` handler.
  - **Add `handleDuplicate(name)` function**: fetch the full workflow via `GET /api/workflows/:name`, strip any trailing `" (copy)"` or `" (copy \d+)"` suffix from the name and append `" (copy)"` to form the copy name, call `setWorkflow({ ...fetchedWorkflow, name: copyName })`, then fetch `GET /api/workflows/base-files/:filename` for the base JSON and call `setWorkflowJson(json)`. The copy loads into the editor unsaved.
  - **Derive a `getWorkflowIcon(wf)` helper** (pure function, no state): returns `'eye-slash'` if `wf.hidden`, else `'video'` if `wf.type === 'video'`, `'music'` if `wf.type === 'audio'`, `'image'` otherwise.
  - **Render `<ListSelectModal>`** inline with:
    - `isOpen=${isModalOpen}`, `onClose=${() => setIsModalOpen(false)}`
    - `title="Workflows"`, `variant="narrow"`
    - `items`: `workflowList.map(wf => ({ id: wf.name, label: wf.name, icon: getWorkflowIcon(wf) }))`
    - `selectedId=${workflow?.name}`
    - `onSelectItem=${(item) => { loadWorkflow(item.id); setIsModalOpen(false); }}`
    - `itemActions`: `[ { icon: 'copy', title: 'Duplicate', onClick: (item) => handleDuplicate(item.id), closeAfter: true }, { icon: 'edit', title: 'Edit', onClick: (item) => { loadWorkflow(item.id); }, closeAfter: true }, { icon: 'trash', color: 'danger', title: 'Delete', onClick: (item) => handleDelete(item.id), closeAfter: false } ]`
    - `actionLabel="Upload"`, `onAction=${() => fileInputRef.current?.click()}`
    - `emptyMessage`: `listLoading ? 'Loading…' : 'No workflows yet. Click Upload to get started.'`

- [x] **Auto-detect typed primitive nodes (`PrimitiveString`, `PrimitiveStringMultiline`, `PrimitiveInt`, `PrimitiveFloat`, `PrimitiveBoolean`) in `autoDetectWorkflow`**: Add a new early detection pass in [service.mjs](server/features/workflows/service.mjs) that iterates over all nodes before the existing `PrimitiveNode` passes. For each typed primitive node, check `_meta.title` (case-insensitively) against `"Name"`, `"Prompt"`, and `"Seed"`. If matched, add the corresponding replace binding (`{ from: 'name'|'prompt'|'seed', to: [nodeId, 'inputs', 'value'] }`) and skip further processing of that node. For unmatched typed primitives, create an `extraInputs` entry with the correct input type (`text` for `PrimitiveString`/`PrimitiveStringMultiline`, `number` for `PrimitiveInt`/`PrimitiveFloat`, `checkbox` for `PrimitiveBoolean`) and add a replace mapping pointing to `[nodeId, 'inputs', 'value']`. After testing, `prompt` and `seed` processed correctly but not unmatched node such as `Width` and `Height`

- [x] **Auto-detect other `easy saveText` nodes for `extractOutputTexts` post-task**: In `autoDetectWorkflow` in [service.mjs](server/features/workflows/service.mjs), after detecting the `video-filename` save-text node, scan remaining `easy saveText` nodes whose `inputs.file_name` matches one of the known data property names: `tag`, `prompt`, `description`, `summary`. Collect all matches and add a single post-generation task `{ process: 'extractOutputTexts', parameters: { properties: [...matchedNames] } }` if any are found.

- [x] **Add `GET /api/workflows/base-files` endpoint**: In [service.mjs](server/features/workflows/service.mjs), add a `listBaseFiles()` function that reads all `.json` filenames from `COMFYUI_WORKFLOWS_DIR` and returns them as a sorted array. In [router.mjs](server/features/workflows/router.mjs), mount `GET /api/workflows/base-files` (before any `/:name` routes to avoid shadowing) returning `{ files: [...filenames] }`.

- [x] **Add `GET /api/workflows/base-files/:filename` endpoint**: In [router.mjs](server/features/workflows/router.mjs), add a `GET /api/workflows/base-files/:filename` route (mounted before `/:name`) that reads the named `.json` file from `COMFYUI_WORKFLOWS_DIR` and returns its parsed JSON. Reject filenames that contain path traversal characters (e.g. `..` or `/`). This lets the frontend load the raw ComfyUI JSON for any available base file independently of a named workflow entry.

- [x] **Replace Base file `Input` with a `Select` in `BasicInfoForm`**: In [workflow-editor.mjs](public/js/app-ui/workflow-editor.mjs):
  - Add a `baseFiles` state to `WorkflowEditor` (array of filename strings). Fetch it from `GET /api/workflows/base-files` on mount and after every upload. Pass `baseFiles` and a `onBaseChange` callback as props to `BasicInfoForm`.
  - In `BasicInfoForm`, replace the disabled `Input` for "Base file" with a `Select` whose options are built from `baseFiles` (label and value both equal to the filename). Keep the `style={{ maxWidth: '200px' }}` sizing.
  - When the user picks a different base file, update `workflow.base` via `onChange` and fetch the new raw JSON from `GET /api/workflows/base-files/:filename` to replace `workflowJson` in the parent. Wire this fetch through the `onBaseChange(filename)` callback so `WorkflowEditor` handles the fetch and state update.


## Implementation Details
