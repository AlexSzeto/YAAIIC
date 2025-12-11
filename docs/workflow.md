# ComfyUI Workflow Configuration

This document describes the structure of the `comfyui-workflows.json` configuration file, which defines how the server exposes and executes ComfyUI workflows.

## Workflow Object Structure

The configuration file contains a root `workflows` array, where each object represents a distinct generation definition.

### Parameters

Each workflow object supports the following parameters:

- **`name`** (string, required)
  - The unique display name of the workflow. Used by the client to select the workflow (e.g., via the dropdown menu).

- **`type`** (string, required)
  - The mode of generation.
  - Values: `"txt2img"`, `"inpaint"`.
  - Determines which endpoint handler is used and what inputs are expected (e.g., inpaint expects image uploads).

- **`base`** (string, required)
  - The filename of the underlying ComfyUI workflow JSON file.
  - Must exist in the `server/resource/` directory.

- **`format`** (string, optional)
  - The output image format.
  - Default: `"png"`.
  - Used for naming the output file extension.

- **`autocomplete`** (boolean, optional)
  - Whether to enable tag autocompletion for this workflow in the UI.
  - Useful for anime-style models (e.g., Pony, Illustrious) where Danbooru tags are common.

- **`replace`** (array, optional)
  - Defines dynamic modifications to the base ComfyUI JSON before execution.
  - Used to inject user inputs (prompt, seed, paths) into the workflow nodes.
  - Each item in the array is an object with:
    - **`from`** (string): The key in the request body (or internal variable) to source the value from.
      - Common values: `"prompt"`, `"seed"`, `"savePath"`, `"imagePath"`, `"maskPath"`.
    - **`to`** (array): The target path in the ComfyUI workflow JSON structure.
      - Format: `["NodeID", "inputs", "keyName"]`.
    - **`prefix`** (string, optional): Static text to prepend to the generic value.
      - Useful for adding quality tags or style prompts invisibly to the user.
    - **`postfix`** (string, optional): Static text to append to the value.

- **`upload`** (array, optional)
  - *Specific to `inpaint` type.*
  - Defines how to handle uploaded files and map them to internal path variables.
  - Each item is an object with:
    - **`from`** (string): The field name in the `multipart/form-data` upload (e.g., `"image"`, `"mask"`).
    - **`storePathAs`** (string): The internal variable name to store the file path as.
      - This variable name can then be referenced in the `replace` section's `from` field.

## Data Shape Example

```json
{
  "name": "Example Workflow",
  "type": "txt2img",
  "base": "workflow_api.json",
  "format": "png",
  "autocomplete": true,
  "replace": [
    {
      "from": "prompt",
      "to": ["6", "inputs", "text"],
      "prefix": "masterpiece, allow_nsfw, "
    },
    {
      "from": "seed",
      "to": ["3", "inputs", "seed"]
    }
  ]
}
```
