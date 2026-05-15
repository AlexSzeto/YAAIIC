/**
 * Migration: 8-anytale-uid-to-uuid.mjs
 *
 * Replaces all user-defined string UIDs in anytale-data.json with
 * randomly-generated UUIDs, keeping all cross-references consistent.
 *
 * Entities migrated:
 *   - parts:      part.uid → new UUID
 *   - characters: character.uid → new UUID
 *                 character.parts[].partUid → mapped via parts table
 *                 character.preferredOutfits[] → mapped via outfits table
 *   - outfits:    outfit.uid → new UUID
 *                 outfit.parts[].partUid → mapped via parts table
 *   - plot:       plot[].uid → new UUID
 *
 * A timestamped backup is created before any changes are written.
 *
 * Run with: node scripts/migrate/8-anytale-uid-to-uuid.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

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
// Build UID → UUID mapping tables (before mutating anything)
// ---------------------------------------------------------------------------

/** @type {Map<string, string>} old part uid → new UUID */
const partsMap = new Map();
for (const part of (data.parts ?? [])) {
  if (part.uid) {
    partsMap.set(part.uid, randomUUID());
  }
}

/** @type {Map<string, string>} old character uid → new UUID */
const charactersMap = new Map();
for (const character of (data.characters ?? [])) {
  if (character.uid) {
    charactersMap.set(character.uid, randomUUID());
  }
}

/** @type {Map<string, string>} old outfit uid → new UUID */
const outfitsMap = new Map();
for (const outfit of (data.outfits ?? [])) {
  if (outfit.uid) {
    outfitsMap.set(outfit.uid, randomUUID());
  }
}

/** @type {Map<string, string>} old plot uid → new UUID */
const plotMap = new Map();
for (const entry of (data.plot ?? [])) {
  if (entry.uid) {
    plotMap.set(entry.uid, randomUUID());
  }
}

console.log(`Parts to migrate:     ${partsMap.size}`);
console.log(`Characters to migrate: ${charactersMap.size}`);
console.log(`Outfits to migrate:   ${outfitsMap.size}`);
console.log(`Plot entries to migrate: ${plotMap.size}`);

// ---------------------------------------------------------------------------
// Apply mappings
// ---------------------------------------------------------------------------

// Parts: replace uid
for (const part of (data.parts ?? [])) {
  const newUid = partsMap.get(part.uid);
  if (newUid) {
    part.uid = newUid;
  }
}

// Characters: replace uid, partUids, and preferredOutfits
for (const character of (data.characters ?? [])) {
  const newUid = charactersMap.get(character.uid);
  if (newUid) {
    character.uid = newUid;
  }

  for (const partRef of (character.parts ?? [])) {
    const newPartUid = partsMap.get(partRef.partUid);
    if (newPartUid) {
      partRef.partUid = newPartUid;
    } else if (partRef.partUid) {
      console.warn(`  [character ${character.uid}] unknown partUid: "${partRef.partUid}"`);
    }
  }

  if (Array.isArray(character.preferredOutfits)) {
    character.preferredOutfits = character.preferredOutfits.map(oldOutfitUid => {
      const newOutfitUid = outfitsMap.get(oldOutfitUid);
      if (!newOutfitUid) {
        console.warn(`  [character ${character.uid}] unknown preferredOutfit uid: "${oldOutfitUid}"`);
        return oldOutfitUid;
      }
      return newOutfitUid;
    });
  }
}

// Outfits: replace uid and partUids
for (const outfit of (data.outfits ?? [])) {
  const newUid = outfitsMap.get(outfit.uid);
  if (newUid) {
    outfit.uid = newUid;
  }

  for (const partRef of (outfit.parts ?? [])) {
    const newPartUid = partsMap.get(partRef.partUid);
    if (newPartUid) {
      partRef.partUid = newPartUid;
    } else if (partRef.partUid) {
      console.warn(`  [outfit ${outfit.uid}] unknown partUid: "${partRef.partUid}"`);
    }
  }
}

// Plot: replace uid only (plot entries do not reference parts/characters/outfits by UID)
for (const entry of (data.plot ?? [])) {
  const newUid = plotMap.get(entry.uid);
  if (newUid) {
    entry.uid = newUid;
  }
}

// ---------------------------------------------------------------------------
// Write updated data
// ---------------------------------------------------------------------------
fs.writeFileSync(ANYTALE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`\nMigration complete. Updated file written to: ${ANYTALE_DATA_PATH}`);
console.log(`Original data backed up to: ${backupPath}`);
