import { vi, describe, test, expect } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('./service.mjs', () => ({
  processMediaUpload: vi.fn(() => Promise.resolve('task-upload-123')),
  setUploadAddMediaDataEntry: vi.fn(),
}))

vi.mock('../generation/workflow-validator.mjs', () => ({
  loadWorkflows: vi.fn(() => ({ workflows: [] })),
}))

const { default: router } = await import('./router.mjs')

const app = express()
app.use(express.json())
app.use(router)

// Minimal 1x1 PNG buffer (valid PNG header)
const minimalPng = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
  '2e000000000c4944415478016360f8cfc00000000200016a01eb0000000049454e44ae426082',
  'hex',
)

const minimalMp3 = Buffer.alloc(128, 0)
// ID3 header magic
minimalMp3[0] = 0x49
minimalMp3[1] = 0x44
minimalMp3[2] = 0x33

describe('Upload Router', () => {
  describe('POST /upload/image', () => {
    test('returns taskId when image file is provided', async () => {
      const res = await request(app)
        .post('/upload/image')
        .attach('image', minimalPng, { filename: 'test.png', contentType: 'image/png' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(typeof res.body.taskId).toBe('string')
    })

    test('returns 400 when no image is provided', async () => {
      const res = await request(app).post('/upload/image')
      expect(res.status).toBe(400)
    })
  })

  describe('POST /upload/audio', () => {
    test('returns taskId when audio file is provided', async () => {
      const res = await request(app)
        .post('/upload/audio')
        .attach('audio', minimalMp3, { filename: 'test.mp3', contentType: 'audio/mpeg' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(typeof res.body.taskId).toBe('string')
    })

    test('returns 400 when no audio is provided', async () => {
      const res = await request(app).post('/upload/audio')
      expect(res.status).toBe(400)
    })
  })
})
