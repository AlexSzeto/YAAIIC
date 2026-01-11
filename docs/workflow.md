# ComfyUI Workflow Configuration

This document describes the structure of the `comfyui-workflows.json` configuration file, which defines how the server exposes and executes ComfyUI workflows.

## Overview

The server manages VRAM automatically by tracking the last used workflow and Ollama model. When switching between workflows or models, the server unloads the previous one to maximize available VRAM for the new task. This ensures optimal performance even on systems with limited GPU memory.

## Root Structure

The configuration file has the following root-level properties:

```json
{
  "defaultImageGenerationTasks": [...],
  "defaultAudioGenerationWorkflow": "Text to Image (Album Cover)",
  "workflows": [...]
}
```

### Default Image Generation Tasks

**`defaultImageGenerationTasks`** (array, optional)
- LLM-based analysis tasks that run after image generation by default.
- Used for uploads and regeneration when no workflow-specific post-generation tasks are defined.
- See [LLM Task Object](#llm-task-object) for structure.

### Default Audio Generation Workflow

**`defaultAudioGenerationWorkflow`** (string, optional)
- Name of the workflow to use for generating album covers when audio files are uploaded.
- The referenced workflow should be marked as `hidden: true` to prevent it from appearing in client workflow lists.
- This workflow is automatically triggered when an audio file is uploaded via `/upload/audio`.

### Workflows Array

**`workflows`** (array, required)
- Array of workflow definition objects.

---

## Workflow Object Structure

Each workflow object supports the following parameters:

### Core Properties

- **`name`** (string, required)
  - The unique display name of the workflow. Used by the client to select the workflow.

- **`hidden`** (boolean, optional)
  - Whether to hide this workflow from client workflow lists. Default: `false`.
  - Hidden workflows can still be referenced internally (e.g., for `defaultAudioGenerationWorkflow`).
  - Useful for internal workflows like album cover generation.

- **`options`** (object, required)
  - Contains UI behavior and validation configuration. See [Options Object](#options-object).

- **`base`** (string, required)
  - The filename of the underlying ComfyUI workflow JSON file.
  - Must exist in the `server/resource/` directory.

- **`finalNode`** (string, required)
  - The node ID of the final output node in the workflow.
  - Used for progress calculation and step ordering.

### Options Object

The `options` object controls UI behavior and input validation:

- **`type`** (string, required)
  - The generation mode.
  - Values: `"image"`, `"video"`, `"audio"`, `"inpaint"`.
  - Determines which endpoint handler is used and post-processing behavior.
  - Automatically added to generated media metadata.

- **`autocomplete`** (boolean, optional)
  - Whether to enable Danbooru tag autocompletion for prompts.
  - Useful for anime-style models (e.g., Pony, Illustrious).

- **`inputImages`** (integer, optional)
  - Number of input images required. Default: `0`.
  - `0`: Text-to-image (no input images)
  - `1`: Image-to-image or single reference
  - `2`: First and last frame for video workflows

- **`inputAudios`** (integer, optional)
  - Number of input audio files required. Default: `0`.
  - Used for audio-to-audio or audio remixing workflows.
  - Audio files are uploaded as `audio_0`, `audio_1`, etc.

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
    - **`from`** (string): Field name in the upload (e.g., `"image_0"`, `"image_1"`, `"audio_0"`, `"mask"`).
    - **`storePathAs`** (string): Internal variable name to store the file path.

### Value Replacement

- **`replace`** (array, optional)
  - Defines dynamic modifications to the base ComfyUI workflow JSON before execution.
  - Supports two replacement types: direct mapping and conditional replacement.
  - See [Value Replacement Object](#value-replacement-object) for detailed structure and examples.

### Video-Specific Properties

- **`extractOutputPathFromTextFile`** (string, optional)
  - For video workflows that output to a file path stored in a text file.
  - The filename of the text file to read the output path from.

### Audio-Specific Properties

Audio workflows automatically generate two outputs:
- **Album cover image**: Saved to `saveImagePath` / `saveImageFilename` with the format specified in `imageFormat`.
- **Audio file**: Saved to `saveAudioPath` / `saveAudioFilename` with the format specified in `audioFormat`.

Both paths are automatically generated by the server and available for use in workflow `replace` mappings. The resulting media entry will include both `imageUrl` (album cover) and `audioUrl` (audio file) fields.

---

## Value Replacement Object

The `replace` array defines dynamic modifications to the base ComfyUI workflow JSON before execution. Each replacement object can be either a **direct mapping** or a **conditional replacement**.

### Direct Mapping Replacement

Maps request data or internal variables directly to workflow nodes:

```json
{
  "from": "prompt",
  "to": ["6", "inputs", "text"],
  "prefix": "masterpiece, ",
  "postfix": ", high quality"
}
```

#### Properties

- **`from`** (string, required)
  - Source variable name to read the value from.
  - Available source variables:
    - **Request fields**: `"prompt"`, `"seed"`, `"name"`
    - **Internal paths**: `"saveImagePath"`, `"saveImageFilename"`, `"saveAudioPath"`, `"saveAudioFilename"`, `"storagePath"`
    - **Upload variables**: `"imagePath"`, `"maskPath"`, `"firstFramePath"`, `"lastFramePath"`, `"audioPath"`
    - **Video settings**: `"frames"`, `"framerate"`
    - **Audio settings**: `"audioFormat"`, `"imageFormat"`
    - **Extra inputs**: Any `id` from the workflow's `extraInputs` array
    - **Special variables**: `"ollamaAPIPath"` (server configuration)

- **`to`** (array, required)
  - Target path in the ComfyUI workflow JSON.
  - Format: `["NodeID", "inputs", "keyName"]`
  - Example: `["6", "inputs", "text"]` targets the `text` input of node `6`

- **`prefix`** (string, optional)
  - Text to prepend to the source value.
  - Example: `"masterpiece, "` prepends quality tags to prompts

- **`postfix`** (string, optional)
  - Text to append to the source value.
  - Example: `", high quality"` appends quality tags to prompts

### Conditional Replacement

Sets workflow values based on runtime conditions. See [Condition Object](#condition-object) for detailed condition syntax.

```json
{
  "condition": {
    "where": { "data": "orientation" },
    "equals": { "value": "landscape" }
  },
  "value": 832,
  "to": ["64", "inputs", "width"]
}
```

#### Properties

- **`condition`** (object, required)
  - Defines the condition to evaluate before applying the replacement.
  - See [Condition Object](#condition-object) for full structure and examples.

- **`value`** (any, required)
  - The value to set in the workflow if the condition is true.
  - Can be any type that the target node input accepts.

- **`to`** (array, required)
  - Target path in the ComfyUI workflow JSON.
  - Format: `["NodeID", "inputs", "keyName"]`

### Replacement Types

The server determines the replacement type based on which properties are present:

1. **Direct Mapping** - Has `from` property: Maps a source variable to a target path
2. **Conditional Replacement** - Has `condition` property: Sets value based on a condition

### Example Usage

```json
"replace": [
  {
    "from": "prompt",
    "to": ["6", "inputs", "text"],
    "prefix": "masterpiece, best quality, ",
    "postfix": ", highly detailed"
  },
  {
    "from": "seed",
    "to": ["3", "inputs", "seed"]
  },
  {
    "from": "saveImagePath",
    "to": ["10", "inputs", "path"]
  },
  {
    "condition": {
      "where": { "data": "orientation" },
      "equals": { "value": "landscape" }
    },
    "value": 832,
    "to": ["64", "inputs", "width"]
  },
  {
    "condition": {
      "where": { "data": "orientation" },
      "equals": { "value": "portrait" }
    },
    "value": 640,
    "to": ["64", "inputs", "width"]
  }
]
```

### Video-Specific Properties

- **`extractOutputPathFromTextFile`** (string, optional)
  - For video workflows that output to a file path stored in a text file.
  - The filename of the text file to read the output path from.

### Audio-Specific Properties

Audio workflows automatically generate two outputs:
- **Album cover image**: Saved to `saveImagePath` / `saveImageFilename` with the format specified in `imageFormat`.
- **Audio file**: Saved to `saveAudioPath` / `saveAudioFilename` with the format specified in `audioFormat`.

Both paths are automatically generated by the server and available for use in workflow `replace` mappings. The resulting media entry will include both `imageUrl` (album cover) and `audioUrl` (audio file) fields.

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
  - Supports template placeholder syntax. See [Template Syntax](#template-syntax).
  - Examples:
    - `"{{description}}"` - inserts the description field
    - `"{{image_0_description}}"` - inserts description of first input image
  - Missing placeholders will cause an error.

- **`template`** (string, optional)
  - For non-LLM text generation, a template string with placeholders.
  - Alternative to `model` + `prompt` for simple string formatting.
  - See [Template Syntax](#template-syntax) for placeholder format and available pipes.
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
  - See [Condition Object](#condition-object) for structure.

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

## Template Syntax

Templates provide a way to dynamically generate text values by substituting placeholders with data values. Templates are used in:
- LLM task prompts
- Template tasks (non-LLM text generation)
- Export filename and folder templates

### Basic Placeholder Format

```
{{propertyName}}
```

Placeholders are replaced with the corresponding property value from the data object. If a placeholder references a missing property, an error is thrown.

### Pipe Transformations

Templates support pipe transformations using the `|` character:

```
{{propertyName|pipe1|pipe2|pipe3}}
```

Pipes are applied left-to-right. Array values are automatically joined with spaces after piping.

### Available Pipes

| Pipe | Input | Output | Example |
|------|-------|--------|---------|
| `split-by-spaces` | string | array | `"hello world"` → `["hello", "world"]` |
| `snakecase` | array | string | `["Hello", "World"]` → `"Hello_World"` |
| `camelcase` | array | string | `["hello", "world"]` → `"helloWorld"` |
| `kebabcase` | array | string | `["Hello", "World"]` → `"Hello-World"` |
| `titlecase` | array | string | `["hello", "world"]` → `"Hello World"` |
| `join-by-spaces` | array | string | `["Hello", "World"]` → `"Hello World"` |
| `lowercase` | string | string | `"Hello World"` → `"hello world"` |
| `uppercase` | string | string | `"Hello World"` → `"HELLO WORLD"` |

### Example Templates

```json
{
  "template": "{{name}}",
  "to": "title"
}
```

```json
{
  "template": "{{name|split-by-spaces|snakecase|lowercase}}",
  "to": "filename"
}
```

This converts `"My Image Name"` → `["My", "Image", "Name"]` → `"My_Image_Name"` → `"my_image_name"`.

### Multi-Placeholder Templates

```json
{
  "template": "First frame: {{image_0_description}}\nLast frame: {{image_1_description}}",
  "to": "description"
}
```

---

## Condition Object

Conditions allow tasks and value replacements to execute only when specific criteria are met. They are used in:
- [Value Replacement](#conditional-replacement) - Conditional workflow modifications
- [LLM Task Object](#llm-task-object) - Conditional pre/post-generation tasks  
- [Export prepareDataTasks](server.md#conditional-tasks) - Conditional export data preparation

### Structure

```json
{
  "condition": {
    "where": { "data": "orientation" },
    "equals": { "value": "landscape" }
  }
}
```

### Properties

- **`where`** (object, required)
  - Specifies the source of the value to check.
  - Format: `{ "sourceType": "propertyName" }`
  - Available source types:
    - `"data"` - Property from the current data object (generationData or exportData)
    - `"value"` - Literal value comparison (rarely used in `where`)

- **`equals`** (object, required)
  - Specifies the expected value for the condition to pass.
  - Format: `{ "sourceType": "valueOrPropertyName" }`
  - Available source types:
    - `"value"` - Literal value to compare against (most common)
    - `"data"` - Another property from the data object

### Examples

**Check if orientation is landscape:**
```json
{
  "condition": {
    "where": { "data": "orientation" },
    "equals": { "value": "landscape" }
  }
}
```

**Check if type is audio:**
```json
{
  "condition": {
    "where": { "data": "type" },
    "equals": { "value": "audio" }
  }
}
```

**Compare two data properties (advanced):**
```json
{
  "condition": {
    "where": { "data": "inputOrientation" },
    "equals": { "data": "outputOrientation" }
  }
}
```

### Condition Behavior

- If `condition` is omitted, the task/replacement always executes
- If `where` or `equals` is missing, the condition evaluates to `true`
- Comparison uses strict equality (`===`)
- Null and undefined values are compared exactly

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
  "defaultAudioGenerationWorkflow": "Text to Image (Album Cover)",
  "workflows": [
    {
      "name": "Text to Image (Album Cover)",
      "hidden": true,
      "options": {
        "type": "image",
        "autocomplete": false,
        "inputImages": 0,
        "inputAudios": 0,
        "optionalPrompt": false,
        "nameRequired": false,
        "orientation": "portrait"
      },
      "preGenerationTasks": [
        {
          "template": "jpg",
          "to": "imageFormat"
        }
      ],
      "postGenerationTasks": [
        {
          "template": "(prompt unavailable for uploaded audio)",
          "to": "prompt"
        }
      ],
      "base": "example-album-cover.json",
      "finalNode": "10",
      "replace": [
        {
          "from": "name",
          "to": ["6", "inputs", "text"]
        },
        {
          "from": "saveImagePath",
          "to": ["10", "inputs", "path"]
        }
      ]
    },
    {
      "name": "Text to Image (Example)",
      "options": {
        "type": "image",
        "autocomplete": true,
        "inputImages": 0,
        "inputAudios": 0,
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
              { "label": "JPEG", "value": "jpg" },
              { "label": "WebP", "value": "webp" }
            ]
          }
        ]
      },
      "postGenerationTasks": [
        {
          "template": "(description not generated by default)",
          "to": "description"
        }
      ],
      "base": "example-workflow.json",
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
          "template": "webp",
          "to": "imageFormat"
        },
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
      "finalNode": "76",
      "upload": [
        { "from": "image_0", "storePathAs": "firstFramePath" },
        { "from": "image_1", "storePathAs": "lastFramePath" }
      ],
      "replace": [
        {
          "condition": {
            "where": { "data": "orientation" },
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
    },
    {
      "name": "Text to Audio (Example)",
      "options": {
        "type": "audio",
        "autocomplete": false,
        "inputImages": 0,
        "inputAudios": 0,
        "optionalPrompt": false,
        "nameRequired": true,
        "extraInputs": [
          {
            "id": "audioFormat",
            "type": "select",
            "label": "Audio Format",
            "default": "mp3",
            "options": [
              { "label": "MP3", "value": "mp3" },
              { "label": "OGG", "value": "ogg" }
            ]
          },
          {
            "id": "lyrics",
            "type": "textarea",
            "label": "Lyrics"
          }
        ]
      },
      "preGenerationTasks": [
        {
          "template": "jpg",
          "to": "imageFormat"
        }
      ],
      "postGenerationTasks": [
        {
          "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
          "imagePath": "saveImagePath",
          "prompt": "Describe the album cover artwork...",
          "to": "description"
        }
      ],
      "base": "audio-generation.json",
      "finalNode": "42",
      "replace": [
        {
          "from": "prompt",
          "to": ["6", "inputs", "text"]
        },
        {
          "from": "lyrics",
          "to": ["12", "inputs", "lyrics"]
        },
        {
          "from": "name",
          "to": ["18", "inputs", "text"]
        },
        {
          "from": "saveAudioPath",
          "to": ["42", "inputs", "audio_path"]
        },
        {
          "from": "saveImagePath",
          "to": ["43", "inputs", "image_path"]
        }
      ]
    }
  ]
}
```
