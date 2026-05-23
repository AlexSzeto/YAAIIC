/**
 * QueueSSEManager – singleton EventSource connection to /queue/sse.
 *
 * Components subscribe with callbacks; the manager reconnects automatically
 * if the connection drops, and broadcasts every queue event to all subscribers.
 */

class QueueSSEManager {
  constructor() {
    this._eventSource = null;
    this._subscribers = new Map();
    this._nextId = 1;
    this._reconnectTimer = null;
    this._connected = false;
    this._connectListeners = [];
  }

  _connect() {
    if (this._eventSource) {
      console.log('[QueueSSE] _connect called but _eventSource already exists');
      return;
    }

    console.log('[QueueSSE] Connecting to /queue/sse...');
    this._eventSource = new EventSource('/queue/sse');

    this._eventSource.addEventListener('queue:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log(`[QueueSSE] Event 'queue:updated' received. State: ${data.state}, Items count: ${data.items?.length}`);
        this._broadcast('queue:updated', data);
      } catch (err) {
        console.error('[QueueSSE] Error parsing queue:updated data:', err);
      }
    });

    this._eventSource.addEventListener('queue:task-started', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log(`[QueueSSE] Event 'queue:task-started' received. TaskId: ${data.taskId}, subLabel: ${data.subLabel}`);
        this._broadcast('queue:task-started', data);
      } catch (err) {
        console.error('[QueueSSE] Error parsing queue:task-started data:', err);
      }
    });

    this._eventSource.onopen = () => {
      console.log(`[QueueSSE] EventSource connection opened. readyState=${this._eventSource?.readyState}`);
      this._connected = true;
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
      console.log(`[QueueSSE] Triggering ${this._connectListeners.length} onConnect listener(s)`);
      for (const fn of this._connectListeners) {
        try {
          fn();
        } catch (err) {
          console.error('[QueueSSE] Error in onConnect listener:', err);
        }
      }
    };

    this._eventSource.onerror = (err) => {
      const state = this._eventSource ? this._eventSource.readyState : 'null';
      console.error(`[QueueSSE] EventSource error. readyState=${state}, connected=${this._connected}, subscribers=${this._subscribers.size}`, err);
      this._connected = false;
      if (this._eventSource) {
        this._eventSource.close();
        this._eventSource = null;
      }
      if (this._subscribers.size > 0 && !this._reconnectTimer) {
        console.log('[QueueSSE] Scheduling reconnect in 5000ms');
        this._reconnectTimer = setTimeout(() => {
          this._reconnectTimer = null;
          this._connect();
        }, 5000);
      }
    };
  }

  _disconnect() {
    console.log('[QueueSSE] Disconnecting EventSource...');
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
    this._connected = false;
  }

  _broadcast(event, payload) {
    for (const [id, { callbacks }] of this._subscribers.entries()) {
      const fn = callbacks[event];
      if (typeof fn === 'function') {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[QueueSSE] Error in subscriber callback for ID ${id}, event ${event}:`, err);
        }
      }
    }
  }

  /**
   * Register a listener that fires whenever the SSE connection (re)opens.
   * @param {Function} fn
   * @returns {Function} unregister function
   */
  onConnect(fn) {
    this._connectListeners.push(fn);
    return () => {
      this._connectListeners = this._connectListeners.filter(f => f !== fn);
    };
  }

  /**
   * Subscribe to queue SSE events.
   * @param {Object} callbacks - Map of event name to handler function.
   *   Supported keys: 'queue:updated', 'queue:task-started'
   * @returns {Function} unsubscribe function
   */
  subscribe(callbacks) {
    const id = this._nextId++;
    this._subscribers.set(id, { callbacks });
    console.log(`[QueueSSE] Subscribed ID ${id}. Active subscribers count: ${this._subscribers.size}`);
    if (this._subscribers.size === 1) this._connect();
    return () => this.unsubscribe(id);
  }

  unsubscribe(id) {
    const existed = this._subscribers.delete(id);
    console.log(`[QueueSSE] Unsubscribing ID ${id}. Existed: ${existed}. Remaining subscribers: ${this._subscribers.size}`);
    if (this._subscribers.size === 0) {
      console.log('[QueueSSE] No subscribers left. Disconnecting...');
      this._disconnect();
    }
  }
}

export const queueSSEManager = new QueueSSEManager();
