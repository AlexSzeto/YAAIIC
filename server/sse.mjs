/**
 * SSE (Server-Sent Events) module for managing real-time progress updates
 * Handles task tracking, client connections, message buffering, and event emission
 */

const SSE_HEARTBEAT_INTERVAL = 30000; // 30 seconds

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
    return 'Sampling image...';
  }
  if (nodeId.includes('VAE Decode')) {
    return 'Decoding image...';
  }
  if (nodeId.includes('VAE Encode')) {
    return 'Encoding image...';
  }
  if (nodeId.includes('Save')) {
    return 'Saving image...';
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
  
  // Prepend step indicator and update global step values if available
  let updatedProgress = { ...progress };
  if (nodeId && task.stepMap && task.stepMap.has(nodeId)) {
    const stepInfo = task.stepMap.get(nodeId);
    stepTitle = `${stepInfo.stepDisplayText} ${stepTitle}`;
    
    // Use global step counter if totalSteps is available
    if (task.totalSteps) {
      updatedProgress.value = stepInfo.stepNumber - 1; // -1 because we show (stepNumber/total) but value is 0-indexed
      updatedProgress.max = task.totalSteps;
      
      // Calculate granular percentage within the current step
      // Formula: (currentStep/totalSteps) + (1/totalSteps) * nodeCompletionPercentage
      const basePercentage = (stepInfo.stepNumber - 1) / task.totalSteps; // Percentage at start of current step
      const stepWeight = 1 / task.totalSteps; // How much this step contributes to total
      const nodeCompletion = progress.percentage / 100; // Node completion as decimal (0-1)
      
      updatedProgress.percentage = Math.round((basePercentage + stepWeight * nodeCompletion) * 100);
    }
  }
  
  // Fall back to 'Processing...' if no title found
  if (!stepTitle) {
    stepTitle = 'Processing...';
  }
  
  task.progress = { percentage: updatedProgress.percentage, currentStep: stepTitle };
  
  const message = createProgressResponse(taskId, updatedProgress, stepTitle);
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
