/**
 * Migration: 9-anytale-remove-hidden-parts.mjs
 *
 * Removes the `hiddenParts` field from every page object inside
 * every plot entry in anytale-data.json.
 *
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/9-anytale-remove-hidden-parts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const ANYTALE_DATA_PATH = path.join(PROJECT_ROOT, 'server', 'database', 'anytale-data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `anytale-data-backup-${timestamp}.json`);
fs.copyFileSync(ANYTALE_DATA_PATH, backupPath);
console.log(`Backup created at: ${backupPath}`);

const raw = fs.readFileSync(ANYTALE_DATA_PATH, 'utf8');
const data = JSON.parse(raw);

let removedCount = 0;

for (const entry of (data.plot ?? [])) {
  for (const page of (entry.pages ?? [])) {
    if ('hiddenParts' in page) {
      delete page.hiddenParts;
      removedCount++;
    }
  }
}

console.log(`Removed hiddenParts from ${removedCount} page(s) across ${(data.plot ?? []).length} plot entries.`);

fs.writeFileSync(ANYTALE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`\nMigration complete. Updated file written to: ${ANYTALE_DATA_PATH}`);
console.log(`Original data backed up to: ${backupPath}`);
