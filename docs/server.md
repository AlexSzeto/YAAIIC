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
- **Use Case**: Retrieve generated images and uploaded assets.
- **Payload**: `filename` path parameter.
- **Output**: Image file (e.g., PNG).

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
      ...
    }
  }
  ```
- **Error State**: 500 if the source CSV file cannot be read.

### List Workflows
- **Endpoint**: `GET /generate/workflows`
- **Use Case**: Retrieve the list of available ComfyUI workflows configured on the server.
- **Payload**: None
- **Output**: Array of workflow objects.
  ```json
  [
    {
      "name": "workflow_name",
      "type": "txt2img",
      "autocomplete": true
    },
    ...
  ]
  ```
- **Error State**: 500 if workflows cannot be loaded.

### Search Image History
- **Endpoint**: `GET /image-data`
- **Use Case**: Search through the history of generated images.
- **Payload**:
  - `query` (query, string): Search term (matches name, description, prompt, or date).
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
    "prompt": "...",
    "imageUrl": "/image/...",
    ...
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

## Generation Endpoints & Workflow

### Text-to-Image Generation
- **Endpoint**: `POST /generate/txt2img`
- **Use Case**: Initiate a standard text-to-image generation task.
- **Payload**: JSON body.
  ```json
  {
    "workflow": "workflow_name", // Required
    "prompt": "positive prompt text", // Required
    "seed": 12345, // Optional, random if omitted
    "name": "Optional Name", // Optional
    // Additional workflow-specific parameters
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
  - 400 if `workflow` is missing or invalid.
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
    - Client sends a POST request to `/generate/txt2img` or `/generate/inpaint`.
    - Server creates a background task and immediately returns a `taskId`.

2.  **Subscribe to Updates**:
    - Client opens an EventSource connection to `/progress/:taskId`.
    - Server buffers messages if the client hasn't connected yet.

3.  **Process Stages (Server-Side)**:
    - **Validation & Setup**: Server verifies inputs and prepares the ComfyUI workflow.
    - **Queuing**: Request is sent to the ComfyUI backend.
    - **Generation**: ComfyUI processes the image. SSE events emit progress percentages.
    - **Analysis (Optional)**: If configured, the generated image is analyzed (e.g., by Ollama).
    - **Completion**: Image is saved, and a final event is emitted.

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
        }
      }
      ```
    - `complete`: Final event with result data.
      ```json
      {
        "taskId": "task_123456...",
        "status": "completed",
        "result": {
          "imageUrl": "/image/filename.png",     // Path to the generated image
          "description": "Analyzed description of image...", // From Ollama analysis (if enabled)
          "prompt": "positive prompt text...",   // The prompt used for generation
          "seed": 12345,                         // The seed used
          "name": "Generated Name",              // Name (provided or generated)
          "workflow": "workflow_name",           // The name of the workflow used
          "inpaint": false,                      // Boolean indicating if this was an inpaint task
          "inpaintArea": null,                   // Object {x1, y1, x2, y2} if inpaint area was specified
          "uid": 1715000000000,                  // Unique ID in the image database
          "maxValue": 20                         // Total steps/max value for progress
        }
      }
      ```
    - `error-event`: Emitted if the process fails.
      ```json
      {
        "taskId": "...",
        "status": "error",
        "error": { "message": "..." }
      }
      ```
    - `heartbeat`: Periodic keep-alive ping (every 30s).
