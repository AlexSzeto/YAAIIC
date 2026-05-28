import { vi, describe, test, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('./service.mjs', () => ({
  searchMedia: vi.fn(() => [
    { uid: 1, name: 'test-image', imageUrl: '/media/test.png' },
  ]),
  getMediaByUid: vi.fn((uid) =>
    uid === 1
      ? { found: true, data: { uid: 1, name: 'test-image' } }
      : { found: false },
  ),
  deleteMedia: vi.fn(() => ({ deletedCount: 1 })),
  loadTags: vi.fn(() =>
    Promise.resolve({
      tags: ['foo', 'bar'],
      definitions: {},
      categoryTree: {},
      filters: { noCharacters: true, minLength: 4, minUsageCount: 100, totalReturned: 2 },
    }),
  ),
  listFolders: vi.fn(() => ({ list: [{ uid: '', label: 'Unsorted' }], current: '' })),
  createOrSelectFolder: vi.fn(() => ({ list: [{ uid: '', label: 'Unsorted' }], current: '' })),
  renameFolder: vi.fn(() => ({ list: [{ uid: '', label: 'Unsorted' }], current: '' })),
  deleteFolder: vi.fn(() => ({ list: [{ uid: '', label: 'Unsorted' }], current: '' })),
  editMedia: vi.fn(() => ({ updatedItems: [{ uid: 1, name: 'updated' }], notFoundUids: [] })),
}))

const { default: router } = await import('./router.mjs')

const app = express()
app.use(express.json())
app.use(router)

describe('Media Router', () => {
  describe('GET /media-data', () => {
    test('returns an array', async () => {
      const res = await request(app).get('/media-data')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    test('returns results matching the mock', async () => {
      const res = await request(app).get('/media-data')
      expect(res.body.length).toBeGreaterThanOrEqual(1)
      expect(res.body[0]).toHaveProperty('uid')
    })
  })

  describe('GET /tags', () => {
    test('returns an object with tags array', async () => {
      const res = await request(app).get('/tags')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.tags)).toBe(true)
    })

    test('tags response includes definitions and filters', async () => {
      const res = await request(app).get('/tags')
      expect(res.body).toHaveProperty('definitions')
      expect(res.body).toHaveProperty('filters')
    })
  })

  describe('DELETE /media-data/delete', () => {
    test('accepts uid array and returns success', async () => {
      const res = await request(app)
        .delete('/media-data/delete')
        .send({ uids: [1, 2] })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(typeof res.body.deletedCount).toBe('number')
    })

    test('rejects missing uids', async () => {
      const res = await request(app)
        .delete('/media-data/delete')
        .send({})
      expect(res.status).toBe(400)
    })

    test('rejects empty uids array', async () => {
      const res = await request(app)
        .delete('/media-data/delete')
        .send({ uids: [] })
      expect(res.status).toBe(400)
    })

    test('rejects non-integer uids', async () => {
      const res = await request(app)
        .delete('/media-data/delete')
        .send({ uids: ['abc', 1.5] })
      expect(res.status).toBe(400)
    })
  })
})
