import { Router } from 'express';
import * as service from './service.mjs';

const router = Router();

// ---------------------------------------------------------------------------
// Queue SSE stream – GET /queue/sse
// ---------------------------------------------------------------------------

const queueSseClients = new Set();

const QUEUE_SSE_HEARTBEAT_MS = 30000;

export function emitQueueEvent(event, payload) {
  const data = JSON.stringify(payload);
  const msg = `event: ${event}\ndata: ${data}\n\n`;
  const disconnected = new Set();
  queueSseClients.forEach(res => {
    try { res.write(msg); }
    catch { disconnected.add(res); }
  });
  disconnected.forEach(res => queueSseClients.delete(res));
}

// Wire the emitter into the service before any requests arrive
service.setEmitQueueEvent(emitQueueEvent);

router.get('/queue/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  queueSseClients.add(res);

  // Send current state immediately
  const data = JSON.stringify(service.getStatus());
  res.write(`event: queue:updated\ndata: ${data}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); }
    catch { clearInterval(heartbeat); }
  }, QUEUE_SSE_HEARTBEAT_MS);

  req.on('close', () => {
    queueSseClients.delete(res);
    clearInterval(heartbeat);
  });
});

// ---------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------

router.get('/queue/status', (req, res) => {
  res.json(service.getStatus());
});

router.post('/queue/start', (req, res) => {
  const ok = service.start();
  if (!ok) return res.status(409).json({ error: 'Queue is already running' });
  res.json({ success: true });
});

router.post('/queue/pause', (req, res) => {
  const ok = service.pause();
  if (!ok) return res.status(409).json({ error: 'Queue is not running' });
  res.json({ success: true });
});

router.post('/queue/skip', (req, res) => {
  const ok = service.skip();
  if (!ok) return res.status(409).json({ error: 'Queue is not running' });
  res.json({ success: true });
});

router.delete('/queue/item/:id', (req, res) => {
  const found = service.deleteItem(req.params.id);
  if (!found) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

router.post('/queue/clear', (req, res) => {
  service.clear();
  res.json({ success: true });
});

router.patch('/queue/reorder', (req, res) => {
  const { id, toIndex } = req.body;
  if (id === undefined || toIndex === undefined) {
    return res.status(400).json({ error: 'id and toIndex are required' });
  }
  const { state } = service.getStatus();
  const activeStates = ['running', 'cancelling', 'skipping', 'pausing'];
  if (activeStates.includes(state) && toIndex === 0) {
    return res.status(400).json({ error: 'Cannot move item to position 0 while queue is active' });
  }
  const ok = service.reorder({ id, toIndex });
  if (!ok) return res.status(400).json({ error: 'Invalid reorder parameters' });
  res.json({ success: true });
});

export default router;
