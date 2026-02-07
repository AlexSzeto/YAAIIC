/**
 * SSE (Server-Sent Events) module for managing real-time progress updates
 * Handles task tracking, client connections, message buffering, and event emission
 */

import fs from 'fs';
import path from 'path';

const SSE_HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Progress logging utilities
const LOGS_DIR = path.join(process.cwd(), 'server', 'logs');
const PROGRESS_LOG_PATH = path.join(LOGS_DIR, 'sent-progress.json');

/**
 * Reset the sent-progress.json log file at the start of a task
 */
export function resetProgressLog() {
  try {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    
    // Clear or create sent-progress.json with empty array
    fs.writeFileSync(PROGRESS_LOG_PATH, JSON.stringify([], null, 2), 'utf-8');
  } catch (error) {
    console.error('Error resetting progress log:', error);
  }
}

/**
 * Log a progress event to sent-progress.json
 * @param {Object} eventData - The event data to log
 * @param {string} source - Source of event: 'comfyui-ws', 'emit-progress', 'emit-complete', 'emit-error'
 * @param {string} promptId - Optional ComfyUI prompt ID
 * @param {string} taskId - Optional task ID
 */
export function logProgressEvent(eventData, source, promptId = null, taskId = null) {
  try {
    // Read existing log
    let log = [];
    if (fs.existsSync(PROGRESS_LOG_PATH)) {
      const content = fs.readFileSync(PROGRESS_LOG_PATH, 'utf-8');
      log = JSON.parse(content);
    }
    
    // Add new entry
    log.push({
      timestamp: new Date().toISOString(),
      source,
      promptId,
      taskId,
      data: eventData
    });
    
    // Write back
    fs.writeFileSync(PROGRESS_LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - logging should not interrupt main functionality
    console.error('Error logging progress event:', error);
  }
}

// Task tracking system
const activeTasks = new Map();
// activeTasks.set(taskId, {
//   prompt: "...",
//   workflow: "...",
//   startTime: Date.now(),
//   progress: { percentage: 0, currentStep: "Starting..." },
//   sseClients: Set of response objects,
//   promptId: "comfyui-prompt-id",
//   requestData: { ... original request data ... },
//   workflowConfig: { ... workflow configuration ... },
//   messageBuffer: Array of buffered messages,
//   heartbeatIntervals: Map of response -> interval
// });

// Map promptId to taskId for reverse lookup
const promptIdToTaskId = new Map();

// Response format builders
function createProgressResponse(taskId, progress, currentStep) {
  return {
    taskId: taskId,
    status: 'in-progress',
    progress: {
      percentage: progress.percentage || 0,
      currentStep: currentStep || 'Processing...',
      currentValue: progress.value || 0,
      maxValue: progress.max || 0
    },
    timestamp: new Date().toISOString()
  };
}

function createCompletionResponse(taskId, result) {
  // Extract maxValue if present, otherwise default to 1
  const maxValue = result.maxValue || 1;
  
  // Create a copy of result without maxValue for the result field
  const { maxValue: _, ...resultData } = result;
  
  return {
    taskId: taskId,
    status: 'completed',
    progress: {
      percentage: 100,
      currentStep: 'Complete',
      currentValue: maxValue,
      maxValue: maxValue
    },
    result: resultData,
    timestamp: new Date().toISOString()
  };
}

function createErrorResponse(taskId, errorMessage, errorDetails) {
  return {
    taskId: taskId,
    status: 'error',
    progress: {
      percentage: 0,
      currentStep: 'Failed',
      currentValue: 0,
      maxValue: 0
    },
    error: {
      message: errorMessage || 'Generation failed',
      details: errorDetails || 'Unknown error'
    },
    timestamp: new Date().toISOString()
  };
}

// Function to emit SSE message to all subscribed clients for a task
function emitSSEToTask(taskId, message) {
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  // Determine event type based on message status
  let eventType = 'progress';
  if (message.status === 'completed') eventType = 'complete';
  if (message.status === 'error') eventType = 'error-event';
  
  const data = JSON.stringify(message);
  
  // If no clients are connected yet, buffer the message
  if (!task.sseClients || task.sseClients.size === 0) {
    if (!task.messageBuffer) {
      task.messageBuffer = [];
    }
    task.messageBuffer.push({ eventType, data, message });
    console.log(`Buffered ${eventType} message for task ${taskId} (no clients connected yet)`);
    return;
  }
  
  const disconnectedClients = new Set();
  
  task.sseClients.forEach(client => {
    try {
      client.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } catch (error) {
      console.error(`Failed to send SSE to client for task ${taskId}:`, error);
      disconnectedClients.add(client);
    }
  });
  
  // Remove disconnected clients
  disconnectedClients.forEach(client => task.sseClients.delete(client));
}

// Function to generate unique task ID
export function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Clean up completed tasks after delay
function scheduleTaskCleanup(taskId) {
  setTimeout(() => {
    const task = activeTasks.get(taskId);
    if (task) {
      // Close all SSE connections
      if (task.sseClients) {
        task.sseClients.forEach(client => {
          try {
            client.end();
          } catch (error) {
            // Ignore errors when closing
          }
        });
      }
      // Remove from maps
      if (task.promptId) {
        promptIdToTaskId.delete(task.promptId);
      }
      activeTasks.delete(taskId);
      console.log(`Cleaned up task ${taskId}`);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Map node IDs to human-readable step names based on node type patterns
function getNodeStepName(nodeId) {
  // This is a basic implementation - could be enhanced with node type info
  if (!nodeId) return 'Processing...';
  
  // Common ComfyUI node patterns
  if (nodeId.includes('Sampler') || nodeId.includes('KSampler')) {
    return 'Sampling data...';
  }
  if (nodeId.includes('VAE Decode')) {
    return 'Decoding data...';
  }
  if (nodeId.includes('VAE Encode')) {
    return 'Encoding data...';
  }
  if (nodeId.includes('Save')) {
    return 'Saving data...';
  }
  if (nodeId.includes('CLIP') || nodeId.includes('Encode')) {
    return 'Encoding prompt...';
  }
  if (nodeId.includes('Checkpoint') || nodeId.includes('Loader')) {
    return 'Loading model...';
  }
  if (nodeId.includes('Upscale')) {
    return 'Upscaling image...';
  }
  
  return `Processing ${nodeId}...`;
}

// Helper function to extract step title from workflow JSON
function getStepTitleFromWorkflow(workflowData, nodeId) {
  if (!nodeId) return null;
  
  // If we have workflow data, try to get the _meta.title field
  if (workflowData) {
    const node = workflowData[nodeId];
    if (node?._meta?.title) {
      nodeId = node._meta.title;
    }
  }
  
  // Fall back to user-friendly titles based on node ID patterns
  return getNodeStepName(nodeId);
}

// Export functions for use in WebSocket handlers
export function emitProgressUpdate(promptIdOrTaskId, progress, currentStep, nodeId = null) {
  // Try to resolve as promptId first, then as taskId
  let taskId = promptIdToTaskId.get(promptIdOrTaskId);
  if (!taskId) {
    // Check if it's already a taskId
    if (activeTasks.has(promptIdOrTaskId)) {
      taskId = promptIdOrTaskId;
    } else {
      return; // Not found
    }
  }
  
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  // Try to get step title from workflow JSON if nodeId is provided
  let stepTitle = currentStep;
  if (nodeId && task.workflowData) {
    const workflowTitle = getStepTitleFromWorkflow(task.workflowData, nodeId);
    if (workflowTitle) {
      stepTitle = workflowTitle;
    }
  }
  
  // Update global step values if available using new method
  let updatedProgress = { ...progress };
  if (nodeId && task.importantNodes && task.totalSteps && task.currentStep !== undefined) {
    const isImportantNode = task.importantNodes.has(nodeId);
    
    if (isImportantNode) {
      // This is an important node - advance the counter if we haven't already for this node
      if (!task.processedNodes) {
        task.processedNodes = new Set();
      }
      
      if (!task.processedNodes.has(nodeId)) {
        task.processedNodes.add(nodeId);
        task.currentStep++;
        // Note: This modifies the task object, which is a reference
      }
      
      // Calculate percentage progress: (progressPercent / 100 + currentStep - 1) / totalSteps
      // currentStep - 1 because we just incremented it
      const basePercentage = (task.currentStep - 1) / task.totalSteps;
      const stepWeight = 1 / task.totalSteps;
      const nodeCompletion = progress.percentage / 100;
      
      updatedProgress.percentage = Math.round((basePercentage + stepWeight * nodeCompletion) * 100);
      updatedProgress.value = task.currentStep - 1; // 0-indexed
      updatedProgress.max = task.totalSteps;
    } else {
      // Not an important node - change the name but don't advance progress
      // Keep the current percentage
      updatedProgress.percentage = task.progress?.percentage || 0;
      updatedProgress.value = task.currentStep;
      updatedProgress.max = task.totalSteps;
    }
  }
  
  // Fall back to 'Processing...' if no title found
  if (!stepTitle) {
    stepTitle = 'Processing...';
  }
  
  task.progress = { percentage: updatedProgress.percentage, currentStep: stepTitle };
  
  const message = createProgressResponse(taskId, updatedProgress, stepTitle);
  
  // Log progress event
  logProgressEvent(message.progress, 'emit-progress', task.promptId, taskId);
  
  emitSSEToTask(taskId, message);
}

export function emitTaskCompletion(promptIdOrTaskId, result) {
  // Try to resolve as promptId first, then as taskId
  let taskId = promptIdToTaskId.get(promptIdOrTaskId);
  if (!taskId) {
    // Check if it's already a taskId
    if (activeTasks.has(promptIdOrTaskId)) {
      taskId = promptIdOrTaskId;
    } else {
      return; // Not found
    }
  }
  
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  const message = createCompletionResponse(taskId, result);
  
  // Log completion event
  logProgressEvent({ result: message.result }, 'emit-complete', task.promptId, taskId);
  
  emitSSEToTask(taskId, message);
  
  scheduleTaskCleanup(taskId);
}

export function emitTaskError(promptIdOrTaskId, errorMessage, errorDetails) {
  // Try to resolve as promptId first, then as taskId
  let taskId = promptIdToTaskId.get(promptIdOrTaskId);
  if (!taskId) {
    // Check if it's already a taskId
    if (activeTasks.has(promptIdOrTaskId)) {
      taskId = promptIdOrTaskId;
    } else {
      return; // Not found
    }
  }
  
  emitTaskErrorByTaskId(taskId, errorMessage, errorDetails);
}

// Emit error using taskId directly (for errors before promptId is available)
export function emitTaskErrorByTaskId(taskId, errorMessage, errorDetails) {
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  const message = createErrorResponse(taskId, errorMessage, errorDetails);
  
  // Log error event
  logProgressEvent({ error: message.error }, 'emit-error', task.promptId, taskId);
  
  emitSSEToTask(taskId, message);
  
  scheduleTaskCleanup(taskId);
}

// SSE endpoint handler
export function handleSSEConnection(req, res) {
  const { taskId } = req.params;
  
  const task = activeTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Add client to task's SSE clients
  if (!task.sseClients) {
    task.sseClients = new Set();
  }
  task.sseClients.add(res);
  
  console.log(`SSE client connected for task ${taskId}`);
  
  // Send buffered messages if any exist
  if (task.messageBuffer && task.messageBuffer.length > 0) {
    console.log(`Replaying ${task.messageBuffer.length} buffered message(s) for task ${taskId}`);
    task.messageBuffer.forEach(({ eventType, data }) => {
      try {
        res.write(`event: ${eventType}\ndata: ${data}\n\n`);
      } catch (error) {
        console.error(`Failed to replay buffered message for task ${taskId}:`, error);
      }
    });
    // Clear the buffer after sending
    task.messageBuffer = [];
  } else {
    // Send initial progress state if no buffered messages
    const initialMessage = createProgressResponse(
      taskId,
      task.progress || { percentage: 0, value: 0, max: 0 },
      task.progress?.currentStep || 'Starting...'
    );
    res.write(`event: progress\ndata: ${JSON.stringify(initialMessage)}\n\n`);
  }
  
  // Set up heartbeat to keep connection alive (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      clearInterval(heartbeatInterval);
    }
  }, SSE_HEARTBEAT_INTERVAL);
  
  // Store heartbeat interval for cleanup
  if (!task.heartbeatIntervals) {
    task.heartbeatIntervals = new Map();
  }
  task.heartbeatIntervals.set(res, heartbeatInterval);
  
  // Handle client disconnect
  req.on('close', () => {
    task.sseClients.delete(res);
    const interval = task.heartbeatIntervals?.get(res);
    if (interval) {
      clearInterval(interval);
      task.heartbeatIntervals.delete(res);
    }
    console.log(`SSE client disconnected for task ${taskId}`);
  });
}

// Task management functions
export function createTask(taskId, taskData) {
  activeTasks.set(taskId, {
    ...taskData,
    startTime: Date.now(),
    progress: { percentage: 0, currentStep: 'Starting...' },
    sseClients: new Set(),
    messageBuffer: []
  });
}

export function getTask(taskId) {
  return activeTasks.get(taskId);
}

export function updateTask(taskId, updates) {
  const task = activeTasks.get(taskId);
  if (task) {
    Object.assign(task, updates);
  }
}

export function deleteTask(taskId) {
  const task = activeTasks.get(taskId);
  if (task?.promptId) {
    promptIdToTaskId.delete(task.promptId);
  }
  activeTasks.delete(taskId);
}

export function setTaskPromptId(taskId, promptId) {
  const task = activeTasks.get(taskId);
  if (task) {
    task.promptId = promptId;
    promptIdToTaskId.set(promptId, taskId);
  }
}

export function getTaskByPromptId(promptId) {
  const taskId = promptIdToTaskId.get(promptId);
  return taskId ? activeTasks.get(taskId) : null;
}
