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

import { initialize, setEmitQueueEvent, enqueue, clearBySource, getStatus } from './service.mjs';
import { setTaskCompletedCallback } from '../../core/sse.mjs';

function flushAsync() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('queue service — _handleTaskCompleted', () => {
  let completedCallback;
  let emittedEvents;
  let mockExecuteQueuedTask;

  beforeEach(() => {
    emittedEvents = [];
    mockExecuteQueuedTask = vi.fn().mockResolvedValue({ taskId: 'task-abc' });

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
