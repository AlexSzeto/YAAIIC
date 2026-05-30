import { Router } from 'express';
import {
  getStats,
  purgeUnreferenced,
  purgePortraits,
  emptyTrash,
} from './service.mjs';

const router = new Router();

router.get('/admin/storage/stats', (_req, res) => {
  res.json(getStats());
});

router.post('/admin/storage/purge', (_req, res) => {
  res.json(purgeUnreferenced());
});

router.post('/admin/storage/purge-portraits', (_req, res) => {
  res.json(purgePortraits());
});

router.post('/admin/storage/empty-trash', (_req, res) => {
  res.json(emptyTrash());
});

export default router;
