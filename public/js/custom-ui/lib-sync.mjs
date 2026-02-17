/**
 * A single file application that synchronizes files between the current folder and a central, version controlled repository.
 * The application has two simple commands: push and pull.
 * 
 * push: Overwrites the central repository with the current directory content.
 *       It performs a MIRROR operation: files in current dir are copied to repo, and files in repo not in current dir are DELETED.
 * 
 * pull: Overwrites the current directory with the central repository content.
 *       It performs a MIRROR operation: files in repo are copied to current dir, and files in current dir not in repo are DELETED.
 *       WARNING: This is a hard reset of the local directory.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Robustly determine if this script is being executed directly
const currentFile = fileURLToPath(import.meta.url);
const executionFile = path.resolve(process.argv[1]);
const isMain = currentFile.toLowerCase() === executionFile.toLowerCase();

const __dirname = path.dirname(currentFile);
const CONFIG_FILE = 'config.json';

/**
 * Recursively get all files in a directory
 * @param {string} dir 
 * @param {string} baseDir 
 * @returns {Promise<string[]>} Array of relative paths
 */
async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await getAllFiles(fullPath, baseDir));
      } else {
        files.push(path.relative(baseDir, fullPath));
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return files;
}

/**
 * Mirror source directory to destination directory
 * @param {string} srcDir 
 * @param {string} destDir 
 * @param {boolean} selfUpdate - If true, allows overwriting the running script
 */
async function mirrorDir(srcDir, destDir) {
  console.log(`Mirroring ${srcDir} -> ${destDir}`);
  
  // Ensure dest exists
  await fs.mkdir(destDir, { recursive: true });

  const srcFiles = await getAllFiles(srcDir);
  const destFiles = await getAllFiles(destDir);

  // Copy/Update files from source
  for (const file of srcFiles) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    
    // Skip config.json to avoid overwriting configuration with default/repo version if desired?
    // Actually, user wants full sync. But config might contain local repo path.
    // If we pull config.json from repo, we might overwrite local repo path?
    // The requirement is "hard reset". So we should overwrite everything.
    
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
  }

  // Delete files in dest not in source
  for (const file of destFiles) {
    if (!srcFiles.includes(file)) {
      const destPath = path.join(destDir, file);
      try {
        await fs.unlink(destPath);
        console.log(`Deleted: ${file}`);
      } catch (err) {
        console.error(`Failed to delete ${file}:`, err.message);
      }
    }
  }
  
  console.log('Mirror complete.');
}

async function loadConfig() {
  const configPath = path.join(__dirname, CONFIG_FILE);
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error: config.json not found in lib-sync directory.');
    process.exit(1);
  }
}

async function push() {
  const config = await loadConfig();
  const repoPath = path.resolve(config.centralRepo);
  
  console.log('Pushing to central repository...');
  await mirrorDir(__dirname, repoPath);
}

async function pull() {
  const config = await loadConfig();
  const repoPath = path.resolve(config.centralRepo);
  
  console.log('Pulling from central repository (Hard Reset)...');
  await mirrorDir(repoPath, __dirname);
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'push':
      await push();
      break;
    case 'pull':
      await pull();
      break;
    default:
      console.log('Usage: node lib-sync.mjs [push|pull]');
      console.log('  push - Mirror current folder TO central repo');
      console.log('  pull - Mirror central repo TO current folder (Hard Reset)');
      process.exit(1);
  }
}

if (isMain) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}