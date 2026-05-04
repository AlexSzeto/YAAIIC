/**
 * AnyTale Service – Business logic for the parts library.
 */
import { listParts, upsertPart, deletePart } from './repository.mjs';

export function getAllParts() {
  return listParts();
}

export function savePart(uid, config) {
  if (!uid || typeof uid !== 'string') {
    const err = new Error('uid is required and must be a string');
    err.code = 'EINVAL';
    throw err;
  }
  return upsertPart(uid, config);
}

export function removePartByUid(uid) {
  // throws with code ENOENT if not found
  deletePart(uid);
}
