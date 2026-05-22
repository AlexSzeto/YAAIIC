import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const { default: router } = await import('./router.mjs');

const app = express();
app.use(express.json());
app.use(router);

describe('POST /admin/restart', () => {
  let exitSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    exitSpy.mockRestore();
  });

  test('returns { ok: true } and schedules process.exit(0)', async () => {
    const res = await request(app).post('/admin/restart');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    expect(exitSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
