/**
 * Migration: 2-backfill-media-types.mjs
 *
 * Reads server/database/media-data.json and assigns a `type` field to any
 * entry that is missing one:
 *   - 'audio'  if the entry has an audioUrl
 *   - 'video'  if imageUrl ends with .webp
 *   - 'image'  otherwise
 *
 * Run with: node server/scripts/migrate/2-backfill-media-types.mjs
 */
import fs from 'fs';
import { MEDIA_DATA_PATH } from '../../core/paths.mjs';

const raw = fs.readFileSync(MEDIA_DATA_PATH, 'utf8');
const db = JSON.parse(raw);

let updated = 0;

db.mediaData = db.mediaData.map((entry) => {
  if (entry.type) return entry; // already has a type, skip

  let type;
  if (entry.audioUrl) {
    type = 'audio';
  } else if (entry.imageUrl && entry.imageUrl.endsWith('.webp')) {
    type = 'video';
  } else {
    type = 'image';
  }

  updated++;
  return { ...entry, type };
});

fs.writeFileSync(MEDIA_DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log(`Done. Backfilled type on ${updated} entries.`);
