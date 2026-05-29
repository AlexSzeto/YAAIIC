# Workflow Editor Fixes

## Goal

Fix four bugs in the workflow editor, replace the up/down arrow reordering buttons with drag-and-drop, and add a templated inputs feature that lets users stamp pre-configured Extra Input definitions from a config-driven library.

## Tasks

### Phase 1 — Bug Fixes

- [ ] Fix rename-after-upload creating a duplicate workflow entry
- [ ] Fix subgraph relay nodes being incorrectly imported as Extra Inputs: skip all nodes whose ID contains `:` across all detection passes; also skip any typed primitive whose `inputs.value` is a link array
- [ ] Fix auto-detected parameter defaults displaying commas instead of periods for decimal numbers
- [ ] Fix formula replacement inputs rejecting the minus (`-`) and period (`.`) characters

### Phase 2 — Drag-and-Drop Reordering

- [ ] Replace the up/down arrow buttons in the workflow list modal with drag-and-drop reordering; preserve the `PUT /api/workflows/reorder` persistence call on drop

### Phase 3 — Templated Extra Inputs

- [ ] Add `workflowInputTemplates` (array of `extraInput` objects, default `[]`) to `server/config.default.json`
- [ ] Add `GET /api/workflows/input-templates` endpoint that returns the config value
- [ ] In the editor, load templates on mount and store in state; hide the feature entirely when the list is empty
- [ ] Add a `headerActions` "Use template" button (icon `arrow-in-down-square-half`) to the Extra Inputs `DynamicList` that opens a searchable single-select modal listing template labels
- [ ] On template selection, replace the target Extra Input item with a shallow copy of the chosen template

## Implementation Details

### Bug 1 — Rename after upload creates a duplicate

**Root cause:** The upload handler in `server/features/workflows/router.mjs` (lines 99–108) writes the workflow directly to `comfyui-workflows.json` without assigning a `uid`. It does a name-based lookup to detect duplicates, which is correct at upload time, but the saved entry has no `uid`. When the client later renames and saves via `POST /api/workflows` → `saveWorkflow()`, the service looks up by `uid`, finds nothing (uid is absent), and pushes a new entry instead of updating the original.

**Fix:** In the upload handler, generate and assign a `uid` before writing:
```js
import { randomUUID } from 'crypto';

// Before writing:
workflow.uid = randomUUID();
```
The upload handler should still write directly (bypassing validation — the workflow isn't fully configured yet), but the `uid` must be present so subsequent saves by `saveWorkflow()` can locate the record.

### Bug 2 — Subgraph relay nodes imported as Extra Inputs

**Root cause (two-part):**

ComfyUI embeds subgraph nodes in the same flat JSON as top-level nodes, distinguished only by their ID: subgraph node IDs contain a colon (`"52:31"`, `"52:35"`, `"52:36"`), while top-level node IDs do not (`"59"`, `"60"`, `"61"`). `autoDetectWorkflow` (`server/features/workflows/service.mjs`) iterates over all nodes without filtering by ID format, so subgraph-internal typed primitives are treated as user-configurable inputs.

Concretely: nodes `52:31` (PrimitiveStringMultiline), `52:35` (PrimitiveBoolean), and `52:36` (PrimitiveFloat) are relay nodes inside subgraph `52` that receive their values from the top-level primitives `59`, `60`, and `61` via links. Because they have class types in `typedPrimitiveClasses`, the third pass picks them up and creates duplicate extra inputs and replace mappings for them.

A secondary issue: `inputs.value` for linked inputs is stored as `[nodeId, outputIndex]` (e.g. `["59", 0]`), not as a primitive value, and this is not checked before creating an extra input.

**Fix — primary (exclude subgraph nodes):** Add a guard at the top of each detection pass loop to skip any node whose ID contains `:`:

```js
function isSubgraphNode(nodeId) {
  return nodeId.includes(':');
}

// In every pass:
for (const [nodeId, node] of Object.entries(workflowJson)) {
  if (isSubgraphNode(nodeId)) continue;
  // ... existing logic
}
```

**Fix — secondary (skip linked values):** In the third pass and sixth pass, also skip nodes where the value is a ComfyUI link reference before creating an extra input:

```js
function isComfyLink(v) {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'number';
}

// Third pass: before pushing to extraInputs
if (isComfyLink(node.inputs?.value)) continue;

// Sixth pass: before creating an extra input from widgets_values[0]
if (isComfyLink(firstWidget)) continue;
```

Apply `isSubgraphNode` to all seven passes. The link check is an additional safety net for edge cases where a top-level primitive's value is linked from another top-level node.

### Bug 3 — Decimal separator comma in auto-detected defaults

**Root cause:** In the sixth pass, float defaults are stored as raw JS numbers (e.g. `1.5`). The `ExtraInputForm` renders the default field as `String(item.default)`, which in standard JS always produces `"1.5"`. The comma appears when the value passes through a locale-sensitive path — most likely the browser's `<input type="number">` formatting when the OS locale uses a comma as decimal separator.

**Fix:** In `ExtraInputForm` (`public/js/app-ui/workflow-editor/workflow-editor.mjs`), format the default value for number-type inputs using a locale-neutral conversion:
```js
value=${item.default !== undefined
  ? (item.type === 'number' ? String(item.default).replace(',', '.') : String(item.default))
  : ''}
```
Also ensure the `onInput` handler for the default field parses the incoming string with `parseFloat` (which accepts both `.` and `,` via `replace`) rather than relying on the browser's locale.

### Bug 4 — Formula inputs rejecting `-` and `.`

**Root cause:** In `task-form.mjs`, the math formula inputs likely use `type="number"` or apply an `onInput` filter that strips non-numeric characters before the user finishes typing. Minus and period are valid intermediate states during number entry (e.g. the user types `-` before `0.5`, or `.` before `5`).

**Fix:** Change the affected inputs to `type="text"` with `inputmode="decimal"` so the browser shows a numeric keyboard on mobile but does not strip partial input. Validate/coerce the value on `onBlur` rather than on every keystroke.

### Enhancement — Drag-and-drop list reordering

The workflow list modal currently uses up/down arrow icon buttons (`handleMoveWorkflow` with `direction ±1`). Replace these with drag handles on each list item using the existing `DynamicList` drag-and-drop support (if available) or a lightweight HTML5 drag API. On drop, call `PUT /api/workflows/reorder` with the new order — the same call `handleMoveWorkflow` already makes. Remove the up/down action buttons from the `itemActions` array once drag-and-drop is wired.

### Feature — Templated Extra Inputs

#### Config shape

Add `workflowInputTemplates` to `server/config.default.json` as a top-level key defaulting to an empty array. Each entry is a valid `extraInput` object (same shape as items in `workflow.options.extraInputs`):

```json
"workflowInputTemplates": [
  { "id": "cfg_scale", "type": "number", "label": "CFG Scale", "default": 7, "options": [] },
  { "id": "steps",     "type": "number", "label": "Steps",     "default": 20, "options": [] }
]
```

#### Server endpoint

Add `GET /api/workflows/input-templates` to `server/features/workflows/router.mjs`. It reads `workflowInputTemplates` from `req.app.locals.config` (or `getConfig()`) and returns `{ templates }`. If the key is absent or empty, returns `{ templates: [] }`. Register the route before the `/:name` catch-all.

#### Editor — loading templates

In `WorkflowEditor`, load templates on mount alongside `loadWorkflowList()` and `loadBaseFiles()`:

```js
const [inputTemplates, setInputTemplates] = useState([]);

async function loadInputTemplates() {
  try {
    const res = await fetch('/api/workflows/input-templates');
    if (res.ok) setInputTemplates((await res.json()).templates || []);
  } catch { /* non-critical */ }
}

useEffect(() => {
  loadWorkflowList();
  loadBaseFiles();
  loadInputTemplates();
}, []);
```

#### Editor — "Use template" button in Extra Inputs

Add a `templatePickerIndex` state (number | null) and a `templatePickerOpen` boolean. Pass `headerActions` to the Extra Inputs `DynamicList`:

```js
headerActions=${inputTemplates.length > 0 ? [{
  icon: 'arrow-in-down-square-half',
  title: 'Use template',
  onClick: (_item, index) => {
    setTemplatePickerIndex(index);
    setTemplatePickerOpen(true);
  },
}] : []}
```

When `templatePickerOpen` is true, render a `ListSelectModal` (or `SearchSelectModal` if one exists) with:
- `title="Input Templates"`
- `items` mapped from `inputTemplates` as `{ id: index, label: template.label }`
- `onSelectItem`: replace the Extra Input at `templatePickerIndex` with a shallow copy of the selected template, then close the modal

```js
onSelectItem=${({ id }) => {
  const template = inputTemplates[id];
  const next = [...(workflow.options?.extraInputs || [])];
  next[templatePickerIndex] = { ...template };
  updateOptions({ extraInputs: next });
  setTemplatePickerOpen(false);
  setTemplatePickerIndex(null);
}}
```

Hide the button (pass `headerActions={[]}`) when `inputTemplates` is empty so no dead UI appears for users who haven't configured any templates.
