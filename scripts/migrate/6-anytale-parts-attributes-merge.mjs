/**
 * Migration: 6-anytale-parts-attributes-merge.mjs
 *
 * Collapses `categoryAttributes` and `customAttributes` on every saved AnyTale
 * library part into a single `attributes` array, matching the new data shape.
 *
 *   Before:
 *     {
 *       "categoryAttributes": [{ "name": "Color", "category": "tag_group:hair_color/..." }],
 *       "customAttributes":   [{ "name": "Misc",  "options": "tag1, tag2" }]
 *     }
 *
 *   After:
 *     {
 *       "attributes": [
 *         { "name": "Color", "options": "red hair, blonde hair, ..." },
 *         { "name": "Misc",  "options": "tag1, tag2" }
 *       ]
 *     }
 *
 * For category attributes:
 *   - The `category` value is looked up in danbooru_category_tree.json to get leaf tags.
 *   - Tags containing `:` or `/` are filtered out (they are intermediate nodes, not leaves).
 *   - Resulting tags are joined as a comma-separated `options` string.
 *   - If the category is not found in the tree, it is treated as a single direct tag.
 *
 * Parts that already have `attributes` and no `categoryAttributes`/`customAttributes`
 * are left untouched (idempotent).
 *
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/6-anytale-parts-attributes-merge.mjs
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
const CATEGORY_TREE_PATH = path.join(PROJECT_ROOT, 'server', 'resource', 'danbooru_category_tree.json');
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

const categoryTree = JSON.parse(fs.readFileSync(CATEGORY_TREE_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a category internal name to its leaf tags.
 * Returns an array of tag strings (underscores replaced with spaces).
 * Tags containing ':' or '/' in the original are excluded.
 */
function resolveCategoryToOptions(categoryInternal) {
  if (!categoryInternal) return [];

  const children = categoryTree[categoryInternal];
  if (!Array.isArray(children)) {
    // Not a tree node — treat as a direct tag if it has no ':' or '/'
    if (!categoryInternal.includes(':') && !categoryInternal.includes('/')) {
      return [categoryInternal.replace(/_/g, ' ')];
    }
    return [];
  }

  // Filter out intermediate nodes (those containing ':' or '/')
  return children
    .filter(tag => !tag.includes(':') && !tag.includes('/'))
    .map(tag => tag.replace(/_/g, ' '));
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
let migrated = 0;
let skipped = 0;
const unresolved = [];

if (Array.isArray(data.parts)) {
  for (const part of data.parts) {
    const hasCategoryAttrs = Array.isArray(part.categoryAttributes) && part.categoryAttributes.length > 0;
    const hasCustomAttrs = Array.isArray(part.customAttributes) && part.customAttributes.length > 0;
    const hasNewAttrs = Array.isArray(part.attributes);

    // Skip if already migrated (has 'attributes', no legacy fields)
    if (hasNewAttrs && !hasCategoryAttrs && !hasCustomAttrs) {
      skipped++;
      continue;
    }

    const attributes = [];

    // 1. Convert categoryAttributes → attributes with resolved options
    for (const catAttr of (part.categoryAttributes || [])) {
      const options = resolveCategoryToOptions(catAttr.category);
      if (options.length === 0 && catAttr.category) {
        unresolved.push({ part: part.uid || part.name, category: catAttr.category });
      }
      attributes.push({
        name: catAttr.name || '',
        options: options.join(', '),
      });
    }

    // 2. Append customAttributes as-is
    for (const custAttr of (part.customAttributes || [])) {
      attributes.push({
        name: custAttr.name || '',
        options: custAttr.options || '',
      });
    }

    // Write the new shape
    part.attributes = attributes;
    delete part.categoryAttributes;
    delete part.customAttributes;

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
console.log(`  Parts skipped  : ${skipped} (already migrated)`);

if (unresolved.length > 0) {
  console.log(`\nUnresolved categories (no leaf tags found):`);
  for (const { part, category } of unresolved) {
    console.log(`  Part "${part}" — category: "${category}"`);
  }
}
