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
// Type Definitions
// ---------------------------------------------------------------------------

/**
 * A single entry in the media gallery (image, video, or audio).
 * @typedef {Object} MediaEntry
 * @property {number} uid - Auto-generated unique identifier
 * @property {string} timestamp - ISO timestamp (auto-generated on creation)
 * @property {string} folder - Folder UID; empty string means Unsorted
 * @property {string} [name='']
 * @property {string} [description='']
 * @property {string} [summary='']
 * @property {string} [tags='']
 * @property {string} [prompt='']
 * @property {string|null} [imageUrl] - Relative URL, e.g. '/media/image_42.png'
 * @property {string|null} [audioUrl] - Relative URL, e.g. '/media/audio_3.mp3'
 * @property {number|null} [seed]
 * @property {string} [workflow=''] - Name of the workflow used to generate this entry
 * @property {'image'|'video'|'audio'} [type='image']
 * @property {'portrait'|'landscape'|'square'|null} [orientation]
 * @property {boolean} [inpaint=false]
 * @property {{ x: number, y: number, width: number, height: number }|null} [inpaintArea]
 * @property {number} [timeTaken=0] - Wall-clock seconds from task start to completion
 * @property {number|null} [length] - Duration in seconds (video/audio only)
 * @property {number|null} [framerate] - Frames per second (video only)
 * @property {string[]|null} [clips] - Clip filenames for multi-clip audio entries
 * @property {string|null} [imageFormat] - File extension, e.g. 'png', 'webp', 'mp4'
 * @property {string|null} [audioFormat] - File extension, e.g. 'mp3', 'wav', 'flac'
 * @property {Object} [extraInputs={}] - Extra-input values keyed by ExtraInput.id
 * @property {Object|null} [parts] - Anytale character parts snapshot (anytale-generated entries only)
 * @property {Object|null} [plot] - Anytale plot snapshot (anytale-generated entries only)
 */

/**
 * @typedef {Object} MediaFolder
 * @property {string} uid
 * @property {string} label
 */

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
