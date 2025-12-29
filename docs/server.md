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

### Serve Images
- **Endpoint**: `GET /image/:filename`
- **Use Case**: Retrieve generated images, videos, and uploaded assets.
- **Payload**: `filename` path parameter.
- **Output**: Image or video file (e.g., PNG, JPG, WEBP).

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
- **Use Case**: Retrieve the list of available ComfyUI workflows configured on the server.
- **Payload**: None
- **Output**: Array of workflow option objects.
  ```json
  [
    {
      "name": "Text to Image (Example)",
      "type": "image",
      "autocomplete": true,
      "inputImages": 0,
      "optionalPrompt": false,
      "nameRequired": false,
      "orientation": "portrait"
    },
    {
      "name": "Image to Video (Example)",
      "type": "video",
      "autocomplete": false,
      "inputImages": 2,
      "optionalPrompt": true,
      "nameRequired": true,
      "orientation": "detect"
    }
  ]
  ```
- **Error State**: 500 if workflows cannot be loaded.

### Search Image History
- **Endpoint**: `GET /image-data`
- **Use Case**: Search through the history of generated images and videos.
- **Payload**:
  - `query` (query, string): Search term (matches name, description, prompt, or date in yyyy-mm-dd format).
  - `tags` (query, string): Comma-separated list of tags. Results must contain ALL specified tags.
  - `sort` (query, enum): 'ascending' or 'descending' (default).
  - `limit` (query, integer): Max number of results. Default: 10.
- **Output**: Array of image data objects.
- **Error State**: 500 on internal error.

### Get Image Details
- **Endpoint**: `GET /image-data/:uid`
- **Use Case**: Retrieve full details for a specific generated image by its unique ID.
- **Payload**: `uid` path parameter (integer).
- **Output**: Image data object.
  ```json
  {
    "uid": 1234567890,
    "name": "Generated Image",
    "description": "AI-generated prose description...",
    "summary": "Objective visual inventory...",
    "tags": ["portrait", "anime", "female"],
    "prompt": "user prompt text...",
    "imageUrl": "/image/image_1.png",
    "workflow": "workflow_name",
    "type": "image",
    "seed": 12345,
    "inpaint": false,
    "inpaintArea": null,
    "timeTaken": 45000,
    "timestamp": "2025-12-28T00:00:00.000Z"
  }
  ```
- **Error State**:
  - 400 if UID is invalid.
  - 404 if image not found.
  - 500 on internal error.

### Delete Image History
- **Endpoint**: `DELETE /image-data/delete`
- **Use Case**: Delete multiple image history entries.
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

### Edit Image Data
- **Endpoint**: `POST /edit`
- **Use Case**: Update metadata for an existing image entry.
- **Payload**: JSON body with complete image data object.
  ```json
  {
    "uid": 1234567890,
    "name": "Updated Name",
    "description": "Updated description...",
    "tags": ["updated", "tags"],
    ...
  }
  ```
  - `uid` (integer, required): The unique ID of the image to update.
  - All other fields will replace the existing entry.
- **Output**:
  ```json
  {
    "success": true,
    "data": { ... updated image object ... }
  }
  ```
- **Error State**:
  - 400 if `uid` is missing or not an integer.
  - 404 if image with specified UID not found.
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
    "imageData": { ... full updated image object ... },
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

### Generate (Image/Video)
- **Endpoint**: `POST /generate`
- **Use Case**: Initiate image or video generation using a configured ComfyUI workflow.
- **Payload**: `multipart/form-data` or JSON body depending on workflow requirements.

  **For workflows with input images** (`multipart/form-data`):
  - `workflow` (string, required): Workflow name.
  - `prompt` (string, required unless `optionalPrompt` is true): Positive prompt text.
  - `name` (string, required if `nameRequired` is true): Name for the output.
  - `seed` (integer, optional): Random seed. Auto-generated if omitted.
  - `image_0` (file, if `inputImages >= 1`): First input image.
  - `image_1` (file, if `inputImages >= 2`): Second input image.
  - `orientation` (string, optional): 'portrait', 'landscape', or 'square' (only when `orientation: "detect"`).

  **For text-only workflows** (JSON body):
  ```json
  {
    "workflow": "workflow_name",
    "prompt": "positive prompt text",
    "seed": 12345,
    "name": "Optional Name",
    "orientation": "portrait"
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
    - **Pre-Generation Tasks**: If configured, LLM tasks run to prepare data (e.g., auto-generate prompts).
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
          "imageUrl": "/image/filename.png",
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
