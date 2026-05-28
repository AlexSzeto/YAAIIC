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
    console.log('[useQueueStatus] Hook mounted');

    const fetchStatus = () => {
      console.log('[useQueueStatus] Fetching /queue/status...');
      fetch('/queue/status')
        .then(r => r.json())
        .then(data => {
          if (!cancelled) {
            console.log(`[useQueueStatus] Fetch complete. state=${data.state}, itemsCount=${data.items?.length}`);
            setStatus(data);
          } else {
            console.log('[useQueueStatus] Fetch complete but hook was already cancelled/unmounted');
          }
        })
        .catch(err => {
          console.error('[useQueueStatus] Fetch failed:', err);
        });
    };

    fetchStatus();

    console.log('[useQueueStatus] Registering onConnect listener and queue:updated subscription');
    const unsubscribeConnect = queueSSEManager.onConnect(() => {
      console.log('[useQueueStatus] onConnect listener fired. Re-fetching status...');
      fetchStatus();
    });

    const unsubscribe = queueSSEManager.subscribe({
      'queue:updated': (payload) => {
        if (!cancelled) {
          console.log(`[useQueueStatus] queue:updated received via SSE. state=${payload.state}, itemsCount=${payload.items?.length}`);
          setStatus(payload);
        } else {
          console.log('[useQueueStatus] queue:updated received but hook was already cancelled/unmounted');
        }
      },
    });

    return () => {
      console.log('[useQueueStatus] Hook unmounting. Cleaning up...');
      cancelled = true;
      unsubscribeConnect();
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
    console.log(`[useQueueTaskId] Starting wait for queueId=${queueId}`);
    const unsubscribe = queueSSEManager.subscribe({
      'queue:task-started': ({ id, taskId }) => {
        if (id === queueId) {
          console.log(`[useQueueTaskId] Found matching task starting via SSE: queueId=${queueId} -> taskId=${taskId}`);
          unsubscribe();
          resolve(taskId);
        }
      },
    });
    // Race: item may have already started before this hook subscribed
    fetch('/queue/status')
      .then(r => r.json())
      .then(({ items }) => {
        const item = items.find(i => i.id === queueId && i.taskId);
        if (item) {
          console.log(`[useQueueTaskId] Found matching task starting via fetch: queueId=${queueId} -> taskId=${item.taskId}`);
          unsubscribe();
          resolve(item.taskId);
        }
      })
      .catch((err) => {
        console.error('[useQueueTaskId] Race status fetch failed:', err);
      });
  });
}
