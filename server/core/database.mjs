/**
 * Media-data persistence layer (Repository Pattern).
 * Owns loading / saving / mutating the in-memory globalData store.
 * All other modules should go through this module instead of touching the
 * JSON file or the globalData object directly.
 */
import fs from 'fs';
import { DATABASE_DIR, MEDIA_DATA_PATH } from './paths.mjs';

/** In-memory store */
let globalData = { mediaData: [], folders: [], currentFolder: '' };

// ---------------------------------------------------------------------------
// Loading / Saving
// ---------------------------------------------------------------------------

/**
 * Load media data from disk into the in-memory store.
 */
export function loadMediaData() {
  try {
    if (fs.existsSync(MEDIA_DATA_PATH)) {
      const data = fs.readFileSync(MEDIA_DATA_PATH, 'utf8');
      globalData = JSON.parse(data);

      // Ensure required top-level keys
      if (!globalData.folders) globalData.folders = [];
      if (!globalData.currentFolder && globalData.currentFolder !== '') globalData.currentFolder = '';
      if (!globalData.mediaData) globalData.mediaData = [];

      console.log('Media data loaded:', globalData.mediaData.length, 'entries,', globalData.folders.length, 'folders');
    } else {
      console.log('Media data file not found, starting with empty data');
      globalData = { mediaData: [], folders: [], currentFolder: '' };
    }
  } catch (error) {
    console.error('Failed to load media data:', error);
    globalData = { mediaData: [], folders: [], currentFolder: '' };
  }
}

/**
 * Persist the in-memory store to disk.
 */
export function saveMediaData() {
  try {
    if (!fs.existsSync(DATABASE_DIR)) {
      fs.mkdirSync(DATABASE_DIR, { recursive: true });
      console.log('Created database directory');
    }
    fs.writeFileSync(MEDIA_DATA_PATH, JSON.stringify(globalData, null, 2));
    console.log('Media data saved successfully');
  } catch (error) {
    console.error('Failed to save media data:', error);
  }
}

// ---------------------------------------------------------------------------
// Media entries
// ---------------------------------------------------------------------------

/**
 * Add a new media-data entry with auto-generated UID and timestamp.
 * @param {Object} entry - The media data entry to add.
 * @returns {Object} The entry with uid and timestamp filled in.
 */
export function addMediaDataEntry(entry) {
  const now = new Date();
  entry.timestamp = now.toISOString();
  entry.uid = now.getTime();
  entry.folder = globalData.currentFolder || '';
  globalData.mediaData.push(entry);
  saveMediaData();
  return entry;
}

/**
 * Find a single media entry by UID.
 * @param {number} uid
 * @returns {Object|undefined}
 */
export function findMediaByUid(uid) {
  return globalData.mediaData.find(item => item.uid === uid);
}

/**
 * Find the index of a media entry by UID.
 * @param {number} uid
 * @returns {number} index or -1
 */
export function findMediaIndexByUid(uid) {
  return globalData.mediaData.findIndex(item => item.uid === uid);
}

/**
 * Replace the entry at the given index.
 * @param {number} index
 * @param {Object} newData
 */
export function replaceMediaAtIndex(index, newData) {
  globalData.mediaData[index] = newData;
}

/**
 * Delete entries whose UID is in the provided list.
 * @param {number[]} uids
 * @returns {number} Number of entries actually deleted.
 */
export function deleteMediaByUids(uids) {
  const before = globalData.mediaData.length;
  globalData.mediaData = globalData.mediaData.filter(item => !uids.includes(item.uid));
  const deleted = before - globalData.mediaData.length;
  if (deleted > 0) saveMediaData();
  return deleted;
}

/**
 * Return the full mediaData array (read-only reference).
 * @returns {Object[]}
 */
export function getAllMediaData() {
  return globalData.mediaData;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/** @returns {Object[]} folders list */
export function getFolders() {
  if (!globalData.folders) globalData.folders = [];
  return globalData.folders;
}

/** @returns {string} current folder uid */
export function getCurrentFolder() {
  return globalData.currentFolder ?? '';
}

/**
 * Set the current folder uid.
 * @param {string} uid
 */
export function setCurrentFolder(uid) {
  globalData.currentFolder = uid;
}

/**
 * Add a folder to the list.
 * @param {{ uid: string, label: string }} folder
 */
export function addFolder(folder) {
  if (!globalData.folders) globalData.folders = [];
  globalData.folders.push(folder);
}

/**
 * Find a folder by uid.
 * @param {string} uid
 * @returns {Object|undefined}
 */
export function findFolderByUid(uid) {
  return (globalData.folders || []).find(f => f.uid === uid);
}

/**
 * Find a folder by label.
 * @param {string} label
 * @returns {Object|undefined}
 */
export function findFolderByLabel(label) {
  return (globalData.folders || []).find(f => f.label === label);
}

/**
 * Remove a folder by uid.
 * @param {string} uid
 * @returns {Object|undefined} The removed folder, or undefined if not found.
 */
export function removeFolderByUid(uid) {
  const idx = (globalData.folders || []).findIndex(f => f.uid === uid);
  if (idx === -1) return undefined;
  return globalData.folders.splice(idx, 1)[0];
}

/**
 * Update all media entries belonging to a folder to a new folder uid.
 * @param {string} fromUid
 * @param {string} toUid
 * @returns {number} Number of entries updated.
 */
export function reassignMediaFolder(fromUid, toUid) {
  let count = 0;
  globalData.mediaData.forEach(item => {
    if (item.folder === fromUid) {
      item.folder = toUid;
      count++;
    }
  });
  return count;
}
