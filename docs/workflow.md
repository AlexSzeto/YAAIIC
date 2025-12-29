# ComfyUI Workflow Configuration

This document describes the structure of the `comfyui-workflows.json` configuration file, which defines how the server exposes and executes ComfyUI workflows.

## Root Structure

The configuration file has the following root-level properties:

```json
{
  "postGenerationTasks": [...],
  "workflows": [...]
}
```

### Global Post-Generation Tasks

**`postGenerationTasks`** (array, optional)
- LLM-based analysis tasks that run after every generation.
- Applied automatically to all workflows.
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

- **`format`** (string, optional)
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

- **`preGenerationTasks`** (array, optional)
  - LLM tasks to run before generation starts.
  - Useful for auto-generating prompts from input images.
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
  - Internal paths: `"savePath"`, `"saveFilename"`, `"storagePath"`
  - Upload variables: `"imagePath"`, `"maskPath"`, `"firstFramePath"`, `"lastFramePath"`
  - Video settings: `"frames"`, `"framerate"`
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
  "imagePath": "savePath",
  "prompt": "Describe this image...",
  "to": "description",
  "replaceBlankFieldOnly": true
}
```

### Properties

- **`model`** (string, required for LLM tasks)
  - Ollama model name to use for inference.

- **`imagePath`** (string, optional)
  - Variable name containing the image path for vision tasks.
  - Common: `"savePath"` (output image), `"image_0"` (input image).

- **`prompt`** (string, required for LLM tasks)
  - The prompt text sent to the LLM.
  - Supports placeholder syntax: `[fieldName]` is replaced with the value of that field.
  - Examples:
    - `"[description]"` - inserts the description field
    - `"[image_0_description]"` - inserts description of first input image

- **`template`** (string, optional)
  - For non-LLM text generation, a template string with placeholders.
  - Alternative to `model` + `prompt` for simple string formatting.

- **`to`** (string, required)
  - Target field name to store the result.
  - Common values: `"description"`, `"summary"`, `"name"`, `"tags"`, `"prompt"`.

- **`replaceBlankFieldOnly`** (boolean, optional)
  - If `true`, only runs the task if the target field is empty.
  - Useful for auto-generating prompts only when user doesn't provide one.

---

## Complete Example

```json
{
  "postGenerationTasks": [
    {
      "model": "qwen3-vl:8b",
      "imagePath": "savePath",
      "prompt": "Write a paragraph describing the image...",
      "to": "description"
    },
    {
      "model": "qwen3-vl:8b",
      "prompt": "Write a short name for this image. Description: [description]",
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
      "base": "example-workflow.json",
      "format": "png",
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
          "from": "savePath",
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
        "preGenerationTasks": [
          {
            "model": "qwen3-vl:8b",
            "prompt": "Describe motion from: [image_0_description]",
            "to": "prompt",
            "replaceBlankFieldOnly": true
          }
        ]
      },
      "base": "video-workflow.json",
      "format": "webp",
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
        }
      ],
      "extractOutputPathFromTextFile": "video-filename.txt"
    }
  ]
}
```
