/**
 * Migration: 11-media-format-to-core-fields.mjs
 *
 * Promotes `imageFormat` and `audioFormat` from `extraInputs` (or derives them
 * from the file URL extension) to top-level core fields on every entry in
 * `mediaData`, matching the updated media-data-schema.json that now declares
 * these as required core fields.
 *
 *   Before (format buried in extraInputs or absent):
 *     { "uid": 1, "imageUrl": "/media/image_1.png", "extraInputs": { "imageFormat": "png" } }
 *
 *   After:
 *     { "uid": 1, "imageUrl": "/media/image_1.png", "imageFormat": "png", "extraInputs": {} }
 *
 * Promotion order for each field:
 *   1. Already set at the top level → leave untouched (idempotent)
 *   2. Present in extraInputs → promote and remove from extraInputs
 *   3. Derive from the file URL extension as a last resort
 *
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/11-media-format-to-core-fields.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MEDIA_DATA_PATH = path.join(PROJECT_ROOT, 'server', 'database', 'media-data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// ---------------------------------------------------------------------------
// Backup helper
// ---------------------------------------------------------------------------
function createBackup(filePath) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = path.basename(filePath, '.json');
  const dest = path.join(BACKUP_DIR, `${name}-backup-${ts}.json`);
  fs.copyFileSync(filePath, dest);
  return dest;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function deriveExtension(url) {
  if (!url) return null;
  const ext = path.extname(url).slice(1).toLowerCase();
  return ext || null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const raw = fs.readFileSync(MEDIA_DATA_PATH, 'utf8');
const db = JSON.parse(raw);

let total = 0;
let updated = 0;
const updates = [];

for (const entry of db.mediaData) {
  total++;
  let changed = false;
  const report = { uid: entry.uid, fields: [] };

  for (const [field, urlField] of [['imageFormat', 'imageUrl'], ['audioFormat', 'audioUrl']]) {
    if (urlField === 'audioUrl' && !entry.audioUrl) continue;
    if (entry[field]) continue; // already set at top level

    let value = null;

    if (entry.extraInputs && entry.extraInputs[field]) {
      value = entry.extraInputs[field];
    } else {
      value = deriveExtension(entry[urlField]);
    }

    if (value) {
      entry[field] = value;
      if (entry.extraInputs) delete entry.extraInputs[field];
      report.fields.push(`${field}="${value}"`);
      changed = true;
    }
  }

  if (changed) {
    updated++;
    updates.push(report);
  }
}

if (updated === 0) {
  console.log(`Nothing to migrate. All ${total} entries already have top-level format fields.`);
  process.exit(0);
}

const backupPath = createBackup(MEDIA_DATA_PATH);
console.log(`Backup written to: ${backupPath}`);

fs.writeFileSync(MEDIA_DATA_PATH, JSON.stringify(db, null, 2), 'utf8');

console.log(`Migration complete: ${total} entries processed, ${updated} updated.`);
for (const r of updates) {
  console.log(`  UID ${r.uid}: ${r.fields.join(', ')}`);
}
