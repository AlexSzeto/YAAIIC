/**
 * Migration: 7-media-data-parts-attributes-merge.mjs
 *
 * Merges `categoryAttributeValues` and `customAttributeValues` on every part
 * entry inside `mediaData[*].parts` into a single `attributeValues` map,
 * matching the new data shape used by the AnyTale UI.
 *
 *   Before:
 *     "head": {
 *       "enabled": true,
 *       "categoryAttributeValues": { "Color": "brown_hair", ... },
 *       "customAttributeValues":   { "Eye Shadow": "red eyeshadow" },
 *       "previewImageUrl": "..."
 *     }
 *
 *   After:
 *     "head": {
 *       "enabled": true,
 *       "attributeValues": { "Color": "brown_hair", "Eye Shadow": "red eyeshadow", ... },
 *       "previewImageUrl": "..."
 *     }
 *
 * Part entries that already have `attributeValues` (and no old keys) are left
 * untouched – the script is idempotent.
 *
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/7-media-data-parts-attributes-merge.mjs
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
// Main
// ---------------------------------------------------------------------------
const raw = fs.readFileSync(MEDIA_DATA_PATH, 'utf8');
const db = JSON.parse(raw);

let migrated = 0;
let skipped = 0;
let itemsWithParts = 0;

for (const item of db.mediaData) {
  if (!item.parts || typeof item.parts !== 'object') continue;

  itemsWithParts++;

  for (const [partName, partData] of Object.entries(item.parts)) {
    if (!partData || typeof partData !== 'object') continue;

    const hasCatVals  = 'categoryAttributeValues' in partData;
    const hasCustVals = 'customAttributeValues'   in partData;

    // Already migrated – no old keys present
    if (!hasCatVals && !hasCustVals) {
      skipped++;
      continue;
    }

    // Merge: categoryAttributeValues first (convert underscores → spaces),
    // then customAttributeValues on top (already space-separated).
    const catVals = Object.fromEntries(
      Object.entries(partData.categoryAttributeValues || {}).map(
        ([k, v]) => [k, typeof v === 'string' ? v.replace(/_/g, ' ') : v]
      )
    );
    const merged = {
      ...catVals,
      ...(partData.customAttributeValues || {}),
    };

    // Preserve any existing attributeValues that may have been partially written,
    // letting the merged legacy data fill in only missing keys.
    partData.attributeValues = {
      ...merged,
      ...(partData.attributeValues || {}),
    };

    delete partData.categoryAttributeValues;
    delete partData.customAttributeValues;
    migrated++;
  }
}

if (migrated === 0) {
  console.log(`Nothing to migrate. ${skipped} part(s) across ${itemsWithParts} item(s) already use attributeValues.`);
  process.exit(0);
}

// Write backup then save
const backupPath = createBackup(MEDIA_DATA_PATH);
console.log(`Backup written to: ${backupPath}`);

fs.writeFileSync(MEDIA_DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log(`Done. Migrated ${migrated} part(s) across ${itemsWithParts} item(s). ${skipped} already up-to-date.`);
