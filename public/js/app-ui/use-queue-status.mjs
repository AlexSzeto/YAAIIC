import { useState, useEffect } from 'preact/hooks';
import { queueSSEManager } from './queue-sse-manager.mjs';

/**
 * Returns the live queue status: { state, items }.
 * Hydrates from GET /queue/status on mount, then stays in sync via SSE.
 */
export function useQueueStatus() {
  const [status, setStatus] = useState({ state: 'stopped', items: [] });

  useEffect(() => {
    let cancelled = false;

    fetch('/queue/status')
      .then(r => r.json())
      .then(data => { if (!cancelled) setStatus(data); })
      .catch(() => {});

    const unsubscribe = queueSSEManager.subscribe({
      'queue:updated': (payload) => { if (!cancelled) setStatus(payload); },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}

/**
 * Returns a callback that resolves queueId → taskId by listening to
 * queue:task-started events. Call it right after a generate request returns
 * { queueId } to get the taskId for SSE progress tracking.
 *
 * Usage:
 *   const waitForTaskId = useQueueTaskId();
 *   const { queueId } = await fetch('/generate', ...).then(r => r.json());
 *   const taskId = await waitForTaskId(queueId);
 *   sseManager.subscribe(taskId, { onComplete, onProgress, onError });
 */
export function useQueueTaskId() {
  return (queueId) => new Promise((resolve) => {
    const unsubscribe = queueSSEManager.subscribe({
      'queue:task-started': ({ id, taskId }) => {
        if (id === queueId) {
          unsubscribe();
          resolve(taskId);
        }
      },
    });
  });
}
