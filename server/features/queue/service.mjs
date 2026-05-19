import { randomUUID } from 'crypto';
import { loadQueue, saveQueue } from './repository.mjs';
import {
  setTaskCancelledCallback,
  setTaskCompletedCallback,
  setTaskErrorCallback,
  cancelTask,
} from '../../core/sse.mjs';
import { interruptGeneration } from '../generation/comfy-client.mjs';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Flat array of queue task records. */
let items = [];

/**
 * Queue state machine.
 * stopped | paused | running | cancelling | skipping | pausing
 */
let state = 'stopped';

/** taskId of the currently running SSE task (assigned by orchestrator). */
let runningTaskId = null;

/** Set when a delete-of-running-item triggered the cancel; id of the item. */
let deletingRunningItemId = null;

/** Injected at server startup. */
let _config = null;
let _uploadFileToComfyUI = null;
let _executeQueuedTask = null;

/** emitQueueEvent is set by router.mjs after it creates the SSE infrastructure. */
let _emitQueueEvent = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initialize({ config, uploadFileToComfyUI, executeQueuedTask }) {
  _config = config;
  _uploadFileToComfyUI = uploadFileToComfyUI;
  _executeQueuedTask = executeQueuedTask;

  // Load persisted queue
  items = loadQueue();

  // Treat any item that was 'running' at server shutdown as 'queued'
  // so it will be re-executed on resume(). Remove any 'failed' items left
  // over from before auto-removal was introduced.
  const before = items.length;
  items = items.filter(i => i.status !== 'failed');
  for (const item of items) {
    if (item.status === 'running') item.status = 'queued';
  }
  if (items.length !== before || items.some(i => i.status === 'queued')) saveQueue(items);

  // Wire into SSE lifecycle
  setTaskCancelledCallback(_handleTaskCancelled);
  setTaskCompletedCallback(_handleTaskCompleted);
  setTaskErrorCallback(_handleTaskError);

  console.log(`[queue] Initialized with ${items.length} persisted item(s)`);
}

export function setEmitQueueEvent(fn) {
  _emitQueueEvent = fn;
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function emit(event, payload) {
  if (_emitQueueEvent) _emitQueueEvent(event, payload);
}

function emitUpdated() {
  emit('queue:updated', getStatus());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getStatus() {
  return { state, items };
}

export function enqueue(record, { autoStart = false } = {}) {
  const item = {
    id: randomUUID(),
    status: 'queued',
    createdAt: new Date().toISOString(),
    ...record,
  };
  items.push(item);
  saveQueue(items);
  emitUpdated();
  console.log(`[queue] Enqueued ${item.id} (${item.endpointKey})`);
  if (autoStart && state === 'stopped') {
    _runNext();
  }
  return item;
}

export function deleteItem(id) {
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return false;

  const item = items[idx];

  if (item.status === 'running') {
    // Determine if there are more items after this one
    const hasNext = items.some((i, j) => j > idx && i.status === 'queued');
    deletingRunningItemId = id;
    state = hasNext ? 'skipping' : 'pausing';
    _cancelRunningTask();
    emitUpdated();
    return true;
  }

  items.splice(idx, 1);
  saveQueue(items);
  emitUpdated();
  return true;
}

export function reorder({ id, toIndex }) {
  const fromIndex = items.findIndex(i => i.id === id);
  if (fromIndex === -1) return false;
  if (toIndex < 0 || toIndex >= items.length) return false;

  const [item] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, item);
  saveQueue(items);
  emitUpdated();
  return true;
}

export function clear() {
  if (state === 'running' || state === 'cancelling' || state === 'skipping' || state === 'pausing') {
    state = 'cancelling';
    _cancelRunningTask();
    // Items cleared in _handleTaskCancelled when state === 'cancelling'
  } else {
    items = [];
    saveQueue(items);
    state = 'stopped';
    emit('queue:stopped', { state, reason: 'user-paused' });
    emitUpdated();
  }
}

export function start() {
  if (state === 'running' || state === 'cancelling' || state === 'skipping' || state === 'pausing') {
    return false; // 409
  }
  _runNext();
  return true;
}

export function pause() {
  if (state !== 'running') return false; // 409
  state = 'pausing';
  _cancelRunningTask();
  emitUpdated();
  return true;
}

export function skip() {
  if (state !== 'running') return false; // 409
  state = 'skipping';
  _cancelRunningTask();
  emitUpdated();
  return true;
}

export function resume() {
  const hasQueued = items.some(i => i.status === 'queued');
  if (!hasQueued) {
    state = 'stopped';
    console.log('[queue] Resume: no queued items, staying stopped');
    return;
  }
  console.log('[queue] Resuming...');
  _runNext();
}

// ---------------------------------------------------------------------------
// Internal: cancel the running task
// ---------------------------------------------------------------------------

function _cancelRunningTask() {
  if (!runningTaskId) return;
  cancelTask(runningTaskId);
  interruptGeneration().catch(err => console.error('[queue] Failed to interrupt ComfyUI:', err));
}

// ---------------------------------------------------------------------------
// Internal: run the next queued item
// ---------------------------------------------------------------------------

async function _runNext() {
  const next = items.find(i => i.status === 'queued');
  if (!next) {
    state = 'stopped';
    runningTaskId = null;
    saveQueue(items);
    emit('queue:stopped', { state: 'stopped', reason: 'user-paused' });
    emitUpdated();
    return;
  }

  next.status = 'running';
  state = 'running';
  saveQueue(items);
  emit('queue:started', { state: 'running' });
  emitUpdated();

  try {
    const { taskId } = await _executeQueuedTask(next, {
      config: _config,
      uploadFileToComfyUI: _uploadFileToComfyUI,
    });
    runningTaskId = taskId;
    next.taskId = taskId;
    emit('queue:task-started', {
      id: next.id,
      taskId,
      type: next.type,
      source: next.source,
      name: next.name,
      subLabel: next.subLabel || null,
      endpointKey: next.endpointKey,
      taskData: next.taskData,
    });
    emitUpdated();
    console.log(`[queue] Started item ${next.id} → taskId ${taskId}`);
  } catch (err) {
    console.error(`[queue] Failed to start item ${next.id} — removing and continuing:`, err);
    items = items.filter(i => i.id !== next.id);
    runningTaskId = null;
    saveQueue(items);
    _runNext();
  }
}

// ---------------------------------------------------------------------------
// Internal: task lifecycle handlers (called by sse.mjs callbacks)
// ---------------------------------------------------------------------------

function _handleTaskCancelled(taskId) {
  if (taskId !== runningTaskId) return;

  const runningItem = items.find(i => i.status === 'running');

  if (state === 'pausing') {
    if (deletingRunningItemId && runningItem?.id === deletingRunningItemId) {
      // Delete-triggered pause: remove the item entirely
      items = items.filter(i => i.id !== deletingRunningItemId);
      deletingRunningItemId = null;
    } else if (runningItem) {
      runningItem.status = 'queued';
    }
    state = 'paused';
    runningTaskId = null;
    saveQueue(items);
    emit('queue:task-cancelled', { id: runningItem?.id });
    emit('queue:stopped', { state: 'paused', reason: 'user-paused' });
    emitUpdated();

  } else if (state === 'skipping') {
    if (runningItem) items = items.filter(i => i.id !== runningItem.id);
    const wasDeleting = deletingRunningItemId;
    deletingRunningItemId = null;
    runningTaskId = null;
    emit('queue:task-cancelled', { id: runningItem?.id });
    saveQueue(items);
    if (!wasDeleting) {
      _runNext();
    } else {
      _runNext();
    }

  } else if (state === 'cancelling') {
    emit('queue:task-cancelled', { id: runningItem?.id });
    items = [];
    state = 'stopped';
    runningTaskId = null;
    saveQueue(items);
    emit('queue:stopped', { state: 'stopped', reason: 'user-paused' });
    emitUpdated();
  }
}

function _handleTaskCompleted(taskId, result) {
  if (taskId !== runningTaskId) return;

  const runningItem = items.find(i => i.status === 'running');
  if (runningItem) items = items.filter(i => i.id !== runningItem.id);
  runningTaskId = null;
  saveQueue(items);
  emit('queue:task-complete', { id: runningItem?.id });
  _runNext();
}

function _handleTaskError(taskId, errorMessage) {
  if (taskId !== runningTaskId) return;

  const runningItem = items.find(i => i.status === 'running');
  if (runningItem) {
    console.warn(`[queue] Task ${taskId} failed — removing item ${runningItem.id} and continuing`);
    items = items.filter(i => i.id !== runningItem.id);
  }
  runningTaskId = null;
  saveQueue(items);
  emit('queue:task-complete', { id: runningItem?.id });
  _runNext();
}
