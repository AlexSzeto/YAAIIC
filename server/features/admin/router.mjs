import { Router } from 'express';

const router = new Router();

router.post('/admin/restart', (req, res) => {
  res.json({ ok: true });
  // Give the response time to flush before exiting; PM2 restarts the process.
  setTimeout(() => process.exit(0), 100);
});

export default router;
