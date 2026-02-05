# Server API Documentation

This document describes the API endpoints provided by the server.

## Base URL

All endpoints are relative to the server's base URL (default: `http://localhost:3000`).

## Core Endpoints

### Get Application
- **Endpoint**: `GET /`
- **Use Case**: Serves the main single-page application entry point.
- **Payload**: None
- **Output**: HTML content (`index.html`)

### Serve Libraries
- **Endpoint**: `GET /lib/textarea-caret-position.js`
- **Use Case**: Helper endpoint to serve the `textarea-caret-position` library from node_modules.
- **Payload**: None
- **Output**: JavaScript file content

### Serve Media Files
- **Endpoint**: `GET /media/:filename`
- **Use Case**: Retrieve generated images, videos, audio files, and uploaded assets.
- **Payload**: `filename` path parameter.
- **Output**: Media file (e.g., PNG, JPG, WEBP for images/videos, MP3, OGG, WAV for audio).

## Data & Resources

### List Tags
- **Endpoint**: `GET /tags`
- **Use Case**: Search and filter Danbooru tags for prompt auto-completion.
- **Payload**:
  - `noCharacters` (query, boolean): If 'true', excludes character-specific tags. Default: true.
  - `minLength` (query, integer): Minimum tag length. Default: 4.
  - `minUsageCount` (query, integer): Minimum usage count in database. Default: 100.
  - `categories` (query, string): Comma-separated list of category IDs. Default: '0' (General).
- **Output**:
  ```json
  {
    "tags": ["tag1", "tag2", ...],
    "filters": {
      "noCharacters": true,
      "minLength": 4,
      "minUsageCount": 100,
      "totalReturned": 1234
    }
  }
  ```
- **Error State**: 500 if the source CSV file cannot be read.

### List Workflows
- **Endpoint**: `GET /workflows`
- **Use Case**: Retrieve the list of available ComfyUI workflows configured on the server. Workflows marked as `hidden: true` are not included in the response.
- **Payload**: None
- **Output**: Array of workflow option objects.
  ```json
  [
    {
      "name": "Text to Image (Example)",
      "type": "image",
      "autocomplete": true,
      "inputImages": 0,
      "inputAudios": 0,
      "optionalPrompt": false,
      "nameRequired": false,
      "orientation": "portrait",
      "extraInputs": []
    },
    {
      "name": "Image to Video (Example)",
      "type": "video",
      "autocomplete": false,
      "inputImages": 2,
      "inputAudios": 0,
      "optionalPrompt": true,
      "nameRequired": true,
      "orientation": "detect",
      "extraInputs": [
        {"id": "frames", "type": "number", "label": "Frames", "default": 25},
        {"id": "framerate", "type": "number", "label": "Frame Rate", "default": 20}
      ]
    },
    {
      "name": "Text to Audio (Example)",
      "type": "audio",
      "autocomplete": false,
      "inputImages": 0,
      "inputAudios": 0,
      "optionalPrompt": false,
      "nameRequired": true,
      "extraInputs": [
        {"id": "audioFormat", "type": "select", "label": "Audio Format", "default": "mp3", "options": [{"label": "MP3", "value": "mp3"}, {"label": "OGG", "value": "ogg"}]}
      ]
    }
  ]
  ```
- **Error State**: 500 if workflows cannot be loaded.

### Search Media History
- **Endpoint**: `GET /media-data`
- **Use Case**: Search through the history of generated images, videos, and audio files.
- **Payload**:
  - `query` (query, string): Search term (matches name, description, prompt, or date in yyyy-mm-dd format).
  - `tags` (query, string): Comma-separated list of tags. Results must contain ALL specified tags.
  - `folder` (query, string): Filter by folder UID. If omitted, uses the current folder. Use empty string "" for unsorted items.
  - `sort` (query, enum): 'ascending' or 'descending' (default).
  - `limit` (query, integer): Max number of results. Default: 10.
- **Output**: Array of media data objects.
- **Error State**: 500 on internal error.

### Get Media Details
- **Endpoint**: `GET /media-data/:uid`
- **Use Case**: Retrieve full details for a specific generated media item by its unique ID.
- **Payload**: `uid` path parameter (integer).
- **Output**: Media data object.
  ```json
  {
    "uid": 1234567890,
    "name": "Generated Image",
    "description": "AI-generated prose description...",
    "summary": "Objective visual inventory...",
    "tags": ["portrait", "anime", "female"],
    "prompt": "user prompt text...",
    "imageUrl": "/media/image_1.png",
    "audioUrl": "/media/audio_1.mp3",
    "workflow": "workflow_name",
    "type": "image",
    "seed": 12345,
    "inpaint": false,
    "inpaintArea": null,
    "folder": "folder-123",
    "timeTaken": 45000,
    "timestamp": "2025-12-28T00:00:00.000Z"
  }
  ```
- **Error State**:
  - 400 if UID is invalid.
  - 404 if image not found.
  - 500 on internal error.

### Delete Media History
- **Endpoint**: `DELETE /media-data/delete`
- **Use Case**: Delete multiple media history entries.
- **Payload**: JSON body.
  ```json
  {
    "uids": [123, 456]
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "deletedCount": 2,
    "message": "Successfully deleted 2 entries"
  }
  ```
- **Error State**:
  - 400 if `uids` is missing, not an array, or contains non-integers.
  - 500 if saving changes fails.

### Edit Media Data
- **Endpoint**: `POST /edit`
- **Use Case**: Update metadata for one or multiple existing media entries.
- **Payload**: JSON body with a single image data object or an array of image data objects.
  
  **Single object**:
  ```json
  {
    "uid": 1234567890,
    "name": "Updated Name",
    "description": "Updated description...",
    "tags": ["updated", "tags"],
    "folder": "folder-456",
    ...
  }
  ```
  
  **Array of objects** (for bulk updates like moving to folder):
  ```json
  [
    {
      "uid": 1234567890,
      "folder": "folder-456",
      ...
    },
    {
      "uid": 9876543210,
      "folder": "folder-456",
      ...
    }
  ]
  ```
  - `uid` (integer, required): The unique ID of the image to update.
  - All other fields will replace the existing entry.
- **Output**:
  
  **Single object response**:
  ```json
  {
    "success": true,
    "data": { ... updated image object ... }
  }
  ```
  
  **Array response**:
  ```json
  {
    "success": true,
    "data": [ { ... updated image object ... }, { ... } ]
  }
  ```
- **Error State**:
  - 400 if input is not an object or array, or if any `uid` is missing or not an integer.
  - 404 if any image with specified UID not found.
  - 500 if saving changes fails.

## Folder Management

### Get Folders
- **Endpoint**: `GET /folder`
- **Use Case**: Retrieve the list of all folders and the current active folder.
- **Payload**: None
- **Output**:
  ```json
  {
    "list": [
      { "uid": "", "label": "Unsorted" },
      { "uid": "folder-123", "label": "Fantasy Landscapes" },
      { "uid": "folder-456", "label": "Character Portraits" }
    ],
    "current": "folder-123"
  }
  ```
  - `list`: Array of folder objects. The "Unsorted" folder (uid: "") represents items without a folder.
  - `current`: UID of the currently active folder.
- **Error State**: 500 on internal error.

### Set Current Folder
- **Endpoint**: `POST /folder`
- **Use Case**: Set the current folder and create it if it doesn't exist.
- **Payload**: JSON body.
  ```json
  {
    "label": "New Folder Name"
  }
  ```
  - `label` (string, required): The name/label for the folder.
  - If a folder with this label doesn't exist, a new folder is created with a unique UID.
  - The folder is set as the current active folder.
- **Output**:
  ```json
  {
    "success": true,
    "list": [ ... array of all folders ... ],
    "current": "folder-123"
  }
  ```
- **Error State**:
  - 400 if `label` is missing.
  - 500 if saving changes fails.

### Rename Folder
- **Endpoint**: `PUT /folder`
- **Use Case**: Rename an existing folder.
- **Payload**: JSON body.
  ```json
  {
    "uid": "folder-123",
    "label": "Updated Folder Name"
  }
  ```
  - `uid` (string, required): The unique ID of the folder to rename.
  - `label` (string, required): The new name/label for the folder.
- **Output**:
  ```json
  {
    "success": true,
    "list": [ ... array of all folders with updated name ... ],
    "current": "folder-123"
  }
  ```
- **Error State**:
  - 400 if `uid` or `label` is missing.
  - 404 if folder with specified UID not found.
  - 500 if saving changes fails.

### Delete Folder
- **Endpoint**: `DELETE /folder/:uid`
- **Use Case**: Delete a folder and move all its contents to "Unsorted".
- **Payload**: `uid` path parameter (string).
- **Output**:
  ```json
  {
    "success": true,
    "list": [ ... array of remaining folders ... ],
    "current": ""
  }
  ```
  - All images that were in the deleted folder have their `folder` attribute removed (set to empty string).
  - If the deleted folder was the current folder, the current folder is reset to "" (Unsorted).
- **Error State**:
  - 400 if attempting to delete the "Unsorted" folder (uid: "").
  - 404 if folder with specified UID not found.
  - 500 if saving changes fails.

### Regenerate Text Fields
- **Endpoint**: `POST /regenerate`
- **Use Case**: Regenerate AI-generated text fields (description, summary, name, tags) for an existing image using LLM.
- **Payload**: JSON body.
  ```json
  {
    "uid": 1234567890,
    "fields": ["description", "name", "tags"]
  }
  ```
  - `uid` (integer, required): The unique ID of the image.
  - `fields` (array of strings, required): Fields to regenerate. Valid values: `"description"`, `"summary"`, `"name"`, `"tags"`.
- **Output**: Task ID for SSE tracking.
  ```json
  {
    "taskId": "regenerate-1234567890-1735500000000",
    "message": "Regeneration started"
  }
  ```
- **SSE Completion Event**: Returns full updated image data.
  ```json
  {
    "taskId": "...",
    "status": "completed",
    "progress": { "percentage": 100, ... },
    "mediaData": { ... full updated image object ... },
    "message": "Regeneration complete"
  }
  ```
- **Error State**:
  - 400 if `uid` or `fields` is missing/invalid.
  - 404 if image with specified UID not found.
  - 500 on processing failure.

### Upload Image
- **Endpoint**: `POST /upload/image`
- **Use Case**: Upload an image file with automatic LLM analysis for description, summary, name, and tags.
- **Payload**: `multipart/form-data`.
  - `image`: Image file (Required, must be an image MIME type).
  - `name`: Optional name extracted from filename (string, optional).
- **Output**: Task ID for SSE tracking.
  ```json
  {
    "success": true,
    "taskId": "task_1735500000000_abc123def",
    "message": "Upload task created"
  }
  ```
- **SSE Completion Event**: Returns complete image data object with generated metadata.
- **Error State**:
  - 400 if no image file is provided or file type is not an image.
  - 500 on upload processing failure.

## Generation Endpoints & Workflow

### Generate (Image/Video/Audio)
- **Endpoint**: `POST /generate`
- **Use Case**: Initiate image, video, or audio generation using a configured ComfyUI workflow.
- **Payload**: `multipart/form-data` or JSON body depending on workflow requirements.

  **For workflows with input files** (`multipart/form-data`):
  - `workflow` (string, required): Workflow name.
  - `prompt` (string, required unless `optionalPrompt` is true): Positive prompt text.
  - `name` (string, required if `nameRequired` is true): Name for the output.
  - `seed` (integer, optional): Random seed. Auto-generated if omitted.
  - `image_0` (file, if `inputImages >= 1`): First input image.
  - `image_1` (file, if `inputImages >= 2`): Second input image.
  - `audio_0` (file, if `inputAudios >= 1`): First input audio file.
  - `orientation` (string, optional): 'portrait', 'landscape', or 'square' (only when `orientation: "detect"`).
  - Extra inputs: Any additional fields defined in workflow's `extraInputs` configuration (e.g., `frames`, `framerate`, `audioFormat`).

  **For text-only workflows** (JSON body):
  ```json
  {
    "workflow": "workflow_name",
    "prompt": "positive prompt text",
    "seed": 12345,
    "name": "Optional Name",
    "orientation": "portrait",
    "frames": 25,
    "framerate": 20,
    "audioFormat": "mp3"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "taskId": "task_123456...",
    "message": "Generation task created"
  }
  ```
- **Error State**:
  - 400 if `workflow` is missing, invalid, or required images not provided.
  - 500 on processing failure.

### Inpaint Generation
- **Endpoint**: `POST /generate/inpaint`
- **Use Case**: Initiate an image inpainting task.
- **Payload**: `multipart/form-data`.
  - `image`: Source image file (Required).
  - `mask`: Mask image file (Required).
  - `workflow`: Workflow name (Required).
  - `prompt`: Positive prompt text (Required).
  - `name`: Name for the generation (Required).
  - `seed`: Seed number (Optional).
  - `inpaintArea`: JSON string describing area `{x1, y1, x2, y2}` (Optional).
  - Extra inputs: Any additional fields defined in workflow's `extraInputs` configuration.
- **Output**:
  ```json
  {
    "success": true,
    "taskId": "task_123456...",
    "message": "Generation task created"
  }
  ```
- **Error State**:
  - 400 if required fields/files are missing or invalid.
  - 500 on upload or processing failure.

### SSE Progress Stream
- **Endpoint**: `GET /progress/:taskId`
- **Use Case**: Listen for real-time progress updates for a specific generation task.
- **Payload**: `taskId` path parameter.
- **Output**: Server-Sent Events stream (`text/event-stream`).

### Generation Workflow

The generation process uses an asynchronous workflow with Server-Sent Events (SSE) for progress tracking:

1.  **Initiate Task**:
    - Client sends a POST request to `/generate`, `/generate/inpaint`, `/upload/image`, or `/regenerate`.
    - Server creates a background task and immediately returns a `taskId`.

2.  **Subscribe to Updates**:
    - Client opens an EventSource connection to `/progress/:taskId`.
    - Server buffers messages if the client hasn't connected yet.

3.  **Process Stages (Server-Side)**:
    - **VRAM Management**: If the requested workflow differs from the last used workflow, the server calls ComfyUI's `/free` endpoint to unload models and maximize VRAM. Similarly, if a different Ollama model is needed, the previous model is unloaded.
    - **WebSocket Initialization**: ComfyUI WebSocket connection is reinitialized to ensure stable communication.
    - **Pre-Generation Tasks**: If configured, LLM tasks or template tasks run to prepare data (e.g., auto-generate prompts, set default formats).
    - **Validation & Setup**: Server verifies inputs and prepares the ComfyUI workflow.
    - **Queuing**: Request is sent to the ComfyUI backend.
    - **Generation**: ComfyUI processes the image/video. SSE events emit progress percentages.
    - **Post-Generation Tasks**: LLM analysis runs to generate description, summary, name, and tags.
    - **Completion**: Result is saved, and a final event is emitted.

4.  **SSE Event Types**:
    - `progress`: JSON data containing percentage, current step description, and values.
      ```json
      {
        "taskId": "...",
        "status": "in-progress",
        "progress": {
          "percentage": 50,
          "currentStep": "Sampling image...",
          "currentValue": 10,
          "maxValue": 20
        },
        "timestamp": "2025-12-28T00:00:00.000Z"
      }
      ```
    - `complete`: Final event with result data.
      ```json
      {
        "taskId": "task_123456...",
        "status": "completed",
        "progress": {
          "percentage": 100,
          "currentStep": "Complete",
          "currentValue": 20,
          "maxValue": 20
        },
        "result": {
          "imageUrl": "/media/filename.png",
          "audioUrl": "/media/audio_1.mp3",
          "description": "AI-generated prose description...",
          "summary": "Objective visual inventory...",
          "tags": ["portrait", "anime"],
          "prompt": "positive prompt text...",
          "seed": 12345,
          "name": "Generated Name",
          "workflow": "workflow_name",
          "type": "image",
          "inpaint": false,
          "inpaintArea": null,
          "folder": "folder-123",
          "uid": 1715000000000,
          "timeTaken": 45000
        },
        "timestamp": "2025-12-28T00:00:00.000Z"
      }
      ```
    - `error-event`: Emitted if the process fails.
      ```json
      {
        "taskId": "...",
        "status": "error",
        "progress": {
          "percentage": 0,
          "currentStep": "Failed",
          "currentValue": 0,
          "maxValue": 0
        },
        "error": {
          "message": "Error description",
          "details": "Detailed error information"
        },
        "timestamp": "2025-12-28T00:00:00.000Z"
      }
      ```
    - `heartbeat`: Periodic keep-alive ping (every 30s). Format: `: heartbeat`

## Export Endpoints

### List Export Destinations
- **Endpoint**: `GET /exports`
- **Use Case**: Retrieve available export destinations configured on the server.
- **Payload**:
  - `type` (query, string, optional): Filter by media type ('image', 'video', 'audio').
- **Output**: Array of export destination objects.
  ```json
  [
    {
      "id": "example-folder-export",
      "name": "Save to Exports Folder",
      "types": ["image", "video"]
    },
    {
      "id": "example-endpoint-export",
      "name": "Post to API",
      "types": ["image"]
    }
  ]
  ```
- **Error State**: 500 on internal error.

### Export Media
- **Endpoint**: `POST /export`
- **Use Case**: Export a media item to a configured destination (folder or API endpoint).
- **Payload**: JSON body.
  ```json
  {
    "exportId": "example-folder-export",
    "mediaId": 1234567890
  }
  ```
  - `exportId` (string, required): ID of the export destination from config.
  - `mediaId` (integer, required): UID of the media item to export.
- **Output**:
  - For `save` type exports:
    ```json
    {
      "success": true,
      "path": "C:\\exports\\my_image.png"
    }
    ```
  - For `post` type exports:
    ```json
    {
      "success": true,
      "response": { ... endpoint response ... },
      "statusCode": 200
    }
    ```
- **Error State**:
  - 400 if `exportId` or `mediaId` is missing, or if export type is unknown.
  - 404 if export configuration or media not found.
  - 500 on export failure.

### Export Configuration

Exports are configured in `config.json` under the `exports` array. Each export supports:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name for UI |
| `exportType` | string | `"save"` (folder) or `"post"` (API) |
| `types` | array | Media types: `["image", "video", "audio"]` |
| `folderTemplate` | string | Destination folder path (save type) |
| `filenameTemplate` | string | Generated filename template |
| `endpoint` | string | API URL (post type) |
| `prepareDataTasks` | array | Data transformation tasks (post type) |
| `sendProperties` | array | Properties to include in POST (post type) |

#### Template Syntax

Templates use `{{property|pipe1|pipe2}}` syntax:
- `{{name}}` - Direct property access
- `{{name|split-by-spaces|snakecase|lowercase}}` - Property with pipe transformations

**Available Pipes**: `split-by-spaces`, `snakecase`, `camelcase`, `kebabcase`, `titlecase`, `join-by-spaces`, `lowercase`, `uppercase`

For detailed pipe documentation and examples, see [Template Syntax in workflow.md](workflow.md#template-syntax).

#### Conditional Tasks

PrepareDataTasks support conditions using the same logic as workflow conditions:

```json
{
  "template": "landscape",
  "to": "orientationTag",
  "condition": {
    "where": { "data": "orientation" },
    "equals": { "value": "landscape" }
  }
}
```

The condition checks if `data.orientation === "landscape"`. If false, the task is skipped.

For detailed condition syntax and examples, see [Condition Object in workflow.md](workflow.md#condition-object).

