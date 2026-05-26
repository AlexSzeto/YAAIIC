import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('./repository.mjs', () => ({
  loadQueue: vi.fn(() => []),
  saveQueue: vi.fn(),
}));

vi.mock('../../core/sse.mjs', () => ({
  setTaskCancelledCallback: vi.fn(),
  setTaskCompletedCallback: vi.fn(),
  setTaskErrorCallback: vi.fn(),
  cancelTask: vi.fn(),
}));

vi.mock('../generation/comfy-client.mjs', () => ({
  interruptGeneration: vi.fn().mockResolvedValue(undefined),
}));

import { initialize, setEmitQueueEvent, enqueue, clearBySource, deleteItem, clear, getStatus } from './service.mjs';
import { setTaskCancelledCallback, setTaskCompletedCallback } from '../../core/sse.mjs';

function flushAsync() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('queue service — _handleTaskCompleted', () => {
  let completedCallback;
  let cancelledCallback;
  let emittedEvents;
  let mockExecuteQueuedTask;

  beforeEach(() => {
    emittedEvents = [];
    mockExecuteQueuedTask = vi.fn().mockResolvedValue({ taskId: 'task-abc' });

    vi.mocked(setTaskCancelledCallback).mockImplementation(fn => {
      cancelledCallback = fn;
    });

    vi.mocked(setTaskCompletedCallback).mockImplementation(fn => {
      completedCallback = fn;
    });

    initialize({
      config: {},
      uploadFileToComfyUI: vi.fn(),
      executeQueuedTask: mockExecuteQueuedTask,
    });

    setEmitQueueEvent((event, payload) => {
      emittedEvents.push({ event, payload: JSON.parse(JSON.stringify(payload)) });
    });
  });

  test('emits queue:updated with remaining items between task completion and next task starting', async () => {
    const item1 = enqueue({ endpointKey: 'test', type: 'image', name: 'img1' }, { autoStart: true });
    const item2 = enqueue({ endpointKey: 'test', type: 'image', name: 'img2' });

    // Wait for _runNext to complete and runningTaskId to be set
    await flushAsync();

    // Clear captured events — only track from task completion onward
    emittedEvents.length = 0;

    completedCallback('task-abc');

    await flushAsync();

    const updatedEvents = emittedEvents.filter(e => e.event === 'queue:updated');

    // At least one queue:updated before the next task runs (the one we added)
    expect(updatedEvents.length).toBeGreaterThanOrEqual(1);

    // The first queue:updated must not contain item1 (it was completed)
    const first = updatedEvents[0];
    expect(first.payload.items.find(i => i.id === item1.id)).toBeUndefined();

    // The first queue:updated must still contain item2
    expect(first.payload.items.find(i => i.id === item2.id)).toBeDefined();
  });

  test('clearBySource removes queued items from the given source only', async () => {
    enqueue({ source: 'anytale-play', endpointKey: 'play', type: 'image', name: 'p1' });
    enqueue({ source: 'anytale-play', endpointKey: 'play', type: 'image', name: 'p2' });
    const other = enqueue({ source: 'other', endpointKey: 'other', type: 'image', name: 'o1' });

    clearBySource('anytale-play');

    const { items } = getStatus();
    expect(items.every(i => i.source !== 'anytale-play')).toBe(true);
    expect(items.find(i => i.id === other.id)).toBeDefined();
  });

  test('clearBySource is a no-op when no items match the source', () => {
    enqueue({ source: 'other', endpointKey: 'other', type: 'image', name: 'o1' });
    expect(() => clearBySource('anytale-play')).not.toThrow();
    expect(getStatus().items).toHaveLength(1);
  });

  test('second clear() while already cancelling force-abandons the running item immediately', async () => {
    enqueue({ endpointKey: 'test', type: 'image', name: 'img1' }, { autoStart: true });
    await flushAsync();

    clear(); // first cancel → state becomes 'cancelling'
    expect(getStatus().state).toBe('cancelling');
    expect(getStatus().items).toHaveLength(1); // running item still present

    clear(); // second cancel → force-abandon
    const { state, items } = getStatus();
    expect(state).toBe('stopped');
    expect(items).toHaveLength(0);
  });

  test('second clear() force-abandon: late callback from ComfyUI is ignored', async () => {
    enqueue({ endpointKey: 'test', type: 'image', name: 'img1' }, { autoStart: true });
    await flushAsync();

    clear();
    clear(); // force-abandon
    expect(getStatus().state).toBe('stopped');

    // ComfyUI eventually sends its cancellation — must not corrupt state
    cancelledCallback?.('task-abc');
    expect(getStatus().state).toBe('stopped');
    expect(getStatus().items).toHaveLength(0);
  });

  test('deleteItem() on running item while already in transition state force-abandons immediately', async () => {
    enqueue({ endpointKey: 'test', type: 'image', name: 'img1' }, { autoStart: true });
    await flushAsync();

    const runningId = getStatus().items[0].id;

    deleteItem(runningId); // first delete → state becomes 'pausing', item still in queue
    expect(getStatus().state).toBe('pausing');
    expect(getStatus().items.find(i => i.id === runningId)).toBeDefined();

    deleteItem(runningId); // second delete → force-abandon
    const { state, items } = getStatus();
    expect(state).toBe('stopped');
    expect(items.find(i => i.id === runningId)).toBeUndefined();
  });

  test('deleteItem() force-abandon: late callback is ignored', async () => {
    enqueue({ endpointKey: 'test', type: 'image', name: 'img1' }, { autoStart: true });
    await flushAsync();

    const runningId = getStatus().items[0].id;
    deleteItem(runningId);
    deleteItem(runningId); // force-abandon

    cancelledCallback?.('task-abc'); // late signal from ComfyUI
    expect(getStatus().state).toBe('stopped');
    expect(getStatus().items).toHaveLength(0);
  });

  test('queue:updated intermediate state comes before queue:task-started for the next task', async () => {
    enqueue({ endpointKey: 'test', type: 'image', name: 'img1' }, { autoStart: true });
    enqueue({ endpointKey: 'test', type: 'image', name: 'img2' });

    await flushAsync();
    emittedEvents.length = 0;

    completedCallback('task-abc');
    await flushAsync();

    const updatedIdx = emittedEvents.findIndex(e => e.event === 'queue:updated');
    const taskStartedIdx = emittedEvents.findIndex(e => e.event === 'queue:task-started');

    expect(updatedIdx).toBeGreaterThanOrEqual(0);
    if (taskStartedIdx !== -1) {
      expect(updatedIdx).toBeLessThan(taskStartedIdx);
    }
  });
});
