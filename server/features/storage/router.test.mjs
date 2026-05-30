import { vi, describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('./service.mjs', () => ({
  getStats:         vi.fn(() => ({ storageCount: 10, quarantineCount: 2 })),
  purgeUnreferenced: vi.fn(() => ({ moved: 3 })),
  purgePortraits:   vi.fn(() => ({ moved: 5 })),
  emptyTrash:       vi.fn(() => ({ deleted: 2 })),
}));

const { default: router } = await import('./router.mjs');

const app = express();
app.use(express.json());
app.use(router);

describe('GET /admin/storage/stats', () => {
  test('returns storageCount and quarantineCount', async () => {
    const res = await request(app).get('/admin/storage/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ storageCount: 10, quarantineCount: 2 });
  });
});

describe('POST /admin/storage/purge', () => {
  test('returns moved count', async () => {
    const res = await request(app).post('/admin/storage/purge');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ moved: 3 });
  });
});

describe('POST /admin/storage/purge-portraits', () => {
  test('returns moved count', async () => {
    const res = await request(app).post('/admin/storage/purge-portraits');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ moved: 5 });
  });
});

describe('POST /admin/storage/empty-trash', () => {
  test('returns deleted count', async () => {
    const res = await request(app).post('/admin/storage/empty-trash');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 2 });
  });
});
