import WebSocket from 'ws';

// Store ComfyUI API path locally
let comfyUIAPIPath = null;

// Import emit functions (will be set after module loads to avoid circular dependency)
let emitProgressUpdate = null;
let emitTaskCompletion = null;
let emitTaskError = null;
let logProgressEvent = null;

export function setEmitFunctions(functions) {
  emitProgressUpdate = functions.emitProgressUpdate;
  emitTaskCompletion = functions.emitTaskCompletion;
  emitTaskError = functions.emitTaskError;
  logProgressEvent = functions.logProgressEvent;
}

// Initialize ComfyUI WebSocket with API path
export function initComfyUIWebSocket(apiPath) {
  comfyUIAPIPath = apiPath;
  console.log('ComfyUI WebSocket module initialized with API path:', apiPath);
  // Start the WebSocket connection
  connectToComfyUI();
}

// WebSocket connection to ComfyUI
let comfyUIWebSocket = null;
let wsReconnectTimer = null;
const WS_RECONNECT_DELAY = 3000; // 3 seconds
const CLIENT_ID = 'imagen-server-' + Date.now();

// Track execution state for each prompt
const promptExecutionState = new Map();
// promptExecutionState.set(promptId, {
//   status: 'starting' | 'executing' | 'completed' | 'error',
//   progress: { value: 0, max: 0, percentage: 0 },
//   currentNode: null,
//   startTime: Date.now()
// });

// Initialize WebSocket connection to ComfyUI
function connectToComfyUI() {
  if (!comfyUIAPIPath) {
    console.error('ComfyUI API path not initialized. Call initComfyUIWebSocket first.');
    return;
  }
  
  // Convert HTTP URL to WebSocket URL
  const wsUrl = comfyUIAPIPath.replace(/^http/, 'ws') + '/ws?clientId=' + CLIENT_ID;
  
  console.log(`Connecting to ComfyUI WebSocket at ${wsUrl}`);
  
  try {
    comfyUIWebSocket = new WebSocket(wsUrl);
    
    comfyUIWebSocket.on('open', () => {
      console.log('Connected to ComfyUI WebSocket');
      // Clear any pending reconnect timer
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
    });
    
    comfyUIWebSocket.on('close', () => {
      console.log('ComfyUI WebSocket connection closed, attempting to reconnect...');
      comfyUIWebSocket = null;
      // Schedule reconnection
      if (!wsReconnectTimer) {
        wsReconnectTimer = setTimeout(connectToComfyUI, WS_RECONNECT_DELAY);
      }
    });
    
    comfyUIWebSocket.on('error', (error) => {
      console.error('ComfyUI WebSocket error:', error.message);
    });
    
    // Message handler will be set up in next task
    comfyUIWebSocket.on('message', handleComfyUIMessage);
    
  } catch (error) {
    console.error('Failed to create ComfyUI WebSocket connection:', error);
    // Schedule reconnection
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(connectToComfyUI, WS_RECONNECT_DELAY);
    }
  }
}

// Message handler for ComfyUI WebSocket messages
function handleComfyUIMessage(data) {
  try {
    const message = JSON.parse(data.toString());
    const { type, data: messageData } = message;
    
    // Log all messages for debugging
    console.log('ComfyUI WebSocket message:', type, messageData);
    
    switch (type) {
      case 'execution_start':
        handleExecutionStart(messageData);
        break;
        
      case 'executing':
        handleExecuting(messageData);
        break;
        
      case 'progress':
        handleProgress(messageData);
        break;
        
      case 'execution_cached':
        handleExecutionCached(messageData);
        break;
        
      case 'execution_error':
        handleExecutionError(messageData);
        break;
        
      case 'execution_success':
        handleExecutionSuccess(messageData);
        break;
        
      case 'executed':
        handleExecuted(messageData);
        break;
        
      case 'status':
        // Status messages are informational, can be logged if needed
        break;
        
      default:
        // Unknown message type, log it
        console.log(`Unknown ComfyUI message type: ${type}`, messageData);
        break;
    }
  } catch (error) {
    console.error('Error parsing ComfyUI WebSocket message:', error);
    console.error('Raw data:', data.toString());
  }
}

// Handle execution_start message
function handleExecutionStart(data) {
  const { prompt_id } = data;
  console.log(`Execution started for prompt ${prompt_id}`);
  
  promptExecutionState.set(prompt_id, {
    status: 'starting',
    progress: { value: 0, max: 0, percentage: 0 },
    currentNode: null,
    startTime: Date.now()
  });
  
  // Log ComfyUI websocket event
  if (logProgressEvent) {
    logProgressEvent({ type: 'execution_start' }, 'comfyui-ws', prompt_id, null);
  }
  
  // Note: We don't emit a progress update here anymore since the step counter
  // should continue from where pre-generation left off, and the first 'executing'
  // message will trigger a proper progress update with the correct step number
}

// Handle executing message
function handleExecuting(data) {
  const { node, prompt_id } = data;
  
  if (!prompt_id) return;
  
  const state = promptExecutionState.get(prompt_id);
  if (!state) return;
  
  if (node === null) {
    // Execution completed
    console.log(`Execution completed for prompt ${prompt_id}`);
    state.status = 'completed';
    state.currentNode = null;
    
    // Log ComfyUI websocket event
    if (logProgressEvent) {
      logProgressEvent({ type: 'executing', node: null, status: 'completed' }, 'comfyui-ws', prompt_id, null);
    }
  } else {
    // Currently executing a node
    console.log(`Executing node ${node} for prompt ${prompt_id}`);
    state.status = 'executing';
    state.currentNode = node;
    
    // Log ComfyUI websocket event
    if (logProgressEvent) {
      logProgressEvent({ type: 'executing', node }, 'comfyui-ws', prompt_id, null);
    }
    
    // Emit progress update
    if (emitProgressUpdate) {
      emitProgressUpdate(prompt_id, state.progress, null, node);
    }
  }
}

// Handle progress message
function handleProgress(data) {
  const { node, prompt_id, value, max } = data;
  
  if (!prompt_id) return;
  
  const state = promptExecutionState.get(prompt_id);
  if (!state) return;
  
  // Update progress
  state.progress = {
    value: value,
    max: max,
    percentage: max > 0 ? Math.round((value / max) * 100) : 0
  };
  state.currentNode = node;
  
  console.log(`Progress for prompt ${prompt_id}: ${state.progress.percentage}% (${value}/${max})`);
  
  // Log ComfyUI websocket event
  if (logProgressEvent) {
    logProgressEvent({ type: 'progress', node, value, max, percentage: state.progress.percentage }, 'comfyui-ws', prompt_id, null);
  }
  
  // Emit progress update via SSE
  if (emitProgressUpdate) {
    emitProgressUpdate(prompt_id, state.progress, null, node);
  }
}

// Handle execution_cached message
function handleExecutionCached(data) {
  const { prompt_id, nodes } = data;
  console.log(`Execution cached for prompt ${prompt_id}, nodes: ${nodes.join(', ')}`);
  
  const state = promptExecutionState.get(prompt_id);
  if (state) {
    // Cached nodes are skipped, so they complete instantly
    state.cachedNodes = nodes;
  }
  
  // TODO: Emit progress update via SSE (will be implemented in task 5)
}

// Handle execution_error message
function handleExecutionError(data) {
  const { prompt_id } = data;
  console.error(`Execution error for prompt ${prompt_id}:`, data);
  
  const state = promptExecutionState.get(prompt_id);
  if (state) {
    state.status = 'error';
    state.error = data;
  }
  
  // Emit error via SSE
  if (emitTaskError) {
    emitTaskError(prompt_id, 'ComfyUI execution failed', JSON.stringify(data));
  }
}

// Handle execution_success message
function handleExecutionSuccess(data) {
  const { prompt_id, timestamp } = data;
  console.log(`Execution succeeded for prompt ${prompt_id} at ${timestamp}`);
  
  const state = promptExecutionState.get(prompt_id);
  if (state) {
    state.status = 'completed';
    state.progress.percentage = 100;
    state.completedAt = timestamp;
  }
  
  // TODO: Emit completion via SSE (will be implemented in task 5)
}

// Handle executed message (node completed)
function handleExecuted(data) {
  const { prompt_id, node } = data;
  // console.log(`Node ${node} executed for prompt ${prompt_id}`);
  
  // This is informational, main tracking is done via 'executing' and 'progress'
}

// Export functions and constants
export {
  CLIENT_ID,
  promptExecutionState,
  connectToComfyUI
};
