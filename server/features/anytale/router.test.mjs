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
  setPlayIntroImageUrl: vi.fn(),
  getAllSfx: vi.fn(() => []),
  createSfx: vi.fn(),
  saveSfx: vi.fn(),
  removeSfxByUid: vi.fn(),
  setSfxAudioUrl: vi.fn(),
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
const { getAllOutfits, getAllCharacters, getAllParts, getAllGenres, createGenre, saveGenre, removeGenreByUid, getAllSfx, createSfx, saveSfx, removeSfxByUid } = await import('./service.mjs')
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
    sfxWorkflow: 'SFX Generation',
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
      expect(callArgs.taskData.keyscale).toBe('C major')
      expect(callArgs.taskData.timesignature).toBe('4')
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
      expect(callArgs.taskData.keyscale).toBe('A minor')
    })
  })

  // ── SFX CRUD ──────────────────────────────────────────────────────────────

  describe('GET /anytale/sfx', () => {
    test('returns all SFX records', async () => {
      getAllSfx.mockReturnValue([{ uid: 'sfx-1', name: 'Rain', tags: ['rain'], prompt: 'rain sounds', audioUrl: '' }])

      const res = await request(app).get('/anytale/sfx')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([{ uid: 'sfx-1', name: 'Rain', tags: ['rain'], prompt: 'rain sounds', audioUrl: '' }])
    })
  })

  describe('POST /anytale/sfx', () => {
    test('returns 201 and created SFX record', async () => {
      const record = { uid: 'sfx-new', name: 'Thunder', tags: ['thunder'], prompt: 'thunder crash', audioUrl: '' }
      createSfx.mockReturnValue(record)

      const res = await request(app)
        .post('/anytale/sfx')
        .send({ name: 'Thunder', tags: ['thunder'], prompt: 'thunder crash' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('uid')
    })

    test('returns 400 for non-object body', async () => {
      const res = await request(app)
        .post('/anytale/sfx')
        .send('not-an-object')
        .set('Content-Type', 'text/plain')

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /anytale/sfx/:uid', () => {
    test('returns 200 and updated SFX record', async () => {
      const record = { uid: 'sfx-1', name: 'Updated Rain', tags: ['rain'], prompt: 'heavy rain', audioUrl: '' }
      saveSfx.mockReturnValue(record)

      const res = await request(app)
        .put('/anytale/sfx/sfx-1')
        .send({ name: 'Updated Rain', tags: ['rain'], prompt: 'heavy rain' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('uid', 'sfx-1')
    })
  })

  describe('DELETE /anytale/sfx/:uid', () => {
    test('returns 200 with deleted: true', async () => {
      const res = await request(app).delete('/anytale/sfx/sfx-1')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ deleted: true })
    })

    test('returns 404 when SFX record not found', async () => {
      const err = new Error('SFX record not found: missing')
      err.code = 'ENOENT'
      removeSfxByUid.mockImplementation(() => { throw err })

      const res = await request(app).delete('/anytale/sfx/missing')

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })
  })

  // ── SFX generate-preview ──────────────────────────────────────────────────

  describe('POST /anytale/sfx/:uid/generate-preview', () => {
    test('returns 202 and enqueues SFX preview generation', async () => {
      getAllSfx.mockReturnValue([{ uid: 'sfx-1', name: 'Rain', tags: ['rain'], prompt: 'rain sounds', audioUrl: '' }])
      loadWorkflows.mockReturnValue({ workflows: [{ name: 'SFX Generation', options: {} }] })

      const res = await request(app)
        .post('/anytale/sfx/sfx-1/generate-preview')
        .send({ clientId: 'test-client' })

      expect(res.status).toBe(202)
      expect(res.body).toHaveProperty('taskId')
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ endpointKey: 'anytale-sfx-preview', type: 'audio' }),
        expect.any(Object)
      )
    })

    test('sends correct prompt and audioFormat in taskData', async () => {
      getAllSfx.mockReturnValue([{ uid: 'sfx-1', name: 'Rain', tags: ['rain'], prompt: 'rain sounds', audioUrl: '' }])
      loadWorkflows.mockReturnValue({ workflows: [{ name: 'SFX Generation', options: {} }] })

      await request(app).post('/anytale/sfx/sfx-1/generate-preview').send({})

      const callArgs = enqueue.mock.calls[0][0]
      expect(callArgs.taskData.prompt).toBe('rain sounds')
      expect(callArgs.taskData.audioFormat).toBe('mp3')
      expect(callArgs.taskData.sfxUid).toBe('sfx-1')
    })

    test('returns 404 when SFX record not found', async () => {
      getAllSfx.mockReturnValue([])
      loadWorkflows.mockReturnValue({ workflows: [{ name: 'SFX Generation', options: {} }] })

      const res = await request(app).post('/anytale/sfx/missing/generate-preview').send({})

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when sfxWorkflow is not found in workflows', async () => {
      getAllSfx.mockReturnValue([{ uid: 'sfx-1', name: 'Rain', tags: ['rain'], prompt: 'rain', audioUrl: '' }])
      loadWorkflows.mockReturnValue({ workflows: [] })

      const res = await request(app).post('/anytale/sfx/sfx-1/generate-preview').send({})

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })

  // ── Play mode generate-sfx ────────────────────────────────────────────────

  describe('POST /anytale/play/generate-sfx', () => {
    test('returns 202 and enqueues play SFX generation', async () => {
      loadWorkflows.mockReturnValue({ workflows: [{ name: 'SFX Generation', options: {} }] })

      const res = await request(app)
        .post('/anytale/play/generate-sfx')
        .send({ prompt: 'storm sounds', clientId: 'tab-1' })

      expect(res.status).toBe(202)
      expect(res.body).toHaveProperty('taskId')
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ endpointKey: 'anytale-play-sfx', type: 'audio', source: 'anytale-play' }),
        expect.any(Object)
      )
    })

    test('sends correct prompt and audioFormat in taskData', async () => {
      loadWorkflows.mockReturnValue({ workflows: [{ name: 'SFX Generation', options: {} }] })

      await request(app)
        .post('/anytale/play/generate-sfx')
        .send({ prompt: 'wind howl' })

      const callArgs = enqueue.mock.calls[0][0]
      expect(callArgs.taskData.prompt).toBe('wind howl')
      expect(callArgs.taskData.audioFormat).toBe('mp3')
      expect(callArgs.taskData.entityType).toBe('anytale-play-sfx')
    })

    test('returns 400 when sfxWorkflow is not found in workflows', async () => {
      loadWorkflows.mockReturnValue({ workflows: [] })

      const res = await request(app)
        .post('/anytale/play/generate-sfx')
        .send({ prompt: 'wind' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })
})
