/**
 * A single file application that synchronizes files between multiple on device folders and a central, version controlled repository.
 * The application has two simple commands: init and sync.
 * 
 * init: Initializes the application by creating a configuration file and a central repository. config.json is read and all files in
 * the folder, including the config file and this file, are copied to the central repository.
 * 
 * sync: Synchronizes the on device folders with the central repository. On launch, the application will mirror all files from the central
 * repository to the on device folders, updating and deleting files as necessary. Thereafter, the application will monitor the current folder
 * for changes and update the central repository immediately whenever a change is detected.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = 'config.json';
const DEFAULT_CONFIG = {
  centralRepo: './central-repo',
  syncFolders: []
};

/**
 * Recursively copy all files from source to destination
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
async function copyRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Get all files recursively from a directory
 * @param {string} dir - Directory to scan
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Promise<string[]>} Array of relative file paths
 */
async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  
  return files;
}

/**
 * Initialize the sync system
 */
async function init() {
  console.log('Initializing lib-sync...');
  
  // Check if config exists - REQUIRED
  const configPath = path.join(__dirname, CONFIG_FILE);
  let config;
  
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configData);
    console.log('Found existing config.json');
  } catch (err) {
    console.error('Error: config.json not found in lib-sync.mjs directory.');
    console.error('Please create config.json in the same folder as lib-sync.mjs');
    process.exit(1);
  }
  
  // Create central repository
  const repoPath = path.resolve(config.centralRepo);
  await fs.mkdir(repoPath, { recursive: true });
  console.log(`Central repository created at: ${repoPath}`);
  
  // Copy all files from lib-sync.mjs directory to central repository
  console.log('Copying files to central repository...');
  await copyRecursive(__dirname, repoPath);
  
  console.log('Initialization complete!');
}

/**
 * Sync a file from central repo to all sync folders
 * @param {string} relativePath - Relative path of the file
 * @param {object} config - Configuration object
 */
async function syncFileToFolders(relativePath, config) {
  const centralPath = path.join(path.resolve(config.centralRepo), relativePath);
  
  for (const folder of config.syncFolders) {
    const destPath = path.join(path.resolve(folder), relativePath);
    
    try {
      // Create directory if needed
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy file
      await fs.copyFile(centralPath, destPath);
      console.log(`Synced: ${relativePath} -> ${folder}`);
    } catch (err) {
      console.error(`Error syncing ${relativePath} to ${folder}:`, err.message);
    }
  }
}

/**
 * Delete a file from all sync folders
 * @param {string} relativePath - Relative path of the file
 * @param {object} config - Configuration object
 */
async function deleteFileFromFolders(relativePath, config) {
  for (const folder of config.syncFolders) {
    const destPath = path.join(path.resolve(folder), relativePath);
    
    try {
      await fs.unlink(destPath);
      console.log(`Deleted: ${relativePath} from ${folder}`);
    } catch (err) {
      // Ignore if file doesn't exist
      if (err.code !== 'ENOENT') {
        console.error(`Error deleting ${relativePath} from ${folder}:`, err.message);
      }
    }
  }
}

/**
 * Mirror central repository to all sync folders
 * @param {object} config - Configuration object
 */
async function mirrorToFolders(config) {
  console.log('Mirroring central repository to sync folders...');
  
  const repoPath = path.resolve(config.centralRepo);
  const repoFiles = await getAllFiles(repoPath);
  
  for (const folder of config.syncFolders) {
    const folderPath = path.resolve(folder);
    console.log(`Syncing to: ${folderPath}`);
    
    // Get existing files in folder
    let existingFiles = [];
    try {
      existingFiles = await getAllFiles(folderPath);
    } catch (err) {
      // Folder might not exist yet
      await fs.mkdir(folderPath, { recursive: true });
    }
    
    // Copy all files from repo
    for (const file of repoFiles) {
      const srcPath = path.join(repoPath, file);
      const destPath = path.join(folderPath, file);
      
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
    }
    
    // Delete files that don't exist in repo
    for (const file of existingFiles) {
      if (!repoFiles.includes(file)) {
        const destPath = path.join(folderPath, file);
        await fs.unlink(destPath);
        console.log(`Deleted obsolete file: ${file}`);
      }
    }
  }
  
  console.log('Mirror complete!');
}

/**
 * Watch current folder and sync changes to central repository
 * @param {object} config - Configuration object
 */
async function watchAndSync(config) {
  const baseDir = __dirname;
  const repoPath = path.resolve(config.centralRepo);
  
  console.log(`Watching ${baseDir} for changes...`);
  console.log('Press Ctrl+C to stop.');
  
  const watcher = fsSync.watch(baseDir, { recursive: true }, async (eventType, filename) => {
    if (!filename) return;
    
    // Ignore changes in the central repo itself
    const fullPath = path.join(baseDir, filename);
    if (fullPath.startsWith(repoPath)) return;
    
    const srcPath = path.join(baseDir, filename);
    const destPath = path.join(repoPath, filename);
    
    try {
      // Check if file exists
      const exists = await fs.access(srcPath).then(() => true).catch(() => false);
      
      if (exists) {
        // File created or modified
        const stats = await fs.stat(srcPath);
        if (stats.isFile()) {
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(srcPath, destPath);
          console.log(`Updated in central repo: ${filename}`);
        }
      } else {
        // File deleted
        try {
          await fs.unlink(destPath);
          console.log(`Deleted from central repo: ${filename}`);
        } catch (err) {
          // Ignore if file doesn't exist
        }
      }
    } catch (err) {
      console.error(`Error syncing ${filename}:`, err.message);
    }
  });
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nStopping file watcher...');
    watcher.close();
    process.exit(0);
  });
}

/**
 * Sync command - mirror repo to folders and watch for changes
 */
async function sync() {
  console.log('Starting sync...');
  
  // Load config - REQUIRED
  const configPath = path.join(__dirname, CONFIG_FILE);
  let config;
  
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configData);
  } catch (err) {
    console.error('Error: config.json not found in lib-sync.mjs directory.');
    console.error('Please create config.json in the same folder as lib-sync.mjs');
    process.exit(1);
  }
  
  // Check if central repo exists
  const repoPath = path.resolve(config.centralRepo);
  try {
    await fs.access(repoPath);
  } catch (err) {
    console.error('Error: Central repository not found. Run "init" first.');
    process.exit(1);
  }
  
  // Mirror to all sync folders
  await mirrorToFolders(config);
  
  // Watch for changes
  await watchAndSync(config);
}

/**
 * Main entry point
 */
async function main() {
  console.log('lib-sync v1.0.0');
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      await init();
      break;
    case 'sync':
      await sync();
      break;
    default:
      console.log('Usage: node lib-sync.mjs [init|sync]');
      console.log('  init - Initialize the sync system');
      console.log('  sync - Sync files between folders and watch for changes');
      process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1]}`.replace(/\\/g, '/')) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}