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
  getAllGenres: vi.fn(() => []),
  createGenre: vi.fn(),
  saveGenre: vi.fn(),
  removeGenreByUid: vi.fn(),
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
const { getAllOutfits, getAllCharacters, getAllParts, getAllGenres, createGenre, saveGenre, removeGenreByUid } = await import('./service.mjs')
const { loadWorkflows } = await import('../generation/workflow-validator.mjs')

const app = express()
app.use(express.json())
app.locals.config = {
  anytale: {
    portraitWorkflow: 'Text to Image (Illustrious Portrait)',
    portraitBasePrompt: '1girl, solo',
    outfitBasePrompt: '1girl, solo',
    portraitParts: ['head'],
    partPreviewWorkflow: 'Text to Image (Illustrious Part Preview)',
    musicWorkflow: 'AceStep Music Generation',
    defaultMusicLength: 120,
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

  // ── Genre CRUD ────────────────────────────────────────────────────────────

  describe('GET /anytale/genres', () => {
    test('returns all genres', async () => {
      getAllGenres.mockReturnValue([{ uid: 'g-1', name: 'Ambient', tracks: [] }])

      const res = await request(app).get('/anytale/genres')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([{ uid: 'g-1', name: 'Ambient', tracks: [] }])
    })
  })

  describe('POST /anytale/genres', () => {
    test('returns 201 and created genre', async () => {
      const genre = { uid: 'g-new', name: 'Jazz', tracks: [] }
      createGenre.mockReturnValue(genre)

      const res = await request(app)
        .post('/anytale/genres')
        .send({ name: 'Jazz' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('saved')
    })

    test('returns 400 for non-object body', async () => {
      const res = await request(app)
        .post('/anytale/genres')
        .send('not-an-object')
        .set('Content-Type', 'text/plain')

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /anytale/genres/:uid', () => {
    test('returns 200 and updated genre', async () => {
      const genre = { uid: 'g-1', name: 'Updated', tracks: [] }
      saveGenre.mockReturnValue(genre)

      const res = await request(app)
        .put('/anytale/genres/g-1')
        .send({ name: 'Updated' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('saved')
    })
  })

  describe('DELETE /anytale/genres/:uid', () => {
    test('returns 200 with deleted uid', async () => {
      const res = await request(app).delete('/anytale/genres/g-1')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ deleted: 'g-1' })
    })

    test('returns 404 when genre not found', async () => {
      const err = new Error('Genre not found: missing')
      err.code = 'ENOENT'
      removeGenreByUid.mockImplementation(() => { throw err })

      const res = await request(app).delete('/anytale/genres/missing')

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })
  })

  // ── Generate track ────────────────────────────────────────────────────────

  describe('POST /anytale/genres/:uid/generate-track', () => {
    test('returns 202 and enqueues track generation', async () => {
      getAllGenres.mockReturnValue([{
        uid: 'g-1',
        name: 'Ambient',
        musicPrompt: 'calm {{variation}} music',
        variations: ['forest', 'ocean'],
        adjectives: ['Serene'],
        nouns: ['Drift'],
        keys: ['C major'],
        bpmMin: 60,
        bpmMax: 80,
        timeSignatures: ['4'],
        tracks: [],
      }])
      loadWorkflows.mockReturnValue({
        workflows: [{ name: 'AceStep Music Generation', options: {} }],
      })

      const res = await request(app)
        .post('/anytale/genres/g-1/generate-track')
        .send({ clientId: 'test-client' })

      expect(res.status).toBe(202)
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ endpointKey: 'anytale-music', type: 'audio' }),
        expect.any(Object)
      )
    })

    test('returns 404 when genre not found', async () => {
      getAllGenres.mockReturnValue([])
      loadWorkflows.mockReturnValue({ workflows: [{ name: 'AceStep Music Generation', options: {} }] })

      const res = await request(app)
        .post('/anytale/genres/missing/generate-track')

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when music workflow is not found', async () => {
      getAllGenres.mockReturnValue([{ uid: 'g-1', name: 'Ambient', tracks: [] }])
      loadWorkflows.mockReturnValue({ workflows: [] })

      const res = await request(app)
        .post('/anytale/genres/g-1/generate-track')

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('assembles prompt with random variation from genre template', async () => {
      getAllGenres.mockReturnValue([{
        uid: 'g-1',
        name: 'Ambient',
        musicPrompt: 'calm {{variation}} music',
        variations: ['forest'],
        adjectives: ['Serene'],
        nouns: ['Drift'],
        keys: ['C major'],
        bpmMin: 70,
        bpmMax: 70,
        timeSignatures: ['4'],
        tracks: [],
      }])
      loadWorkflows.mockReturnValue({
        workflows: [{ name: 'AceStep Music Generation', options: {} }],
      })

      await request(app)
        .post('/anytale/genres/g-1/generate-track')
        .send({})

      const callArgs = enqueue.mock.calls[0][0]
      expect(callArgs.taskData.prompt).toBe('calm forest music')
      expect(callArgs.taskData.name).toBe('Serene Drift')
      expect(callArgs.taskData.bpm).toBe(70)
      expect(callArgs.taskData.key).toBe('C major')
      expect(callArgs.taskData.time_signature).toBe('4')
      expect(callArgs.taskData.lyrics).toBe('')
      expect(callArgs.taskData.length).toBe(120)
    })

    test('uses genreOverrides from request body over DB values', async () => {
      getAllGenres.mockReturnValue([{
        uid: 'g-1',
        name: 'Ambient',
        musicPrompt: 'calm {{variation}} music',
        variations: ['forest'],
        adjectives: ['Serene'],
        nouns: ['Drift'],
        keys: ['C major'],
        bpmMin: 70,
        bpmMax: 70,
        timeSignatures: ['4'],
        tracks: [],
      }])
      loadWorkflows.mockReturnValue({
        workflows: [{ name: 'AceStep Music Generation', options: {} }],
      })

      await request(app)
        .post('/anytale/genres/g-1/generate-track')
        .send({
          genreOverrides: {
            musicPrompt: 'energetic {{variation}} beats',
            variations: ['city'],
            adjectives: ['Urban'],
            nouns: ['Pulse'],
            keys: ['A minor'],
            bpmMin: 140,
            bpmMax: 140,
            timeSignatures: ['4'],
          },
        })

      const callArgs = enqueue.mock.calls[0][0]
      expect(callArgs.taskData.prompt).toBe('energetic city beats')
      expect(callArgs.taskData.name).toBe('Urban Pulse')
      expect(callArgs.taskData.bpm).toBe(140)
      expect(callArgs.taskData.key).toBe('A minor')
    })
  })
})
