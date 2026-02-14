# Nested Workflows and Remove Background Post-Generation Process

## Goal

Enable workflows to execute other workflows as post-generation tasks, allowing chained transformations where one workflow's output can be automatically processed by another workflow. This includes adding a "remove background" post-generation process that can be configured through the workflow system.

## Implementation Details

### Task Naming for Progress Events

All pre-generation and post-generation tasks support an optional `name` parameter to control the display name in SSE progress events:

```json
{
  "process": "executeWorkflow",
  "name": "Removing background",
  "parameters": { /* ... */ }
}
```

**Default Naming Behavior (when `name` is not provided):**
- **Process tasks**: `"Processing {processName}"` (e.g., "Processing executeWorkflow")
- **Prompt tasks**: `"Analyzing image"` (when `to` is "description"), otherwise `"Generating {to}"` (e.g., "Generating summary")
- **Template/data copy tasks**: No progress tracking (not counted as steps)

**Custom Naming:**
- When `name` is provided, it replaces the default name in progress events
- The name appears in both start events (`"{name}..."`) and completion events (`"{name} complete"`)
- Applies to both `preGenerationTasks` and `postGenerationTasks`

### Process Configuration Format

The new `executeWorkflow` process will be defined in `postGenerationTasks` with the following structure:

```json
{
  "process": "executeWorkflow",
  "name": "Removing background",
  "condition": {
    "where": { "data": "removeBackground" },
    "equals": { "value": true }
  },
  "parameters": {
    "workflow": "Remove Background (RMBG)",
    "inputMapping": [
      {
        "image": "generated",
        "toMediaInput": 0
      },
      {
        "from": "summary",
        "to": "image_0_summary"
      },
      {
        "from": "description",
        "to": "image_0_description"
      },
      {
        "from": "tags",
        "to": "image_0_tags"
      }
    ],
    "outputMapping": [
      {
        "from": "summary",
        "to": "summary"
      },
      {
        "from": "tags",
        "to": "tags"
      }
    ]
  }
}
```

### Input Mapping Types

**Text Field Mapping:**
```json
{ "from": "sourceField", "to": "targetField" }
```

**Image Mapping:**
```json
{ "image": "imageKey|generated", "toMediaInput": 0 }
```
- `"generated"` keyword references the current workflow's output image
- `toMediaInput` specifies the media input index (0-based)
- Creates all associated metadata fields: `image_N`, `image_N_description`, `image_N_summary`, `image_N_tags`, `image_N_name`, `image_N_uid`, `image_N_imageFormat`

**Audio Mapping:**
```json
{ "audio": "audioKey|generated", "toMediaInput": 0 }
```
- Similar structure to image mapping
- Creates: `audio_N`, `audio_N_description`, `audio_N_summary`, `audio_N_tags`, `audio_N_name`, `audio_N_uid`

### Output Mapping

**Text Field Mapping:**
```json
{ "from": "nestedWorkflowField", "to": "originalGenerationField" }
```
- Overwrites the original generation's field with the nested workflow's output

**Media Mapping:**
- Automatic: Generated image/audio files automatically update `imageUrl`/`audioUrl` in the original generation data
- No explicit mapping needed

### Execution Behavior

1. **Validation Before Execution:**
   - Before any workflow starts, scan all `postGenerationTasks` for `executeWorkflow` processes
   - For each found, validate that the target workflow exists
   - Recursively check target workflows to ensure they do NOT contain any `executeWorkflow` processes
   - Fail immediately if any nested workflow contains `executeWorkflow` (nesting limited to one level)

2. **Nested Workflow Execution:**
   - Progress counts as a single step in parent workflow
   - Executes all pre-generation and post-generation tasks of the nested workflow
   - Nested workflow's generation is NOT saved to database (invisible)
   - Failure in nested workflow causes parent workflow to fail
   - Files are never deleted (both original and nested outputs are preserved)

3. **Data Flow:**
   - Input mapping transforms parent data into nested workflow request
   - Nested workflow executes with mapped data
   - Output mapping applies nested results back to parent data
   - Changes are immediately available for subsequent post-generation tasks
   - Multiple `executeWorkflow` processes can chain transformations

### Example: Remove Background Workflow

Add to "Text to Image (Illustrious Characters)" workflow:

```json
{
  "name": "Text to Image (Illustrious Characters)",
  "options": {
    "type": "image",
    "autocomplete": true,
    "inputImages": 0,
    "optionalPrompt": false,
    "nameRequired": false,
    "orientation": "portrait",
    "extraInputs": [
      {
        "id": "imageFormat",
        "type": "select",
        "label": "Image Format",
        "default": "png",
        "options": [
          { "label": "PNG", "value": "png" },
          { "label": "JPG", "value": "jpg" }
        ]
      },
      {
        "id": "usePostPrompts",
        "type": "checkbox",
        "label": "Use Post-Gen Prompts",
        "default": false
      },
      {
        "id": "removeBackground",
        "type": "checkbox",
        "label": "Remove Background",
        "default": false
      }
    ]
  },
  "postGenerationTasks": [
    {
      "process": "executeWorkflow",
      "name": "Removing background",
      "condition": {
        "where": { "data": "removeBackground" },
        "equals": { "value": true }
      },
      "parameters": {
        "workflow": "Remove Background (RMBG)",
        "inputMapping": [
          {
            "image": "generated",
            "toMediaInput": 0
          },
          {
            "from": "summary",
            "to": "image_0_summary"
          },
          {
            "from": "tags",
            "to": "image_0_tags"
          },
          {
            "from": "name",
            "to": "name"
          }
        ],
        "outputMapping": []
      }
    }
  ]
}
```

This workflow adds a "Remove Background" checkbox to the UI. When checked, it automatically executes the Remove Background workflow after the main image generation completes, passing the generated image and metadata to the RMBG workflow. The progress event will show "Removing background..." instead of "Processing executeWorkflow...".

**Custom Task Naming Examples:**

Process task with custom name:
```json
{
  "process": "crossfadeVideoFrames",
  "name": "Blending Frames",
  "parameters": { "blendFrames": 10 }
}
```
Progress: "Blending loop frames..." → "Blending loop frames complete"

Prompt task with custom name:
```json
{
  "model": "gemma3:4b",
  "name": "Describing scene details",
  "imagePath": "saveImagePath",
  "prompt": "Generating Description",
  "to": "description"
}
```
Progress: "Describing scene details..." → "Describing scene details complete"

Prompt task without custom name (default):
```json
{
  "model": "gemma3:4b",
  "imagePath": "saveImagePath",
  "prompt": "Describe the image...",
  "to": "description"
}
```
Progress: "Analyzing image..." → "Analyzing image complete"

**Optional: Making it Conditional**

To make background removal optional via a user checkbox:

```json
{
  "id": "removeBackground",
  "type": "checkbox",
  "label": "Remove Background",
  "default": false
}
```

Then add a condition to the executeWorkflow task:

```json
{
  "process": "executeWorkflow",
  "name": "Removing background",
  "condition": {
    "where": { "data": "removeBackground" },
    "equals": { "value": true }
  },
  "parameters": {
    "workflow": "Remove Background (RMBG)",
    "inputMapping": [ /* ... */ ],
    "outputMapping": []
  }
}
```

### Test Commands

**Test Remove Background Nested Workflow:**
```powershell
curl -X POST http://localhost:3000/api/generate `
  -H "Content-Type: application/json" `
  -d '{
    "workflow": "Text to Image (Illustrious Characters)",
    "prompt": "a cute cat sitting on a windowsill",
    "seed": 12345,
    "imageFormat": "png",
    "usePostPrompts": false,
    "removeBackground": true
  }'
```

**Verify Progress Events:**
- Check SSE stream at `/api/progress`
- Should show workflow process with custom name: "Removing background..." → "Removing background complete"
- Without custom `name`, would show: "Processing Execute Workflow..." → "Processing Execute Workflow complete" (snake case converted to title case with spaces)

**Verify Output:**
- Original image file should exist (not deleted)
- Final database entry should have `imageUrl` pointing to background-removed image
- Metadata should reflect any output mappings applied

## Tasks

[x] Add optional `name` parameter support to pre/post generation task progress events
[x] Add validation function to detect nested `executeWorkflow` processes in workflow configurations
[x] Add validation to check for recursive nesting before workflow execution begins
[x] Implement `executeWorkflow` process handler in `PROCESS_HANDLERS`
[x] Implement input mapping logic for text fields
[x] Implement input mapping logic for image media with metadata field generation
[x] Implement input mapping logic for audio media with metadata field generation
[x] Integrate nested workflow execution within the process handler
[x] Implement output mapping logic for text fields
[x] Implement automatic media URL updates from nested workflow output
[x] Add "Remove Background" checkbox to "Text to Image (Illustrious Characters)" workflow configuration
[x] Configure remove background post-generation task with proper input/output mappings

[x] Fix the following bug:
The post generation workflow is failing from the following error:
```
Error in task task_1771049064423_e4u5j6ufy: Error: Nested workflow "Remove Background (RMBG)" failed: Nested workflow did not produce a result
    at executeWorkflow (file:///F:/YAAIIC/server/generate.mjs:403:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async processGenerationTask (file:///F:/YAAIIC/server/generate.mjs:1442:13)
```
Please review how tasks are tracked to ensure that the end of generation result is being captured properly.
Also, the nested workflow is writing its results directly into media-data, which we do not want.
Add a parameter to the generate media function to allow it to run in "silent" mode, that is, it would execute everything
except write the generation data into `media-data.json`.

[x] Test nested workflow execution with remove background process
[x] Verify error handling when nested workflow fails
