/**
 * Storage Service – purge unreferenced media files and manage the quarantine folder.
 *
 * Referenced files are determined by walking all four databases. Portrait preview
 * files (portrait_*) are excluded from the standard purge and handled separately.
 *
 * Each purge call creates a timestamped subfolder inside quarantine/ so that
 * repeated runs never collide on filenames and each session's output is isolated.
 */
import fs from 'fs';
import path from 'path';
import {
  STORAGE_DIR,
  QUARANTINE_DIR,
  MEDIA_DATA_PATH,
  ANYTALE_DATA_PATH,
  BREW_DATA_PATH,
  SOUND_SOURCES_PATH,
} from '../../core/paths.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urlToBasename(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/^\/media\//, '').split('?')[0];
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir).filter(name => {
      return fs.statSync(path.join(dir, name)).isFile();
    });
  } catch {
    return [];
  }
}

/** Recursively count all files inside dir (across subdirectories). */
function countFilesRecursive(dir) {
  try {
    let count = 0;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        count += countFilesRecursive(full);
      } else {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Create a new timestamped session folder inside quarantine/.
 * Returns the path to the created folder.
 * @returns {string}
 */
function createSessionDir() {
  const dir = path.join(QUARANTINE_DIR, String(Date.now()));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function moveToDir(filename, destDir) {
  fs.renameSync(
    path.join(STORAGE_DIR, filename),
    path.join(destDir, filename),
  );
}

// ---------------------------------------------------------------------------
// Reference collection
// ---------------------------------------------------------------------------

/**
 * Walk all databases and return a Set of referenced storage basenames.
 * @returns {Set<string>}
 */
export function buildReferencedSet() {
  const refs = new Set();

  const add = (url) => {
    const name = urlToBasename(url);
    if (name) refs.add(name);
  };

  // media-data.json
  const mediaData = readJson(MEDIA_DATA_PATH);
  if (mediaData?.mediaData) {
    for (const entry of mediaData.mediaData) {
      add(entry.imageUrl);
      add(entry.audioUrl);
    }
  }

  // anytale-data.json
  const anytale = readJson(ANYTALE_DATA_PATH);
  if (anytale) {
    for (const char of anytale.characters ?? []) {
      add(char.portraitUrl);
      add(char.audioUrl);
      for (const part of char.parts ?? []) {
        add(part.previewImageUrl);
      }
    }
    for (const outfit of anytale.outfits ?? []) {
      add(outfit.renderUrl);
      for (const part of outfit.parts ?? []) {
        add(part.previewImageUrl);
      }
    }
    for (const sfxRecord of anytale.sfx ?? []) {
      add(sfxRecord.audioUrl);
    }
    for (const genre of anytale.genres ?? []) {
      for (const track of genre.tracks ?? []) {
        add(track.audioUrl);
      }
    }
  }

  // brew-data.json — [*].data.sources[*].clips[*].url
  const brews = readJson(BREW_DATA_PATH);
  if (Array.isArray(brews)) {
    for (const brew of brews) {
      for (const source of brew?.data?.sources ?? []) {
        for (const clip of source?.clips ?? []) {
          add(clip.url);
        }
      }
    }
  }

  // sound-sources.json — [*].clips[*].url
  const soundSources = readJson(SOUND_SOURCES_PATH);
  if (Array.isArray(soundSources)) {
    for (const source of soundSources) {
      for (const clip of source?.clips ?? []) {
        add(clip.url);
      }
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Move all unreferenced non-portrait files from storage into a new timestamped
 * quarantine session folder.
 * @returns {{ moved: number }}
 */
export function purgeUnreferenced() {
  ensureDir(QUARANTINE_DIR);
  const refs  = buildReferencedSet();
  const files = listFiles(STORAGE_DIR);

  const targets = files.filter(name => !name.startsWith('portrait_') && !refs.has(name));
  if (targets.length === 0) return { moved: 0 };

  const sessionDir = createSessionDir();
  for (const name of targets) moveToDir(name, sessionDir);
  return { moved: targets.length };
}

/**
 * Move all portrait_* files from storage into a new timestamped quarantine session folder.
 * @returns {{ moved: number }}
 */
export function purgePortraits() {
  ensureDir(QUARANTINE_DIR);
  const files = listFiles(STORAGE_DIR).filter(n => n.startsWith('portrait_'));
  if (files.length === 0) return { moved: 0 };

  const sessionDir = createSessionDir();
  for (const name of files) moveToDir(name, sessionDir);
  return { moved: files.length };
}

/**
 * Permanently delete all timestamped session folders inside quarantine/.
 * @returns {{ deleted: number }}
 */
export function emptyTrash() {
  const total = countFilesRecursive(QUARANTINE_DIR);
  try {
    for (const name of fs.readdirSync(QUARANTINE_DIR)) {
      fs.rmSync(path.join(QUARANTINE_DIR, name), { recursive: true, force: true });
    }
  } catch {
    // quarantine dir absent — nothing to delete
  }
  return { deleted: total };
}

/**
 * Return counts of files currently in storage and quarantine (all sessions).
 * @returns {{ storageCount: number, quarantineCount: number }}
 */
export function getStats() {
  return {
    storageCount:    listFiles(STORAGE_DIR).length,
    quarantineCount: countFilesRecursive(QUARANTINE_DIR),
  };
}
