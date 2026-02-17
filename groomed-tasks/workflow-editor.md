# Workflow Import and Edit UI

## Goal

Create a comprehensive workflow management interface that allows users to upload ComfyUI workflow JSON files, automatically detect common patterns, and configure all workflow properties through a dedicated editor UI. The system should parse uploaded workflows to identify inputs, outputs, seeds, and prompts, generate suggested mappings, and provide specialized form interfaces for managing pre/post-generation tasks, replace mappings, extra inputs, and conditional logic.

## Tasks

- [ ] Create backend API endpoint `GET /api/workflows/:name` to fetch a specific workflow configuration by name
- [ ] Create backend API endpoint `POST /api/workflows/upload` to handle ComfyUI JSON file uploads with auto-detection logic
- [ ] Implement workflow auto-detection service that identifies: image/audio load nodes, seed nodes, prompt nodes (string primitives, CLIP text), output nodes (JWImageSaveToPath, JWAudioSaveToPath), and primitive String/Int/Float nodes for extra inputs
- [ ] Implement workflow name parser that converts filename format `modelname-source-to-dest.json` to display name format `Source to Dest (Modelname)`
- [ ] Create backend API endpoint `POST /api/workflows` to save/update workflow configuration in comfyui-workflows.json with validation (requires at least one prompt, seed, and output binding)
- [ ] Create backend API endpoint `DELETE /api/workflows/:name` to remove a workflow and its associated base JSON file
- [ ] Create new HTML page `workflow-editor.html` with basic page structure and stylesheet imports
- [ ] Create hamburger menu component in `public/js/app-ui/` that appears in top-right corner of all pages (index.html, inpaint.html, workflow-editor.html)
- [ ] Create context menu variant of list-select UI component for the hamburger menu dropdown
- [ ] Implement hamburger menu link to navigate to workflow editor page
- [ ] Create workflow list selection panel component based on list-select UI with upload button integrated inside the panel
- [ ] Implement file upload handling in workflow list panel that triggers auto-detection endpoint and loads result into editor
- [ ] Create basic workflow editor form structure with vertical layout sections: basic info, extra inputs, pre-generation tasks, replace mappings, post-generation tasks, and save button
- [ ] Implement basic info section form fields: name (text), type (select: image/video/audio/inpaint), hidden (checkbox), autocomplete (checkbox), inputImages (number), inputAudios (number), optionalPrompt (checkbox), nameRequired (checkbox), orientation (select: portrait/landscape/detect)
- [ ] Create reusable DynamicList custom UI component in `public/js/custom-ui/` that accepts a Preact render function for generating subcomponents, manages state for add/delete/reorder operations, renders add button at top of section, and wraps each item in a collapsible panel with controls (up/down/collapse/delete)
- [ ] Implement extra inputs dynamic list with sub-form for each item: id, type (text/number/select/checkbox/textarea), label, default value, and options array (for select type)
- [ ] Create ComfyUI node search autocomplete component that searches nodes by ID, name, and class type from uploaded workflow JSON
- [ ] Create node input selector hover panel component that displays node title and clickable list of input properties
- [ ] Implement replace mappings dynamic list with sub-forms: from field (text input), to field (node input selector), and optional condition
- [ ] Implement pre-generation tasks dynamic list with task type dropdown (template/from/model) and dynamic form fields
- [ ] Create template task sub-form: template (textarea with {{variable}} support), to (text), optional condition
- [ ] Create value copy task sub-form: from (text), to (text), optional condition
- [ ] Create LLM task sub-form: model (text), imagePath (text), prompt (textarea), to (text), optional condition
- [ ] Implement post-generation tasks dynamic list with same task types as pre-generation plus executeWorkflow process type
- [ ] Create executeWorkflow task sub-form: process ("executeWorkflow"), name (text), workflow (text), parameters (inputMapping and outputMapping arrays), optional condition
- [ ] Create condition builder component with AND/OR toggle and dynamic condition list
- [ ] Implement condition item sub-form: where source (dropdown: data/generationData), field name (text), equals value (text input supporting multiple types)
- [ ] Implement save button with validation that checks for required bindings and shows disabled state with hover tooltip listing missing requirements
- [ ] Integrate toast notification system for success/error messages on save
- [ ] Wire up all form sections to workflow state management and implement two-way data binding
- [ ] Test workflow upload flow: upload JSON → auto-detect → save → load into form → edit → save changes
- [ ] Test workflow editing flow: open existing workflow → modify all sections → save → verify changes persisted
- [ ] Test workflow deletion flow: select workflow → delete → verify removal from list and filesystem
- [ ] Test validation: attempt to save workflow missing required bindings → verify save button disabled and tooltip shows requirements
- [ ] Add loading states and error handling for all API calls

## Implementation Details

### Backend API Endpoints

All workflow management endpoints should be organized in `server/features/workflows/` following the domain-driven architecture pattern.

**GET /api/workflows/:name**
- Returns the full workflow configuration object from comfyui-workflows.json
- Response format: `{ workflow: {...} }` or 404 if not found

**POST /api/workflows/upload**
- Accepts multipart/form-data with ComfyUI workflow JSON file
- Saves file to `server/resource/` with sanitized filename
- Runs auto-detection to identify common patterns
- Creates initial workflow configuration object with detected mappings
- Auto-sets `hidden: true` by default
- Saves to comfyui-workflows.json
- Returns: `{ workflow: {...}, detectedNodes: {...}, baseFilename: "..." }`

**POST /api/workflows**
- Accepts JSON body with complete workflow configuration
- Validates required fields: name, options.type, base file exists
- Validates required replace mappings: at least one prompt binding, one seed binding, one output path binding
- Updates or creates entry in comfyui-workflows.json
- Returns updated workflow object or validation errors

**DELETE /api/workflows/:name**
- Removes workflow from comfyui-workflows.json
- Optionally deletes associated base JSON file from server/resource/
- Returns success status

### Auto-Detection Logic

The upload endpoint should scan the ComfyUI workflow JSON to identify:

**Input Nodes (for `upload` array)**:
- Nodes with class_type: "LoadImage" → suggests `image_N` mapping
- Nodes with class_type: "LoadAudio" → suggests `audio_N` mapping
- Updates `options.inputImages` and `options.inputAudios` counts

**Seed Nodes (for `replace` array)**:
- Nodes with inputs containing property named "seed"
- Nodes with class_type containing "Seed"
- Suggests mapping: `{ from: "seed", to: [nodeId, "inputs", "seed"] }`

**Prompt Nodes (for `replace` array)**:
- String primitive nodes (class_type: "PrimitiveNode") with widget "STRING" or "STRING_ML"
- Nodes with class_type: "CLIPTextEncode" → check inputs.text source
- Suggests mapping: `{ from: "prompt" or "enhancedPrompt", to: [nodeId, "inputs", propertyName] }`

**Output Nodes (for `replace` array)**:
- Nodes with class_type: "JWImageSaveToPath" → `{ from: "saveImagePath", to: [nodeId, "inputs", "path"] }`
- Nodes with class_type: "JWAudioSaveToPath" → `{ from: "saveAudioPath", to: [nodeId, "inputs", "path"] }`

**Extra Input Candidates (for `options.extraInputs`)**:
- Primitive nodes (PrimitiveNode) with types: STRING, INT, FLOAT, BOOLEAN
- Exclude nodes already mapped as prompt/seed
- Suggest: `{ id: nodeTitle or "param_N", type: inferredType, label: nodeTitle, default: currentValue }`

**Workflow Type Detection**:
- If has LoadImage nodes and mask inputs → suggest type: "inpaint"
- If has JWAudioSaveToPath → suggest type: "audio"
- If has video-related nodes → suggest type: "video"
- Default to type: "image"

### Name Parsing Rules

Filename format: `{model}-{source}-to-{dest}.json`
Display format: `{Source} to {Dest} ({Model})`

Examples:
- `illustrious-text-to-image.json` → `Text to Image (Illustrious)`
- `flux-image-to-video.json` → `Image to Video (Flux)`
- `qwen-audio-to-text.json` → `Audio to Text (Qwen)`

Algorithm:
1. Remove `.json` extension
2. Split on `-to-` to get [before, after]
3. Split before on first `-` to get [model, source]
4. Capitalize each word in source and after
5. Format as `{Source} to {After} ({Model})`

### Frontend Component Structure

**Page**: `public/workflow-editor.html`
- Similar structure to index.html and inpaint.html
- Loads App.mjs with workflow editor mode

**Main Component**: `public/js/app-ui/WorkflowEditor.mjs`
- Manages workflow state (current workflow object)
- Renders form sections vertically
- Handles save/load/upload operations

**Sub-Components**:
- `WorkflowListPanel.mjs` - List selection with upload button
- `HamburgerMenu.mjs` - Global navigation menu
- `BasicInfoForm.mjs` - Top section with core workflow properties
- `ExtraInputsList.mjs` - Dynamic list for options.extraInputs
- `PreGenTasksList.mjs` - Dynamic list for preGenerationTasks
- `ReplaceMapList.mjs` - Dynamic list for replace mappings
- `PostGenTasksList.mjs` - Dynamic list for postGenerationTasks
- `NodeInputSelector.mjs` - Autocomplete + hover panel for node selection
- `TaskForm.mjs` - Polymorphic task form based on type
- `ConditionBuilder.mjs` - AND/OR logic with condition list
- `DynamicList.mjs` - Reusable template for all dynamic lists

### Form Validation

The save button should be disabled when:
- Workflow name is empty
- No workflow type selected
- Base file doesn't exist
- Missing required replace bindings:
  - At least one mapping with `from: "prompt"` or variant
  - At least one mapping with `from: "seed"`
  - At least one mapping with `from: "saveImagePath"` or `"saveAudioPath"` depending on type

Hover tooltip on disabled save button should list specific missing requirements.

### Node Input Selector UI Flow

1. User clicks on "to" field in replace mapping
2. Autocomplete input appears searching uploaded workflow nodes
3. Search filters by: node ID (string match), class_type (string match), title (string match)
4. User selects a node from results
5. Hover panel appears showing node's title and list of available inputs
6. User clicks an input name
7. Path is auto-populated as `[nodeId, "inputs", inputName]`
8. Panel closes

### Condition Builder UI

Each condition group has:
- Toggle switch: AND / OR mode (affects top-level logic)
- Add Condition button
- List of condition items, each with:
  - Source dropdown: "data" or "generationData"
  - Field name text input
  - Expected value text input (supports string, number, boolean)
  - Delete button

Resulting JSON structure:
```json
{
  "and": [
    { "where": { "data": "fieldName" }, "equals": { "value": "expectedValue" } }
  ]
}
```

or

```json
{
  "or": [
    { "where": { "generationData": "fieldName" }, "equals": { "value": true } }
  ]
}
```

### Testing Instructions

**Test Workflow Upload**:
1. Navigate to workflow editor page
2. Click workflow list button
3. Click upload button in panel
4. Select a ComfyUI workflow JSON file
5. Verify auto-detection populates form fields
6. Check that basic info shows suggested name
7. Verify replace mappings include detected seeds, prompts, outputs
8. Confirm extra inputs section shows detected primitive nodes
9. Verify workflow is marked as hidden by default

**Test Workflow Editing**:
1. Open workflow list panel
2. Select an existing workflow
3. Modify name field
4. Add a new extra input
5. Add a pre-generation template task
6. Modify a replace mapping target using node selector
7. Add a post-generation LLM task with condition
8. Click save button
9. Verify success toast appears
10. Reload page and verify changes persisted

**Test Validation**:
1. Create or edit a workflow
2. Remove all prompt mappings
3. Verify save button is disabled
4. Hover over save button
5. Verify tooltip shows "Missing required prompt binding"
6. Add prompt mapping back
7. Verify save button becomes enabled

**Test Node Input Selector**:
1. In replace mappings, click "to" field
2. Type node ID or class name in autocomplete
3. Select a node from results
4. Verify hover panel shows node title and inputs
5. Click an input name
6. Verify path array is populated correctly: `["nodeId", "inputs", "inputName"]`

**CURL Test Examples**:

```bash
# Upload workflow
curl -X POST http://localhost:3000/api/workflows/upload \
  -F "workflow=@path/to/workflow.json"

# Get workflow by name
curl http://localhost:3000/api/workflows/Text%20to%20Image%20(Illustrious)

# Save workflow configuration
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workflow","options":{"type":"image"},"base":"test.json","replace":[{"from":"seed","to":["3","inputs","seed"]}]}'

# Delete workflow
curl -X DELETE http://localhost:3000/api/workflows/Test%20Workflow
```
