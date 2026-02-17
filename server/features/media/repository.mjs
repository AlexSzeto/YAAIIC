/**
 * Media Repository – domain-specific data-access layer.
 *
 * Wraps the core database module so that the media service/router never
 * need to import core/database.mjs directly.  If persistence details change
 * (e.g. switching from JSON to SQLite), only this file needs updating.
 *
 * @module features/media/repository
 */
import {
  loadMediaData as _loadMediaData,
  saveMediaData as _saveMediaData,
  addMediaDataEntry as _addMediaDataEntry,
  getAllMediaData as _getAllMediaData,
  findMediaByUid as _findMediaByUid,
  findMediaIndexByUid as _findMediaIndexByUid,
  replaceMediaAtIndex as _replaceMediaAtIndex,
  deleteMediaByUids as _deleteMediaByUids,
  getFolders as _getFolders,
  getCurrentFolder as _getCurrentFolder,
  setCurrentFolder as _setCurrentFolder,
  addFolder as _addFolder,
  findFolderByUid as _findFolderByUid,
  findFolderByLabel as _findFolderByLabel,
  removeFolderByUid as _removeFolderByUid,
  reassignMediaFolder as _reassignMediaFolder
} from '../../core/database.mjs';

// ---------------------------------------------------------------------------
// Media entries
// ---------------------------------------------------------------------------

/** Load persisted media data into memory. */
export const loadMediaData = _loadMediaData;

/** Persist current in-memory state to disk. */
export const saveMediaData = _saveMediaData;

/**
 * Add a new media entry (uid & timestamp auto-generated).
 * @param {Object} entry
 * @returns {Object} The saved entry.
 */
export const addMediaDataEntry = _addMediaDataEntry;

/**
 * Return every media entry.
 * @returns {Object[]}
 */
export const getAll = _getAllMediaData;

/**
 * Find a single entry by UID.
 * @param {number} uid
 * @returns {Object|undefined}
 */
export const findByUid = _findMediaByUid;

/**
 * Find the array index of an entry by UID.
 * @param {number} uid
 * @returns {number} -1 when not found.
 */
export const findIndexByUid = _findMediaIndexByUid;

/**
 * Overwrite the entry at a given index.
 * @param {number} index
 * @param {Object} newData
 */
export const replaceAtIndex = _replaceMediaAtIndex;

/**
 * Bulk-delete entries by UID list.
 * @param {number[]} uids
 * @returns {number} Count of deleted entries.
 */
export const deleteByUids = _deleteMediaByUids;

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/** @returns {Object[]} */
export const getFolders = _getFolders;

/** @returns {string} Current folder UID (empty string = Unsorted). */
export const getCurrentFolder = _getCurrentFolder;

/**
 * Set the active folder.
 * @param {string} uid
 */
export const setCurrentFolder = _setCurrentFolder;

/**
 * Append a folder.
 * @param {{ uid: string, label: string }} folder
 */
export const addFolder = _addFolder;

/**
 * @param {string} uid
 * @returns {Object|undefined}
 */
export const findFolderByUid = _findFolderByUid;

/**
 * @param {string} label
 * @returns {Object|undefined}
 */
export const findFolderByLabel = _findFolderByLabel;

/**
 * Remove a folder.
 * @param {string} uid
 * @returns {Object|undefined} The removed folder.
 */
export const removeFolderByUid = _removeFolderByUid;

/**
 * Move every entry from one folder to another.
 * @param {string} fromUid
 * @param {string} toUid
 * @returns {number} Count of updated entries.
 */
export const reassignMediaFolder = _reassignMediaFolder;
