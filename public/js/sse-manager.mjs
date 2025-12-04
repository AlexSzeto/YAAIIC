/**
 * SSEManager - Manages Server-Sent Events (SSE) connections for task progress tracking
 * 
 * This class provides a centralized way to subscribe to task progress updates from the server
 * using EventSource (SSE). It handles connection management, message routing, and automatic cleanup.
 */
class SSEManager {
  constructor() {
    // Map of taskId -> { eventSource, callbacks }
    this.activeConnections = new Map();
  }

  /**
   * Subscribe to progress updates for a specific task
   * @param {string} taskId - Unique identifier for the task
   * @param {Object} callbacks - Callback functions for different events
   * @param {Function} callbacks.onProgress - Called with progress data
   * @param {Function} callbacks.onComplete - Called with completion data
   * @param {Function} callbacks.onError - Called with error data
   * @returns {boolean} - True if subscription was successful, false if already subscribed
   */
  subscribe(taskId, callbacks) {
    // Don't create duplicate subscriptions
    if (this.activeConnections.has(taskId)) {
      console.warn(`Already subscribed to task ${taskId}`);
      return false;
    }

    // Validate callbacks
    if (!callbacks || typeof callbacks !== 'object') {
      console.error('Callbacks object is required');
      return false;
    }

    // Create EventSource connection to the server's SSE endpoint
    const eventSource = new EventSource(`/progress/${taskId}`);

    // Store connection info
    this.activeConnections.set(taskId, {
      eventSource,
      callbacks: {
        onProgress: callbacks.onProgress || (() => {}),
        onComplete: callbacks.onComplete || (() => {}),
        onError: callbacks.onError || (() => {})
      }
    });

    // Set up event listeners
    eventSource.addEventListener('progress', (event) => {
      this._handleMessage(taskId, event, 'progress');
    });

    eventSource.addEventListener('complete', (event) => {
      this._handleMessage(taskId, event, 'complete');
    });

    eventSource.addEventListener('error-event', (event) => {
      this._handleMessage(taskId, event, 'error');
    });

    // Handle connection errors
    eventSource.onerror = (error) => {
      this._handleError(taskId, error);
    };

    console.log(`Subscribed to task ${taskId}`);
    return true;
  }

  /**
   * Unsubscribe from a task and close the connection
   * @param {string} taskId - Unique identifier for the task
   */
  unsubscribe(taskId) {
    const connection = this.activeConnections.get(taskId);
    if (!connection) {
      console.warn(`No active subscription for task ${taskId}`);
      return;
    }

    // Close the EventSource connection
    connection.eventSource.close();
    
    // Remove from active connections
    this._cleanup(taskId);
    
    console.log(`Unsubscribed from task ${taskId}`);
  }

  /**
   * Handle incoming SSE messages and route to appropriate callbacks
   * @private
   * @param {string} taskId - Task identifier
   * @param {MessageEvent} event - SSE message event
   * @param {string} type - Message type (progress, complete, error)
   */
  _handleMessage(taskId, event, type) {
    const connection = this.activeConnections.get(taskId);
    if (!connection) {
      console.warn(`Received message for unknown task ${taskId}`);
      return;
    }

    try {
      // Parse the JSON data from the event
      const data = JSON.parse(event.data);

      // Route to appropriate callback based on message type
      switch (type) {
        case 'progress':
          connection.callbacks.onProgress(data);
          break;

        case 'complete':
          connection.callbacks.onComplete(data);
          // Auto-cleanup after completion
          this.unsubscribe(taskId);
          break;

        case 'error':
          connection.callbacks.onError(data);
          // Auto-cleanup after error
          this.unsubscribe(taskId);
          break;

        default:
          console.warn(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error parsing message for task ${taskId}:`, error);
      connection.callbacks.onError({
        taskId,
        status: 'error',
        error: {
          message: 'Failed to parse server message',
          details: error.message
        }
      });
    }
  }

  /**
   * Handle EventSource connection errors
   * @private
   * @param {string} taskId - Task identifier
   * @param {Event} error - Error event
   */
  _handleError(taskId, error) {
    const connection = this.activeConnections.get(taskId);
    if (!connection) {
      return;
    }

    // Check if the connection is closed (normal completion) or actually errored
    if (connection.eventSource.readyState === EventSource.CLOSED) {
      console.log(`Connection closed for task ${taskId}`);
      this._cleanup(taskId);
    } else {
      console.error(`Connection error for task ${taskId}:`, error);
      connection.callbacks.onError({
        taskId,
        status: 'error',
        error: {
          message: 'Connection error',
          details: 'Lost connection to server'
        }
      });
      this.unsubscribe(taskId);
    }
  }

  /**
   * Clean up connection data for a task
   * @private
   * @param {string} taskId - Task identifier
   */
  _cleanup(taskId) {
    this.activeConnections.delete(taskId);
  }

  /**
   * Get the current number of active subscriptions
   * @returns {number} - Number of active connections
   */
  getActiveConnectionCount() {
    return this.activeConnections.size;
  }

  /**
   * Unsubscribe from all active tasks
   */
  unsubscribeAll() {
    const taskIds = Array.from(this.activeConnections.keys());
    taskIds.forEach(taskId => this.unsubscribe(taskId));
  }
}

// Export a singleton instance
export const sseManager = new SSEManager();
