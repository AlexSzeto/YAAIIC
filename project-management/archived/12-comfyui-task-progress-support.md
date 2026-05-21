# ComfyUI Task Progress Support

## Goals
Let the server create its internal task tracking system. When the client makes a generation request, immediately create and send the `taskId` and the client would track the progress through the completion of the task using SSE (Server-Sent Events). The websocket connection should only be used between the server and ComfyUI's API, and the client should only receive progress through SSE.

[x] Connect to ComfyUI's WebSocket API for progress tracking
1. Install `ws` package for WebSocket support on server
2. Create WebSocket connection to ComfyUI in `server/generate.mjs`
3. Listen for ComfyUI WebSocket connection open/close/error events
4. Subscribe to prompt execution using client_id when sending prompt to ComfyUI

[x] Parse ComfyUI WebSocket messages to extract progress data
1. Add WebSocket message listener in `server/generate.mjs`
2. Parse incoming messages to identify message types: `execution_start`, `executing`, `progress`, `execution_cached`, `execution_error`, `execution_success`, `executed`, `status`
3. Extract relevant data from progress messages (node, prompt_id, value, max)
4. Extract node and prompt_id from executing messages
5. Calculate completion percentage based on progress data (value / max * 100)
6. Track execution state using execution_start and execution_success messages
```javascript
// ComfyUI WebSocket message format (based on official docs)
// Progress message
{
  type: "progress",
  data: {
    node: "node_id",
    prompt_id: "abc123",
    value: 5,
    max: 20
  }
}

// Executing message
{
  type: "executing",
  data: {
    node: "node_id",  // or null when execution completes
    prompt_id: "abc123"
  }
}

// Execution start message
{
  type: "execution_start",
  data: {
    prompt_id: "abc123"
  }
}

// Execution cached message
{
  type: "execution_cached",
  data: {
    prompt_id: "abc123",
    nodes: ["node_id1", "node_id2"]  // nodes being skipped
  }
}

// Execution success message
{
  type: "execution_success",
  data: {
    prompt_id: "abc123",
    timestamp: 1234567890
  }
}
```

[x] Create SSE response format for generation in progress
1. Define progress SSE response format in `server/generate.mjs`
```javascript
// Progress SSE response format
{
  taskId: "unique-task-id",
  status: "in-progress",
  progress: {
    percentage: 45,
    currentStep: "Sampling image...",
    currentValue: 9,
    maxValue: 20
  },
  timestamp: "2025-11-25T12:34:56.789Z"
}
```

[x] Create SSE response format for completed tasks
1. Define completion SSE response format in `server/generate.mjs`
```javascript
// Completion SSE response format
{
  taskId: "unique-task-id",
  status: "completed",
  progress: {
    percentage: 100,
    currentStep: "Complete",
    currentValue: 20,
    maxValue: 20
  },
  result: {
    imageUrl: "/image/image_123.png",
    description: "Generated image description",
    prompt: "original prompt",
    seed: 12345,
    name: "Character name",
    workflow: "workflow-name",
    inpaint: false,
    inpaintArea: null,
    uid: 1732543210123
  },
  timestamp: "2025-11-25T12:35:30.123Z"
}
```
2. Define error SSE response format
```javascript
// Error SSE response format
{
  taskId: "unique-task-id",
  status: "error",
  progress: {
    percentage: 0,
    currentStep: "Failed",
    currentValue: 0,
    maxValue: 0
  },
  error: {
    message: "Generation failed",
    details: "Error details from ComfyUI"
  },
  timestamp: "2025-11-25T12:35:30.123Z"
}
```

[x] Modify server-side prompt execution flow to emit progress updates
1. Create in-memory task tracking map in `server/generate.mjs` to store active tasks by taskId
2. Generate unique taskId using timestamp + random string in `handleImageGeneration`
3. Store task metadata (prompt, workflow, clientId, startTime) in task tracking map
4. Return immediate response with taskId when generation request is received
5. Set up WebSocket message handler to update task progress in tracking map
6. Create Server-Sent Events (SSE) endpoint `/progress/:taskId` for client subscriptions
7. Emit progress updates to subscribed clients via SSE when WebSocket receives updates
8. Emit completion/error events via SSE when generation finishes
9. Clean up completed tasks from tracking map after 5 minutes
```javascript
// Task tracking structure
const activeTasks = new Map();
// activeTasks.set(taskId, {
//   prompt: "...",
//   workflow: "...",
//   startTime: Date.now(),
//   progress: { percentage: 0, currentStep: "Starting..." },
//   sseClients: Set of response objects,
//   promptId: "comfyui-prompt-id"
// });
```

[x] Create client-side SSE management library
1. Create `public/js/sse-manager.mjs` file
2. Implement SSEManager class with EventSource for SSE
3. Add public methods: `subscribe(taskId, onProgress, onComplete, onError)`, `unsubscribe(taskId)`
4. Add private methods: `_handleMessage(event)`, `_cleanup(taskId)`
5. Manage EventSource connections per taskId
6. Parse incoming SSE messages and route to appropriate callbacks
7. Handle reconnection logic with exponential backoff
8. Clean up EventSource when task completes or errors
```javascript
// public/js/sse-manager.mjs
class SSEManager {
  constructor() // Initialize connections map
  // Private: activeConnections Map<taskId, {eventSource, callbacks}>
  
  subscribe(taskId, callbacks) // callbacks: {onProgress, onComplete, onError}
  unsubscribe(taskId) // Close EventSource and cleanup
  
  _handleMessage(taskId, event) // Parse and route SSE messages
  _handleError(taskId, error) // Handle connection errors
  _cleanup(taskId) // Remove from activeConnections
}

export const sseManager = new SSEManager(); // Singleton instance
```

[x] Render progress banner at the top of the page
1. Create `public/js/custom-ui/progress-banner.mjs` file
2. Implement ProgressBanner as Preact Component class
3. Add props: `taskId`, `sseManager`
4. Add state: `isVisible`, `progress`, `message`, `status`, `percentage`
5. Render fixed position banner at top of page with inline progress bar display
6. Render progress bar with percentage fill, message text, and smooth CSS transitions
7. Add dismiss button to hide banner
8. Subscribe to SSE updates in `componentDidMount`
9. Unsubscribe in `componentWillUnmount`
```javascript
// public/js/custom-ui/progress-banner.mjs
class ProgressBanner extends Component {
  constructor(props) // props: taskId, sseManager, onComplete
  // State: isVisible, progress, message, status, percentage
  
  componentDidMount() // Subscribe to SSE
  componentWillUnmount() // Unsubscribe from SSE
  
  handleDismiss() // Hide banner
  handleProgressUpdate(data) // Update state with progress data
  handleComplete(data) // Handle completion, call onComplete callback
  handleError(error) // Show error state
  
  render() // Render banner with inline progress bar display
}
```

[x] Update banner with task name and completion percentage
1. Map ComfyUI node types to human-readable step names in progress-banner.mjs
2. Update message text based on current node being executed
3. Update percentage based on (currentValue / maxValue * 100)
4. Show estimated time remaining based on progress rate
```javascript
// Node type to step name mapping
const NODE_STEP_NAMES = {
  "KSampler": "Sampling image...",
  "VAEDecode": "Decoding image...",
  "SaveImage": "Saving image...",
  "CLIPTextEncode": "Encoding prompt...",
  "CheckpointLoaderSimple": "Loading model...",
  // ... more mappings
};
```

[x] Handle SSE completion event to trigger existing response handling code
1. In progress-banner.mjs, call `onComplete` callback with result data when status is "completed"
2. Pass result data to existing image display handlers (CarouselDisplay.addData)
3. Hide banner after completion
4. Show success toast notification

[x] Integrate SSE library into index page
1. Import SSEManager and ProgressBanner in `public/js/main.mjs`
2. Modify `handleGenerate` to parse taskId from immediate server response
3. Create and mount ProgressBanner component with taskId
4. Pass onComplete callback to ProgressBanner to handle result data
5. Update existing generation flow to work with async SSE pattern
6. Remove synchronous waiting logic from generate button handler

[x] Fix SSE event emission to include event type headers
1. Modify `emitSSEToTask` function in `server/generate.mjs` to include event type based on message status
2. Update SSE message format to include `event:` header before `data:` header
3. Map message status to event types: `in-progress` → `progress`, `completed` → `complete`, `error` → `error-event`
4. Update initial SSE message in `handleSSEConnection` to use `progress` event type
5. Add keep-alive heartbeat mechanism (send comment every 30 seconds: `: heartbeat\n\n`)
6. Create interval timer for each SSE connection to send periodic heartbeats
7. Clear heartbeat interval when client disconnects
8. Store heartbeat interval ID in task object for cleanup
```javascript
// Correct SSE message format with event type
function emitSSEToTask(taskId, message) {
  const task = activeTasks.get(taskId);
  if (!task || !task.sseClients) return;
  
  // Determine event type based on message status
  let eventType = 'progress';
  if (message.status === 'completed') eventType = 'complete';
  if (message.status === 'error') eventType = 'error-event';
  
  const data = JSON.stringify(message);
  
  task.sseClients.forEach(client => {
    try {
      client.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } catch (error) {
      console.error(`Failed to send SSE to client for task ${taskId}:`, error);
      disconnectedClients.add(client);
    }
  });
}

// In handleSSEConnection, set up heartbeat
const heartbeatInterval = setInterval(() => {
  try {
    res.write(': heartbeat\n\n');
  } catch (error) {
    clearInterval(heartbeatInterval);
  }
}, 30000);

// Store interval for cleanup
if (!task.heartbeatIntervals) {
  task.heartbeatIntervals = new Map();
}
task.heartbeatIntervals.set(res, heartbeatInterval);

// On disconnect, clear interval
req.on('close', () => {
  const interval = task.heartbeatIntervals?.get(res);
  if (interval) {
    clearInterval(interval);
    task.heartbeatIntervals.delete(res);
  }
});
```
