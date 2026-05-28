import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATEGORY_TREE_PATH = path.join(__dirname, '..', '..', '..', 'server', 'resource', 'danbooru_category_tree.json');

export const fromVersion = 2;
export const toVersion = 3;

/**
 * Recursively collect all leaf tag strings from a category tree node.
 * Stops recursion if maxDepth is exceeded to avoid runaway resolution.
 */
function resolveCategory(key, tree, visited = new Set(), depth = 0) {
  if (depth > 10 || visited.has(key)) return [];
  visited.add(key);

  const children = tree[key];
  if (!Array.isArray(children)) return [];

  const tags = [];
  for (const child of children) {
    if (tree[child]) {
      tags.push(...resolveCategory(child, tree, visited, depth + 1));
    } else {
      tags.push(child);
    }
  }
  return tags;
}

export function migrate(data) {
  let categoryTree = {};
  try {
    categoryTree = JSON.parse(fs.readFileSync(CATEGORY_TREE_PATH, 'utf8'));
  } catch (err) {
    console.error('[2-to-3] Could not load danbooru_category_tree.json — skipping option resolution:', err.message);
    return data;
  }

  for (const part of (data.parts || [])) {
    for (const attr of (part.attributes || [])) {
      const options = attr.options;
      if (typeof options !== 'string') continue;
      // A category reference: no comma, and exists as a key in the tree
      const trimmed = options.trim();
      if (trimmed.includes(',')) continue;
      if (!categoryTree[trimmed]) continue;

      const resolved = resolveCategory(trimmed, categoryTree);
      if (resolved.length === 0) {
        console.error(`[2-to-3] Could not resolve category "${trimmed}" for part "${part.name}" attr "${attr.name}"`);
        continue;
      }
      attr.options = resolved.join(', ');
    }
  }

  return data;
}
