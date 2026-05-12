/**
 * Migration: 5-anytale-parts-type-to-array.mjs
 *
 * Converts the `type` field on every saved AnyTale part from a plain string
 * to a `string[]`, matching the new data shape used by the UI.
 *
 *   Before: { "type": "hair" }
 *   After:  { "type": ["hair"] }
 *
 *   Before: { "type": "" }   (or missing)
 *   After:  { "type": [] }
 *
 * Parts whose `type` is already an array are left untouched.
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/5-anytale-parts-type-to-array.mjs
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
const ANYTALE_DATA_PATH = path.join(PROJECT_ROOT, 'server', 'database', 'anytale-data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `anytale-data-backup-${timestamp}.json`);
fs.copyFileSync(ANYTALE_DATA_PATH, backupPath);
console.log(`Backup created at: ${backupPath}`);

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
const raw = fs.readFileSync(ANYTALE_DATA_PATH, 'utf8');
const data = JSON.parse(raw);

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
let migrated = 0;
let skipped = 0;

if (Array.isArray(data.parts)) {
  for (const part of data.parts) {
    if (Array.isArray(part.type)) {
      skipped++;
      continue;
    }
    // Coerce string (or missing) to array
    const str = typeof part.type === 'string' ? part.type.trim() : '';
    part.type = str ? [str] : [];
    migrated++;
  }
}

// ---------------------------------------------------------------------------
// Write back
// ---------------------------------------------------------------------------
fs.writeFileSync(ANYTALE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\nDone.`);
console.log(`  Parts migrated : ${migrated}`);
console.log(`  Parts skipped  : ${skipped} (already array)`);
