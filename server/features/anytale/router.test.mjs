import { vi, describe, test, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, readFileSync: vi.fn(() => ''), existsSync: vi.fn(() => false) }
})

vi.mock('./service.mjs', () => ({
  getAllParts: vi.fn(() => []),
  createPart: vi.fn(),
  savePart: vi.fn(),
  removePartByUid: vi.fn(),
  getAllPlots: vi.fn(() => []),
  getPlotByUid: vi.fn(),
  savePlot: vi.fn(),
  removePlotByUid: vi.fn(),
  getAllCharacters: vi.fn(() => []),
  createCharacter: vi.fn(),
  saveCharacter: vi.fn(),
  removeCharacterByUid: vi.fn(),
  updateCharacterField: vi.fn(),
  getAllOutfits: vi.fn(() => []),
  createOutfit: vi.fn(),
  saveOutfit: vi.fn(),
  removeOutfitByUid: vi.fn(),
  updateOutfitField: vi.fn(),
}))

vi.mock('../generation/workflow-validator.mjs', () => ({
  loadWorkflows: vi.fn(() => ({
    workflows: [{ name: 'Text to Image (Illustrious Portrait)', options: {} }],
  })),
}))

vi.mock('../queue/service.mjs', () => ({
  enqueue: vi.fn(() => ({ id: 'queue-item-1' })),
}))

vi.mock('./portrait-hash.mjs', () => ({
  portraitPromptHash: vi.fn(() => 'abc123'),
}))

// ── App setup ───────────────────────────────────────────────────────────────

const { default: router } = await import('./router.mjs')
const { enqueue } = await import('../queue/service.mjs')
const { getAllOutfits, getAllCharacters, getAllParts } = await import('./service.mjs')
const { loadWorkflows } = await import('../generation/workflow-validator.mjs')

const app = express()
app.use(express.json())
app.locals.config = {
  anytale: {
    portraitWorkflow: 'Text to Image (Illustrious Portrait)',
    portraitBasePrompt: '1girl, solo',
    portraitParts: ['head'],
    partPreviewWorkflow: 'Text to Image (Illustrious Part Preview)',
  },
}
app.use(router)

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AnyTale Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enqueue.mockReturnValue({ id: 'queue-item-1' })
    loadWorkflows.mockReturnValue({
      workflows: [{ name: 'Text to Image (Illustrious Portrait)', options: {} }],
    })
  })

  // ── render-portrait ───────────────────────────────────────────────────────

  describe('POST /anytale/characters/:uid/render-portrait', () => {
    test('returns 202 and enqueues portrait generation', async () => {
      getAllCharacters.mockReturnValue([{ uid: 'char-1', name: 'Alice', parts: [] }])
      getAllParts.mockReturnValue([])

      const res = await request(app)
        .post('/anytale/characters/char-1/render-portrait')
        .send({ parts: [] })

      expect(res.status).toBe(202)
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ endpointKey: 'anytale-render-portrait', subLabel: 'Portrait' }),
        expect.any(Object)
      )
    })

    test('returns 400 when portrait workflow is not found', async () => {
      loadWorkflows.mockReturnValue({ workflows: [] })

      const res = await request(app)
        .post('/anytale/characters/char-1/render-portrait')
        .send({ parts: [] })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })

  // ── render-outfit ─────────────────────────────────────────────────────────

  describe('POST /anytale/outfits/:uid/render-outfit', () => {
    test('returns 404 when outfit is not found', async () => {
      getAllOutfits.mockReturnValue([])

      const res = await request(app)
        .post('/anytale/outfits/missing-uid/render-outfit')

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 202 and enqueues outfit render', async () => {
      getAllOutfits.mockReturnValue([{ uid: 'outfit-1', name: 'Casual', parts: [] }])
      getAllParts.mockReturnValue([])

      const res = await request(app)
        .post('/anytale/outfits/outfit-1/render-outfit')

      expect(res.status).toBe(202)
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ endpointKey: 'anytale-render-outfit', subLabel: 'Outfit Render' }),
        expect.any(Object)
      )
    })

    test('assembles prompt from outfit parts and library baselines', async () => {
      getAllOutfits.mockReturnValue([{
        uid: 'outfit-1',
        name: 'Casual',
        parts: [{ partUid: 'part-a', attributeValues: { color: 'blue' } }],
      }])
      getAllParts.mockReturnValue([{ uid: 'part-a', name: 'shirt', baseline: 'shirt, upper body' }])

      await request(app).post('/anytale/outfits/outfit-1/render-outfit')

      const callArgs = enqueue.mock.calls[0][0]
      expect(callArgs.taskData.prompt).toContain('shirt, upper body')
      expect(callArgs.taskData.prompt).toContain('blue')
      expect(callArgs.taskData.prompt).toContain('1girl, solo')
    })

    test('returns 400 when portrait workflow is not found', async () => {
      getAllOutfits.mockReturnValue([{ uid: 'outfit-1', name: 'Casual', parts: [] }])
      loadWorkflows.mockReturnValue({ workflows: [] })

      const res = await request(app)
        .post('/anytale/outfits/outfit-1/render-outfit')

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })
})
