# Workflow Import and Edit UI - Bug Fixing (Continued)

## Goals
Fix remaining design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws
- The Workflow Editor page is missing the hamburger menu to navigate back to the main page.
- Rename the filename for `/mnt/dev-240/YAAIIC/public/js/custom-ui/nav/hamburger-menu.mjs` to `navigation-menu.mjs`, and rename the component and fix all references.
- For all non textfield inputs, adapt the layout pattern from forms on the main/inpaint page (such as `generation-form.mjs`) and constrain inputs/checkboxes/selects to 200px width.
- For all title text, use custom UI icon (`arrow-right-stroke` box, `arrow_right_alt` google material) instead of the unicode arrow (→).
- For comfyUI nodes, if the node's `_meta.title` is available, use that in addition to the node id. To output the full path of a node, ignore the `input` section of the path. For example, if node "3" has `_meta.title` "Prompt", and we are replacing `3.inputs.text`, the text displayed should be `3 (Prompt) -> text` instead of `3.inputs.text`. The text showing `["3","inputs","text"]` within the UI should be removed. remember to use custom UI icons for the arrow.
- Single object condition (the condition only lists its content instead of creating a `and` or `or` list) is not being parsed. Check for it, and in the editor convert it to an `and` list with a single item in the UI. If saved, this is the format the workflow data would be saved in.
- The condition list item should not contain a select for "data"/"generationData". The only acceptable input is "data". If the schema is incorrectly stating that there are two possibilities for data sources, fix that.
- The condition list item is missing a select to choose between "equals"/"isNot" checks. A select is used here because more types of checks would be added in the future.
- The list of task types is incorrect - it should be "Template fill", "Value copy", "LLM task", "Additional processing", and "Execute workflow". Please review `/mnt/dev-240/YAAIIC/server/features/generation/processors/index.mjs` for a list of processes - hard code these as a constant for the moment, excluding `executeWorkflow` from the list. Review feature item 33 and 34 from the feature-history for an overview of the data structure of these processes.


## Tasks

- [x] Fix `ExtraInputForm` select-type options: change from a comma-separated text input to a `DynamicList` of `{ label, value }` objects, with a sub-form for each option item.

- [x] Add `arrow-right-stroke` to the icon map in `public/js/custom-ui/layout/icon.mjs`, mapping it to the Material Symbol `arrow_right_alt`. Place the entry in the Verified section at the bottom of `ICON_MAP`.

  **Manual test:** Open `public/js/custom-ui/test.html` in a browser. Temporarily add an `<Icon name="arrow-right-stroke" size="24px" />` usage to the test page and confirm the right-arrow icon renders in both Material Symbols and box-icons themes. Remove the temporary addition when done.

- [x] Rename `public/js/custom-ui/nav/hamburger-menu.mjs` to `navigation-menu.mjs`. Rename the exported component `NavPanel` to `NavigationMenu` within that file. Update the import in `public/js/app-ui/hamburger-menu.mjs` to use the new path and component name.

  **Manual test:** Load `index.html` in a browser and confirm the hamburger navigation menu still appears, opens, and navigates correctly.

- [x] Add `HamburgerMenu` to the Workflow Editor page header. In `public/js/app-ui/workflow-editor.mjs`, import `HamburgerMenu` from `'./hamburger-menu.mjs'` and render it inside the existing header `<div>` (the flex row alongside the `H1` title), placed before the title so it appears on the left edge.

  **Manual test:** Navigate to `/workflow-editor.html` and confirm the hamburger menu icon appears in the header. Click it to verify the navigation dropdown opens and that selecting "Home" navigates back to `/`.

- [x] Constrain non-textfield inputs to 200px in `BasicInfoForm`. In `public/js/app-ui/workflow-editor.mjs`, for the Type and Orientation `Select` elements, remove the `fullWidth` prop and add a `style` of `max-width:200px`. Apply the same `max-width:200px` style to the Input Images and Input Audios `Input` (number type) elements. Wrap each `Checkbox` in the checkbox `FormRow` with a `div` styled to `min-width:200px; display:flex; align-items:flex-end;`, matching the `CheckboxWrapper` pattern in `extra-inputs-renderer.mjs`.

  **Manual test:** Open `/workflow-editor.html`, select a workflow, and confirm the Type, Orientation, Input Images, Input Audios, and checkbox inputs are all visually constrained to approximately 200px rather than stretching to fill the row.

- [x] Fix the ComfyUI node path display in the Replace Mappings section. In `public/js/app-ui/workflow-editor.mjs`, update the `getTitle` callback for the Replace Mappings `DynamicList` so that when `item.to` is a valid three-element array, the label reads `nodeId (Node Title) → inputName`, where Node Title comes from `workflowJson[nodeId]?._meta?.title ?? workflowJson[nodeId]?.class_type ?? nodeId`, and `inputName` is `item.to[2]` (the `inputs` segment at index 1 is omitted from the display). Also remove the `<div>` in `ReplaceMappingForm` that renders `${toDisplay}` (the raw JSON array string) below the `NodeInputSelector` dropdowns.

  **Manual test:** Open `/workflow-editor.html` and select a workflow that has replace mappings bound to ComfyUI nodes. Expand a replace mapping item and verify: (a) the DynamicList item header shows `nodeId (Node Title) → inputName` instead of the dot-joined path; (b) there is no JSON array string rendered below the node selector dropdowns.

- [x] Replace unicode `→` separators in all DynamicList `getTitle` callbacks with the `Icon` component. In `public/js/app-ui/workflow-editor.mjs`, import `Icon` from `'../custom-ui/layout/icon.mjs'` and update every `getTitle` function that currently uses a `→` character (Pre-generation Tasks, Post-generation Tasks, and Replace Mappings) to return an `html` template that uses `<${Icon} name="arrow-right-stroke" size="14px" />` in place of the arrow character. In `public/js/app-ui/task-form.mjs`, import `Icon` and apply the same change to the Input Mappings and Output Mappings `getTitle` callbacks inside `ExecuteWorkflowTaskForm`.

  **Manual test:** Open `/workflow-editor.html`, load a workflow with pre/post-generation tasks and replace mappings. Expand any DynamicList item and confirm the separator in the item header is a rendered arrow icon rather than the `→` character. Verify the same for the mapping lists inside an Execute Workflow task.

- [x] Fix single-object condition parsing in `ConditionBuilder`. In `public/js/app-ui/condition-builder.mjs`, add a normalization step at the top of `ConditionBuilder` that detects a bare condition object (one that has a `where` key but lacks an `and` or `or` wrapper) and wraps it as `{ and: [value] }` before deriving `mode` and `conditions`.

  **Manual test:** Directly edit a workflow JSON file on disk (e.g., in `server/database/`) and set a replace mapping's `condition` to a bare single-object form such as `{ "where": { "data": "someField" }, "equals": { "value": "test" } }`. Reload `/workflow-editor.html`, select that workflow, open the affected replace mapping, and verify the condition section displays one item in an AND group with the correct field name and value pre-filled.

- [x] Remove the `generationData` source option from `ConditionItem`. In `public/js/app-ui/condition-builder.mjs`, delete the `SOURCE_OPTIONS` array and replace the `Select` for the data source in `ConditionItem` with a plain styled text label that reads `data`. Update the `updateCondition` calls in `ConditionItem` to always write `{ where: { data: fieldName } }` regardless of any prior source value.

  **Manual test:** Open `/workflow-editor.html`, open a replace mapping, and click the "+" button to add a condition. Confirm there is no data-source dropdown — only the static `data` label and the field name input are visible on each condition row.

- [x] Add an "equals"/"is not" check type selector to `ConditionItem`. In `public/js/app-ui/condition-builder.mjs`, replace the static `<span>equals</span>` in `ConditionItem` with a `Select` offering `{ label: 'equals', value: 'equals' }` and `{ label: 'is not', value: 'isNot' }`. Determine the current check type by testing whether `condition.equals` is defined (→ `'equals'`) or `condition.isNot` is defined (→ `'isNot'`). When the user changes the check type, preserve the current value and re-emit it under the newly selected key (e.g., switching from `equals` to `isNot` moves `condition.equals.value` to `condition.isNot.value`).

  **Manual test:** Open `/workflow-editor.html`, open a replace mapping, add a condition item, and confirm a "equals"/"is not" dropdown appears between the field name and value inputs. Switch between the two options, then save the workflow and inspect the JSON on disk to confirm the correct key (`equals` or `isNot`) is stored.

- [x] Add "Additional processing" task type to `TaskForm`. In `public/js/app-ui/task-form.mjs`:
  - Define the `ADDITIONAL_PROCESSORS` constant (see Implementation Details).
  - Update `getTaskType` to return `'additionalProcessing'` when `task.process` matches any value in `ADDITIONAL_PROCESSORS`.
  - Insert `{ value: 'additionalProcessing', label: 'Additional processing' }` into both `TASK_TYPE_OPTIONS` and `TASK_TYPE_OPTIONS_WITH_EXECUTE`, placed after "LLM task".
  - Create an `AdditionalProcessingTaskForm` sub-component with a Select for the processor name and dynamic parameter fields per processor (see Implementation Details).
  - Add `additionalProcessing: { process: 'extractOutputMediaFromTextFile', parameters: {} }` to `BLANK_TASKS`.
  - Update `convertTaskType` to handle conversions to and from `'additionalProcessing'`.

  **Manual test:** Open `/workflow-editor.html`, select a workflow, expand Post-generation Tasks, and add a task. Select "Additional processing" from the task type dropdown. Verify a processor selector appears. Cycle through all three processors and confirm the parameter fields change to match each one. Save the workflow and inspect the JSON on disk to confirm the `process` and `parameters` keys are saved correctly.

## Implementation Details

### select-type extra input options schema
Each item in the `options` array is an object: `{ label: string, value: string }`.
The `Select` component from `custom-ui/io/select.mjs` already accepts this format.

### Additional Processors Constant
```js
const ADDITIONAL_PROCESSORS = [
  { value: 'extractOutputMediaFromTextFile', label: 'Extract output media from text file' },
  { value: 'crossfadeVideoFrames',           label: 'Crossfade video frames' },
  { value: 'extractOutputTexts',             label: 'Extract output texts' },
];
```

### Additional Processing Task Data Format
Each processor uses `process` (the registry key) and `parameters` (processor-specific fields):
```js
// extractOutputMediaFromTextFile
{ process: 'extractOutputMediaFromTextFile', parameters: { filename: '' } }

// crossfadeVideoFrames
{ process: 'crossfadeVideoFrames', parameters: { blendFrames: 10 } }

// extractOutputTexts – properties is a string[]
{ process: 'extractOutputTexts', parameters: { properties: [] } }
```
For `extractOutputTexts`, render `parameters.properties` as a `DynamicList` where each item is a plain string. Use `createItem: () => ''` and `getTitle: (item) => item || 'Property name'`, and render each item as a full-width `Input` that updates the string directly in the array.

### Condition Check Type Schema
- Equals: `{ where: { data: 'fieldName' }, equals: { value: <any> } }`
- Is not: `{ where: { data: 'fieldName' }, isNot: { value: <any> } }`
