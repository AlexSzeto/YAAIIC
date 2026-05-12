/**
 * Migration: 4-anytale-plot-page-shape.mjs
 *
 * Transforms every plot block's pages from the old shape:
 *   { tags: string, parts: Array<{ identifier, forceDisable, templateTag }> }
 * to the new shape:
 *   { tags: string, hiddenParts: string[] }
 *
 * - `hiddenParts` = identifiers from entries where forceDisable === true.
 * - Non-empty `templateTag` values are appended to `tags` as comma-separated entries.
 * - The old `parts` field is removed.
 * - Pages already in the new shape (no `parts` array with `identifier` fields) are left untouched.
 *
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/4-anytale-plot-page-shape.mjs
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
let plotsProcessed = 0;
let pagesMigrated = 0;
let pagesSkipped = 0;

/**
 * Determine if a page is in the old format.
 * Old format = has a `parts` array whose elements contain an `identifier` field.
 * @param {Object} page
 * @returns {boolean}
 */
function isOldFormat(page) {
  return Array.isArray(page.parts) && page.parts.length > 0 && 'identifier' in page.parts[0];
}

/**
 * Transform a single old-format page to the new shape.
 * @param {Object} page
 * @returns {Object}
 */
function migratePage(page) {
  const { parts, tags: existingTags, ...rest } = page;

  // Build hiddenParts from force-disabled entries
  const hiddenParts = parts
    .filter(m => m.forceDisable === true)
    .map(m => m.identifier);

  // Append non-empty templateTag values to tags, substituting {{name}} with the identifier
  const templateTags = parts
    .filter(m => m.templateTag && m.templateTag.trim())
    .map(m => m.templateTag.trim().replace(/\{\{name\}\}/g, `{{${m.identifier}}}` || ''));

  let tags = (existingTags || '').trim();
  for (const tt of templateTags) {
    if (tags) {
      tags += ', ' + tt;
    } else {
      tags = tt;
    }
  }
  // Normalize: strip leading/trailing commas and extra whitespace
  tags = tags.replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s*,\s*/g, ', ');

  return { ...rest, tags, hiddenParts };
}

if (Array.isArray(data.plot)) {
  for (const plot of data.plot) {
    if (!Array.isArray(plot.pages)) continue;
    plotsProcessed++;
    for (let i = 0; i < plot.pages.length; i++) {
      const page = plot.pages[i];
      if (isOldFormat(page)) {
        plot.pages[i] = migratePage(page);
        pagesMigrated++;
      } else {
        pagesSkipped++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Write back
// ---------------------------------------------------------------------------
fs.writeFileSync(ANYTALE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\nMigration complete:');
console.log(`  Plots processed : ${plotsProcessed}`);
console.log(`  Pages migrated  : ${pagesMigrated}`);
console.log(`  Pages skipped   : ${pagesSkipped}`);
