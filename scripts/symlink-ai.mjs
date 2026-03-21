#!/usr/bin/env node
import { symlinkSync, existsSync, mkdirSync, unlinkSync, lstatSync } from 'fs';
import { dirname, resolve, relative } from 'path';
import { platform } from 'os';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = platform() === 'win32';

const links = [
  { src: '.github/prompts', dest: '.claude/commands' },
  { src: '.github/prompts', dest: '.agents/workflows' },
  { src: '.github/rules.md', dest: '.claude/rules/rules.md' },
];

let failed = false;

for (const { src, dest } of links) {
  const srcAbs = resolve(ROOT, src);
  const destAbs = resolve(ROOT, dest);
  const destDir = dirname(destAbs);

  if (!existsSync(srcAbs)) {
    console.error(`  skip: source not found: ${src}`);
    failed = true;
    continue;
  }

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const existing = lstatSync(destAbs, { throwIfNoEntry: false });
  if (existing) {
    if (existing.isSymbolicLink()) {
      unlinkSync(destAbs);
    } else {
      console.error(`  skip: ${dest} already exists and is not a symlink — remove it manually`);
      failed = true;
      continue;
    }
  }

  // Windows directories use junctions (no admin rights needed); files use 'file' type.
  // Unix uses relative paths for portability.
  let target, type;
  if (isWindows) {
    const srcStat = lstatSync(srcAbs);
    type = srcStat.isDirectory() ? 'junction' : 'file';
    target = srcAbs; // junctions require absolute paths
  } else {
    target = relative(destDir, srcAbs);
    type = undefined; // inferred from target on Unix
  }

  try {
    symlinkSync(target, destAbs, type);
    console.log(`  linked: ${dest} -> ${src}`);
  } catch (err) {
    if (err.code === 'EPERM' && isWindows) {
      console.error(
        `  error: permission denied creating symlink for ${dest}\n` +
        `         On Windows, either run as Administrator or enable Developer Mode\n` +
        `         (Settings > Privacy & Security > For developers)`
      );
    } else {
      console.error(`  error: ${dest}: ${err.message}`);
    }
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
