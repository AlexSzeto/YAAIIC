import { vi, describe, test, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ── Mocks (hoisted before imports) ─────────────────────────────────────────

vi.mock('./workflow-validator.mjs', () => ({
  loadWorkflows: vi.fn(() => ({
    workflows: [
      { name: 'test-workflow', options: {}, postGenerationTasks: [] },
    ],
  })),
  validateNoNestedExecuteWorkflow: vi.fn(() => ({ valid: true, error: null })),
}))

vi.mock('../queue/service.mjs', () => ({
  enqueue: vi.fn(() => ({ id: 'queue-item-1' })),
  initialize: vi.fn(),
}))

vi.mock('../../core/sse.mjs', () => ({
  createTask: vi.fn(() => 'sse-task-id'),
  deleteTask: vi.fn(),
  getTask: vi.fn((id) => (id ? { id, status: 'active' } : null)),
  getActiveTasks: vi.fn(() => []),
  updateTask: vi.fn(),
  resetProgressLog: vi.fn(),
  emitProgressUpdate: vi.fn(),
  emitTaskError: vi.fn(),
  cancelTask: vi.fn(),
  emitTaskCancelled: vi.fn(),
  logProgressEvent: vi.fn(),
  emitTaskCompletion: vi.fn(),
  handleSSEConnection: vi.fn(),
  emitTaskErrorByTaskId: vi.fn(),
}))

vi.mock('../../core/database.mjs', () => ({
  findMediaByUid: vi.fn(),
  findMediaIndexByUid: vi.fn(() => -1),
  getAllMediaData: vi.fn(() => []),
  saveMediaData: vi.fn(),
  loadMediaData: vi.fn(),
  addMediaDataEntry: vi.fn(),
}))

vi.mock('./orchestrator.mjs', () => ({
  initializeGenerationTask: vi.fn(() => ({ taskId: 'gen-task-id' })),
  processGenerationTask: vi.fn(() => Promise.resolve({ success: true, outputs: [] })),
  handleMediaGeneration: vi.fn(),
  initializeOrchestrator: vi.fn(),
  setAddMediaDataEntry: vi.fn(),
  executeQueuedTask: vi.fn(),
  modifyGenerationDataWithPrompt: vi.fn(),
  checkPromptStatus: vi.fn(),
}))

vi.mock('./comfy-client.mjs', () => ({
  interruptGeneration: vi.fn(() => Promise.resolve()),
  initialize: vi.fn(),
  getApiPath: vi.fn(() => 'http://localhost:17861'),
  uploadFile: vi.fn(() => Promise.resolve({ success: true, filename: 'test.png' })),
  CLIENT_ID: 'test-client-id',
  promptExecutionState: {},
  connectToComfyUI: vi.fn(),
  IMPORTANT_NODE_TYPES: [],
}))

vi.mock('../../core/llm.mjs', () => ({
  modifyDataWithPrompt: vi.fn(),
  resetPromptLog: vi.fn(),
}))

vi.mock('../../comfyui-websocket.mjs', () => ({
  CLIENT_ID: 'test-client-id',
  promptExecutionState: {},
  connectToComfyUI: vi.fn(),
  setEmitFunctions: vi.fn(),
  initComfyUIWebSocket: vi.fn(),
}))

// ── App setup ───────────────────────────────────────────────────────────────

const { default: router } = await import('./router.mjs')
const { enqueue } = await import('../queue/service.mjs')

const app = express()
app.use(express.json())
app.locals.config = {
  comfyuiAPIPath: 'http://localhost:17861',
  serverPort: 3000,
}
app.locals.uploadFileToComfyUI = vi.fn(() =>
  Promise.resolve({ success: true, filename: 'uploaded.png' }),
)
app.use(router)

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Generation Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enqueue.mockReturnValue({ id: 'queue-item-1' })
  })

  describe('POST /generate', () => {
    test('returns 400 when workflow parameter is missing', async () => {
      const res = await request(app)
        .post('/generate')
        .send({})
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when workflow name is not found', async () => {
      const { loadWorkflows } = await import('./workflow-validator.mjs')
      loadWorkflows.mockReturnValueOnce({ workflows: [] })

      const res = await request(app)
        .post('/generate')
        .send({ workflow: 'nonexistent-workflow' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found/)
    })

    test('enqueues the task and returns 200 for a valid workflow', async () => {
      const res = await request(app)
        .post('/generate')
        .send({ workflow: 'test-workflow', name: 'test-gen', prompt: 'test prompt' })
      expect(res.status).toBe(200)
      expect(enqueue).toHaveBeenCalledOnce()
    })

    test('enqueue receives the workflow name from the request', async () => {
      await request(app)
        .post('/generate')
        .send({ workflow: 'test-workflow', name: 'gen-name' })
      const [queuePayload] = enqueue.mock.calls[0]
      expect(queuePayload.endpointKey).toBe('generate')
      expect(queuePayload.taskData).toHaveProperty('workflow', 'test-workflow')
    })
  })

  describe('GET /generation/tasks/active', () => {
    test('returns an array', async () => {
      const res = await request(app).get('/generation/tasks/active')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /generate/cancel', () => {
    test('returns 400 when taskId is missing', async () => {
      const res = await request(app)
        .post('/generate/cancel')
        .send({})
      expect(res.status).toBe(400)
    })

    test('returns 404 when task does not exist', async () => {
      const { getTask } = await import('../../core/sse.mjs')
      getTask.mockReturnValueOnce(null)

      const res = await request(app)
        .post('/generate/cancel')
        .send({ taskId: 'no-such-task' })
      expect(res.status).toBe(404)
    })

    test('returns 202 when task is found and cancellation is requested', async () => {
      const { getTask } = await import('../../core/sse.mjs')
      getTask.mockReturnValueOnce({ id: 'active-task', status: 'running' })

      const res = await request(app)
        .post('/generate/cancel')
        .send({ taskId: 'active-task' })
      expect(res.status).toBe(202)
      expect(res.body.success).toBe(true)
    })
  })
})
