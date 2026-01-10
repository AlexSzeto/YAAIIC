# ComfyUI Workflow Configuration

This document describes the structure of the `comfyui-workflows.json` configuration file, which defines how the server exposes and executes ComfyUI workflows.

## Root Structure

The configuration file has the following root-level properties:

```json
{
  "defaultImageGenerationTasks": [...],
  "workflows": [...]
}
```

### Default Image Generation Tasks

**`defaultImageGenerationTasks`** (array, optional)
- LLM-based analysis tasks that run after image generation by default.

- See [LLM Task Object](#llm-task-object) for structure.

### Workflows Array

**`workflows`** (array, required)
- Array of workflow definition objects.

---

## Workflow Object Structure

Each workflow object supports the following parameters:

### Core Properties

- **`name`** (string, required)
  - The unique display name of the workflow. Used by the client to select the workflow.

- **`options`** (object, required)
  - Contains UI behavior and validation configuration. See [Options Object](#options-object).

- **`base`** (string, required)
  - The filename of the underlying ComfyUI workflow JSON file.
  - Must exist in the `server/resource/` directory.

- **`imageFormat`** (string, optional)
  - The output file format. Default: `"png"`.
  - Common values: `"png"`, `"jpg"`, `"webp"`.

- **`finalNode`** (string, required)
  - The node ID of the final output node in the workflow.
  - Used for progress calculation and step ordering.

### Options Object

The `options` object controls UI behavior and input validation:

- **`type`** (string, required)
  - The generation mode.
  - Values: `"image"`, `"video"`, `"inpaint"`.
  - Determines which endpoint handler is used and post-processing behavior.

- **`autocomplete`** (boolean, optional)
  - Whether to enable Danbooru tag autocompletion for prompts.
  - Useful for anime-style models (e.g., Pony, Illustrious).

- **`inputImages`** (integer, optional)
  - Number of input images required. Default: `0`.
  - `0`: Text-to-image (no input images)
  - `1`: Image-to-image or single reference
  - `2`: First and last frame for video workflows

- **`optionalPrompt`** (boolean, optional)
  - Whether the prompt field can be empty. Default: `false`.
  - Common for video workflows where prompts are auto-generated.

- **`nameRequired`** (boolean, optional)
  - Whether the name field is required before generation. Default: `false`.
  - Common for video workflows.

- **`orientation`** (string, optional)
  - Output orientation handling.
  - Values:
    - `"portrait"`: Fixed portrait dimensions.
    - `"landscape"`: Fixed landscape dimensions.
    - `"detect"`: Auto-detect from input image or user selection.

- **`hidden`** (boolean, optional)
  - Whether to hide this workflow from client workflow lists. Default: `false`.
  - Useful for internal workflows like album cover generation.

- **`extraInputs`** (array, optional)
  - Additional input fields to render in the UI for this workflow.
  - Each input defines a custom field that users can set before generation.
  - See [Extra Input Object](#extra-input-object) for structure.

- **`preGenerationTasks`** (array, optional)
  - LLM tasks or template tasks to run before generation starts.
  - Useful for auto-generating prompts from input images or combining descriptions.
  - Common in video workflows to generate motion descriptions.
  - See [LLM Task Object](#llm-task-object).

- **`postGenerationTasks`** (array, optional)
  - LLM tasks or template tasks to run after generation completes.
  - Overrides `defaultImageGenerationTasks` if specified.
  - See [LLM Task Object](#llm-task-object).

### Upload Handling

- **`upload`** (array, optional)
  - Defines how to handle uploaded files and map them to internal variables.
  - Each item:
    - **`from`** (string): Field name in the upload (e.g., `"image_0"`, `"image_1"`, `"mask"`).
    - **`storePathAs`** (string): Internal variable name to store the file path.

### Value Replacement

- **`replace`** (array, optional)
  - Defines dynamic modifications to the base ComfyUI workflow JSON before execution.
  - Supports two replacement types: **direct mapping** and **conditional replacement**.

#### Direct Mapping Replacement

Maps request data or internal variables to workflow nodes:

```json
{
  "from": "prompt",
  "to": ["6", "inputs", "text"],
  "prefix": "masterpiece, ",
  "postfix": ", high quality"
}
```

- **`from`** (string): Source variable name.
  - Request fields: `"prompt"`, `"seed"`, `"name"`
  - Internal paths: `"saveImagePath"`, `"saveImageFilename"`, `"storagePath"`
  - Upload variables: `"imagePath"`, `"maskPath"`, `"firstFramePath"`, `"lastFramePath"`
  - Video settings: `"frames"`, `"framerate"`
  - Extra inputs: Any `id` from the workflow's `extraInputs` array
  - Special variables: `"ollamaAPIPath"` (server configuration)
- **`to`** (array): Target path in workflow JSON: `["NodeID", "inputs", "keyName"]`.
- **`prefix`** (string, optional): Text to prepend.
- **`postfix`** (string, optional): Text to append.

#### Conditional Replacement

Sets workflow values based on generation context:

```json
{
  "condition": {
    "where": { "generationData": "orientation" },
    "equals": { "value": "landscape" }
  },
  "value": 832,
  "to": ["64", "inputs", "width"]
}
```

- **`condition`** (object): Condition to evaluate.
  - **`where`** (object): Source of value to check. Format: `{ "generationData": "fieldName" }`.
  - **`equals`** (object): Expected value. Format: `{ "value": "expectedValue" }`.
- **`value`** (any): Value to set if condition is true.
- **`to`** (array): Target path in workflow JSON.

### Video-Specific Properties

- **`extractOutputPathFromTextFile`** (string, optional)
  - For video workflows that output to a file path stored in a text file.
  - The filename of the text file to read the output path from.

---

## LLM Task Object

Used in both `postGenerationTasks` and `preGenerationTasks`:

```json
{
  "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
  "imagePath": "saveImagePath",
  "prompt": "Describe this image...",
  "to": "description",
  "replaceBlankFieldOnly": true
}
```

### Properties

- **`model`** (string, required for LLM tasks)
  - Ollama model name to use for inference.
  - Mutually exclusive with `template` and `from`.

- **`imagePath`** (string, optional)
  - Variable name containing the image path for vision tasks.
  - Common: `"saveImagePath"` (output image), `"image_0"` (input image).

- **`prompt`** (string, required for LLM tasks)
  - The prompt text sent to the LLM.
  - Supports placeholder syntax: `{{fieldName}}` is replaced with the value of that field.
  - Examples:
    - `"{{description}}"` - inserts the description field
    - `"{{image_0_description}}"` - inserts description of first input image
  - Missing placeholders will cause an error.

- **`template`** (string, optional)
  - For non-LLM text generation, a template string with placeholders.
  - Alternative to `model` + `prompt` for simple string formatting.
  - Uses same placeholder syntax: `{{variableName}}`.
  - Mutually exclusive with `model` and `from`.
  - Missing placeholders will cause an error.

- **`from`** (string, optional)
  - Source field name to copy value from.
  - Used to copy values between fields without LLM processing.
  - Example: `{"from": "image_0_imageFormat", "to": "imageFormat"}`
  - Mutually exclusive with `model` and `template`.
  - Will error if source field is missing or empty.

- **`to`** (string, required)
  - Target field name to store the result.
  - Common values: `"description"`, `"summary"`, `"name"`, `"tags"`, `"prompt"`, `"imageFormat"`.

- **`replaceBlankFieldOnly`** (boolean, optional)
  - If `true`, only runs the task if the target field is empty.
  - Useful for auto-generating prompts only when user doesn't provide one.

- **`condition`** (object, optional)
  - Conditional execution check. Task only runs if condition is met.

### Task Types

The task behavior depends on which source field is provided:

1. **LLM Task** - Uses `model` + `prompt`: Sends prompt to Ollama for inference
2. **Template Task** - Uses `template`: Simple string substitution with placeholders
3. **Copy Task** - Uses `from`: Copies value from one field to another

Exactly one of `model`, `template`, or `from` must be provided. The task will error if:
- None are provided
- Multiple are provided
- Required placeholders are missing
- Source field (`from`) is missing or empty
- LLM generation fails or returns empty response

---

## Extra Input Object

Used in the `extraInputs` array to define additional UI input fields for a workflow:

```json
{
  "id": "frames",
  "type": "number",
  "label": "Frames",
  "default": 25
}
```

### Properties

- **`id`** (string, required)
  - Unique identifier for this input.
  - Used as the field name in generation data (e.g., accessible as `{{frames}}` in templates).
  - Must be a valid variable name.

- **`type`** (string, required)
  - Input type.
  - Values:
    - `"text"`: Single-line text input
    - `"number"`: Numeric input
    - `"textarea"`: Multi-line text input
    - `"select"`: Dropdown selection
    - `"checkbox"`: Boolean checkbox

- **`label`** (string, required)
  - Display label for the input field in the UI.

- **`default`** (any, optional)
  - Default value for the input.
  - Type depends on input type:
    - `text`/`textarea`: string
    - `number`: number
    - `select`: should match one of the option values
    - `checkbox`: boolean

- **`options`** (array, required for `select` type)
  - Available options for select type inputs.
  - Each option object:
    - **`label`** (string): Display text for the option
    - **`value`** (any): Value to use when this option is selected

### Example Extra Inputs

```json
"extraInputs": [
  {
    "id": "frames",
    "type": "number",
    "label": "Frames",
    "default": 25
  },
  {
    "id": "framerate",
    "type": "number",
    "label": "Frame Rate",
    "default": 20
  },
  {
    "id": "format",
    "type": "select",
    "label": "Output Format",
    "default": "png",
    "options": [
      { "label": "PNG", "value": "png" },
      { "label": "JPEG", "value": "jpg" },
      { "label": "WebP", "value": "webp" }
    ]
  },
  {
    "id": "lyrics",
    "type": "textarea",
    "label": "Lyrics"
  },
  {
    "id": "highQuality",
    "type": "checkbox",
    "label": "High Quality Mode",
    "default": false
  }
]
```

---

## Complete Example

```json
{
  "defaultImageGenerationTasks": [
    {
      "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
      "imagePath": "saveImagePath",
      "prompt": "Write a paragraph describing the image...",
      "to": "description"
    },
    {
      "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
      "prompt": "Write a short name for this image. Description: {{description}}",
      "to": "name",
      "replaceBlankFieldOnly": true
    }
  ],
  "workflows": [
    {
      "name": "Text to Image (Example)",
      "options": {
        "type": "image",
        "autocomplete": true,
        "inputImages": 0,
        "optionalPrompt": false,
        "nameRequired": false,
        "orientation": "portrait"
      },
      "postGenerationTasks": [
        {
          "template": "(description not generated by default)",
          "to": "description"
        }
      ],
      "base": "example-workflow.json",
      "imageFormat": "png",
      "finalNode": "10",
      "replace": [
        {
          "from": "prompt",
          "to": ["6", "inputs", "text"],
          "prefix": "masterpiece, "
        },
        {
          "from": "seed",
          "to": ["3", "inputs", "seed"]
        },
        {
          "from": "saveImagePath",
          "to": ["10", "inputs", "path"]
        }
      ]
    },
    {
      "name": "Image to Video (Example)",
      "options": {
        "type": "video",
        "autocomplete": false,
        "inputImages": 2,
        "optionalPrompt": true,
        "nameRequired": true,
        "orientation": "detect",
        "extraInputs": [
          {
            "id": "frames",
            "type": "number",
            "label": "Frames",
            "default": 25
          },
          {
            "id": "framerate",
            "type": "number",
            "label": "Frame Rate",
            "default": 20
          }
        ]
      },
      "preGenerationTasks": [
        {
          "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
          "prompt": "First frame: {{image_0_description}}\nLast frame: {{image_1_description}}\nDescribe the motion:",
          "to": "prompt",
          "replaceBlankFieldOnly": true
        },
        {
          "template": "First frame: {{image_0_description}}\nLast frame: {{image_1_description}}",
          "to": "description"
        }
      ],
      "base": "video-workflow.json",
      "imageFormat": "webp",
      "finalNode": "76",
      "upload": [
        { "from": "image_0", "storePathAs": "firstFramePath" },
        { "from": "image_1", "storePathAs": "lastFramePath" }
      ],
      "replace": [
        {
          "condition": {
            "where": { "generationData": "orientation" },
            "equals": { "value": "landscape" }
          },
          "value": 832,
          "to": ["64", "inputs", "width"]
        },
        {
          "from": "prompt",
          "to": ["6", "inputs", "text"]
        },
        {
          "from": "firstFramePath",
          "to": ["52", "inputs", "image"]
        },
        {
          "from": "saveImageFilename",
          "to": ["63", "inputs", "filename_prefix"]
        },
        {
          "from": "storagePath",
          "to": ["76", "inputs", "output_file_path"]
        }
      ],
      "extractOutputPathFromTextFile": "video-filename.txt"
    }
  ]
}
```
