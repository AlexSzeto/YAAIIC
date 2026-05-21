#!/usr/bin/env node
/**
 * Usage: node scripts/archive-feature.mjs <filename>
 *
 * Moves project-management/in-progress/<filename> to
 * project-management/archived/<next-number>-<filename>,
 * where <next-number> is one more than the highest existing archive number.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN_PROGRESS_DIR = path.join(ROOT, 'project-management', 'in-progress');
const ARCHIVED_DIR = path.join(ROOT, 'project-management', 'archived');

const filename = process.argv[2];

if (!filename) {
  console.error('Usage: node scripts/archive-feature.mjs <filename>');
  process.exit(1);
}

const sourcePath = path.join(IN_PROGRESS_DIR, filename);

if (!fs.existsSync(sourcePath)) {
  console.error(`Not found: ${sourcePath}`);
  process.exit(1);
}

const existing = fs.readdirSync(ARCHIVED_DIR);
const highest = existing.reduce((max, name) => {
  const m = name.match(/^(\d+)/);
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);

const nextNumber = highest + 1;
const destName = `${nextNumber}-${filename}`;
const destPath = path.join(ARCHIVED_DIR, destName);

fs.copyFileSync(sourcePath, destPath);
fs.unlinkSync(sourcePath);

console.log(`Archived as project-management/archived/${destName}`);
