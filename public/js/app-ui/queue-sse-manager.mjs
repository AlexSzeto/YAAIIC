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
  }

  _connect() {
    if (this._eventSource) return;

    this._eventSource = new EventSource('/queue/sse');

    this._eventSource.addEventListener('queue:updated', (e) => {
      this._broadcast('queue:updated', JSON.parse(e.data));
    });

    this._eventSource.addEventListener('queue:task-started', (e) => {
      this._broadcast('queue:task-started', JSON.parse(e.data));
    });

    this._eventSource.onopen = () => {
      this._connected = true;
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
    };

    this._eventSource.onerror = () => {
      this._connected = false;
      this._eventSource.close();
      this._eventSource = null;
      if (this._subscribers.size > 0 && !this._reconnectTimer) {
        this._reconnectTimer = setTimeout(() => {
          this._reconnectTimer = null;
          this._connect();
        }, 5000);
      }
    };
  }

  _disconnect() {
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
    for (const { callbacks } of this._subscribers.values()) {
      const fn = callbacks[event];
      if (typeof fn === 'function') fn(payload);
    }
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
    if (this._subscribers.size === 1) this._connect();
    return () => this.unsubscribe(id);
  }

  unsubscribe(id) {
    this._subscribers.delete(id);
    if (this._subscribers.size === 0) this._disconnect();
  }
}

export const queueSSEManager = new QueueSSEManager();
