/**
 * Media Service – business logic for the media domain.
 *
 * Routes call into this service rather than containing business logic
 * directly.  The service talks to the MediaRepository for data access
 * and to core modules (paths, config) for infrastructure concerns.
 *
 * @module features/media/service
 */
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { RESOURCE_DIR, STORAGE_DIR } from '../../core/paths.mjs';
import * as repo from './repository.mjs';

// ---------------------------------------------------------------------------
// Media search / filter
// ---------------------------------------------------------------------------

/**
 * Search and filter media entries.
 *
 * @param {Object} options
 * @param {string} [options.query]       - Free-text search across name, description, prompt, and timestamp.
 * @param {string[]} [options.tags]      - Every tag must match (AND logic).
 * @param {string} [options.folder]      - Folder UID (empty string = Unsorted). Falls back to current folder if undefined.
 * @param {string} [options.sort]        - 'ascending' or 'descending' (default).
 * @param {number} [options.limit]       - Max entries to return (default 10).
 * @returns {Object[]} Filtered, sorted, and limited slice of media data.
 */
export function searchMedia({ query = '', tags = [], folder, sort = 'descending', limit = 10 } = {}) {
  // Default to current folder when caller did not supply one
  const folderId = folder !== undefined ? folder : repo.getCurrentFolder();

  let filtered = repo.getAll().filter(item => {
    // --- Folder match ---
    let folderMatch;
    if (folderId === '') {
      folderMatch = !item.folder || item.folder === '';
    } else {
      folderMatch = item.folder === folderId;
    }

    // --- Free-text query ---
    let queryMatch = true;
    if (query) {
      const q = query.toLowerCase();
      const nameMatch = item.name && item.name.toLowerCase().includes(q);
      const descriptionMatch = item.description && item.description.toLowerCase().includes(q);
      const promptMatch = item.prompt && item.prompt.toLowerCase().includes(q);

      let timestampMatch = false;
      if (item.timestamp) {
        const formatted = new Date(item.timestamp).toISOString().split('T')[0];
        timestampMatch = formatted.includes(query);
      }

      queryMatch = nameMatch || descriptionMatch || promptMatch || timestampMatch;
    }

    // --- Tag match (AND) ---
    let tagMatch = true;
    if (tags.length > 0) {
      if (!item.tags) {
        tagMatch = false;
      } else {
        const itemTags = typeof item.tags === 'string'
          ? item.tags.split(',').map(t => t.trim())
          : (Array.isArray(item.tags) ? item.tags : []);

        tagMatch = tags.every(searchTag =>
          itemTags.some(itemTag => itemTag.toLowerCase() === searchTag.toLowerCase())
        );
      }
    }

    return folderMatch && queryMatch && tagMatch;
  });

  // --- Sort ---
  filtered.sort((a, b) => {
    const dateA = new Date(a.timestamp || 0);
    const dateB = new Date(b.timestamp || 0);
    return sort === 'ascending' ? dateA - dateB : dateB - dateA;
  });

  return filtered.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Single media lookup
// ---------------------------------------------------------------------------

/**
 * Get a single media entry by UID.
 * @param {number} uid
 * @returns {{ found: boolean, data?: Object }}
 */
export function getMediaByUid(uid) {
  const data = repo.findByUid(uid);
  return data ? { found: true, data } : { found: false };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete media entries by UID list.
 *
 * @param {number[]} uids
 * @returns {{ deletedCount: number }}
 * @throws {Error} On save failure.
 */
export function deleteMedia(uids) {
  const deletedCount = repo.deleteByUids(uids);
  repo.saveMediaData();
  return { deletedCount };
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

/**
 * Batch-update media entries.
 *
 * @param {Object[]} items - Array of objects with at least a `uid` field.
 * @returns {{ updatedItems: Object[], notFoundUids: number[] }}
 * @throws {Error} On save failure.
 */
export function editMedia(items) {
  const updatedItems = [];
  const notFoundUids = [];

  for (const updatedData of items) {
    const idx = repo.findIndexByUid(updatedData.uid);
    if (idx === -1) {
      notFoundUids.push(updatedData.uid);
      continue;
    }
    repo.replaceAtIndex(idx, updatedData);
    updatedItems.push(updatedData);
  }

  if (updatedItems.length > 0) {
    repo.saveMediaData();
  }

  return { updatedItems, notFoundUids };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/**
 * Load tags from the Danbooru CSV, applying the provided filters.
 *
 * @param {Object} options
 * @param {boolean} [options.noCharacters=true]  - Exclude entries with parentheses.
 * @param {number}  [options.minLength=4]        - Minimum tag length.
 * @param {number}  [options.minUsageCount=100]  - Minimum usage count.
 * @param {string[]} [options.filterCategories]  - Category IDs to include (default ['0']).
 * @returns {Promise<{ tags: string[], definitions: Object, categoryTree: Object, filters: Object }>}
 */
export function loadTags({ noCharacters = true, minLength = 4, minUsageCount = 100, filterCategories = ['0'] } = {}) {
  return new Promise((resolve, reject) => {
    // Category tree
    let categoryTree = {};
    const categoryTreePath = path.join(RESOURCE_DIR, 'danbooru_category_tree.json');
    try {
      categoryTree = JSON.parse(fs.readFileSync(categoryTreePath, 'utf8'));
    } catch (err) {
      console.error('Error reading danbooru_category_tree.json:', err.message);
    }

    const results = [];
    const definitions = {};

    fs.createReadStream(path.join(RESOURCE_DIR, 'danbooru_tags.csv'))
      .pipe(csv())
      .on('data', (row) => {
        const tagName = row.tag;
        const category = row.category;
        const usageCount = parseInt(row.count) || 0;
        const definition = row.definition;

        if (!tagName || !category || !filterCategories.some(cat => cat === category)) return;

        // Collect definitions regardless of other filters
        if (definition && definition.trim()) {
          definitions[tagName] = definition.trim();
        }

        // Apply tag-list filters
        if (noCharacters && tagName.includes('(') && tagName.includes(')')) return;
        if (tagName.length < minLength) return;
        if (usageCount < minUsageCount) return;

        results.push(tagName.replace(/_/g, ' '));
      })
      .on('end', () => {
        resolve({
          tags: results,
          definitions,
          categoryTree,
          filters: { noCharacters, minLength, minUsageCount, totalReturned: results.length }
        });
      })
      .on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/**
 * List all folders with "Unsorted" prepended, plus the current folder UID.
 * @returns {{ list: Object[], current: string }}
 */
export function listFolders() {
  const list = [
    { uid: '', label: 'Unsorted' },
    ...repo.getFolders()
  ];
  return { list, current: repo.getCurrentFolder() };
}

/**
 * Create and/or select a folder.
 *
 * Possible call signatures:
 * - `{ uid }`:          Select an existing folder.
 * - `{ label }`:        Create (or find) a folder with that label and select it.
 * - `{ uid, label }`:   Create or rename, then select.
 *
 * @param {{ uid?: string, label?: string }} params
 * @returns {{ list: Object[], current: string }}
 */
export function createOrSelectFolder({ uid, label }) {
  const hasUid = uid !== undefined && uid !== null;
  const hasLabel = label !== undefined && label !== null && typeof label === 'string' && label.trim().length > 0;

  if (!hasUid && !hasLabel) {
    throw Object.assign(new Error('Must provide either uid or label'), { status: 400 });
  }

  let folder;

  if (hasUid && !hasLabel) {
    // Select existing
    if (uid === '' || uid === null) {
      repo.setCurrentFolder('');
    } else {
      folder = repo.findFolderByUid(uid);
      if (!folder) throw Object.assign(new Error(`Folder with uid ${uid} not found`), { status: 404 });
      repo.setCurrentFolder(folder.uid);
    }
  } else if (!hasUid && hasLabel) {
    // Create or find by label
    folder = repo.findFolderByLabel(label.trim());
    if (!folder) {
      folder = { uid: `folder-${Date.now()}`, label: label.trim() };
      repo.addFolder(folder);
    }
    repo.setCurrentFolder(folder.uid);
  } else {
    // Both uid and label
    if (typeof label !== 'string' || label.trim().length === 0) {
      throw Object.assign(new Error('Invalid folder label'), { status: 400 });
    }
    folder = repo.findFolderByUid(uid);
    if (!folder) {
      folder = { uid, label: label.trim() };
      repo.addFolder(folder);
    } else if (folder.label !== label.trim()) {
      folder.label = label.trim();
    }
    repo.setCurrentFolder(folder.uid);
  }

  repo.saveMediaData();
  return listFolders();
}

/**
 * Rename an existing folder.
 *
 * @param {string} uid
 * @param {string} label
 * @returns {{ list: Object[], current: string }}
 */
export function renameFolder(uid, label) {
  if (!uid || typeof uid !== 'string') {
    throw Object.assign(new Error('Missing or invalid folder uid'), { status: 400 });
  }
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    throw Object.assign(new Error('Missing or invalid folder label'), { status: 400 });
  }
  if (uid === '') {
    throw Object.assign(new Error('Cannot rename the Unsorted folder'), { status: 400 });
  }

  const folder = repo.findFolderByUid(uid);
  if (!folder) throw Object.assign(new Error(`Folder with uid ${uid} not found`), { status: 404 });

  folder.label = label.trim();
  repo.saveMediaData();
  return listFolders();
}

/**
 * Delete a folder and reassign its entries to Unsorted.
 *
 * @param {string} uid
 * @returns {{ list: Object[], current: string, movedCount: number }}
 */
export function deleteFolder(uid) {
  if (!uid || typeof uid !== 'string') {
    throw Object.assign(new Error('Missing or invalid folder uid'), { status: 400 });
  }
  if (uid === '') {
    throw Object.assign(new Error('Cannot delete the Unsorted folder'), { status: 400 });
  }

  const deleted = repo.removeFolderByUid(uid);
  if (!deleted) throw Object.assign(new Error(`Folder with uid ${uid} not found`), { status: 404 });

  if (repo.getCurrentFolder() === uid) {
    repo.setCurrentFolder('');
  }

  const movedCount = repo.reassignMediaFolder(uid, '');
  repo.saveMediaData();

  return { ...listFolders(), movedCount };
}

// ---------------------------------------------------------------------------
// Regenerate helpers (used by router to reconstruct saveImagePath)
// ---------------------------------------------------------------------------

/**
 * Reconstruct the local storage path for a media entry's image.
 * @param {Object} entry
 * @returns {string|null} The absolute path, or null when imageUrl is missing.
 */
export function resolveStoragePath(entry) {
  if (!entry.imageUrl) return null;
  const filename = entry.imageUrl.replace(/^\/media\//, '');
  return path.join(STORAGE_DIR, filename);
}
