/**
 * scaffold.mjs — Generate a clean project skeleton from YAAIIC's structure.
 *
 * Usage:
 *   node scripts/scaffold.mjs <outputFolder> [projectName]
 *
 * If projectName is omitted the folder basename is converted to Title Case
 * and the user is prompted to confirm or override it.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Za-z]:)/, '$1'); // strip leading slash on Windows

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(__dirname, 'scaffold-template');

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/**
 * Directories to copy recursively from the source project.
 * @type {{ src: string, dest: string, exclude?: string[] }[]}
 */
const DIR_COPIES = [
  { src: '.agents',             dest: '.agents' },
  { src: '.claude',             dest: '.claude' },
  { src: '.github',             dest: '.github' },
  { src: 'scripts',             dest: 'scripts', exclude: ['migrate'] },
  { src: 'public/js/custom-ui', dest: 'public/js/custom-ui' },
  { src: 'public/fonts',        dest: 'public/fonts' },
];

/**
 * Files to copy from scaffold-template/, optionally replacing placeholders.
 * @type {{ src: string, dest: string, replacements?: boolean }[]}
 */
const TEMPLATE_FILES = [
  { src: 'package.json',               dest: 'package.json',               replacements: true },
  { src: 'server/server.mjs',          dest: 'server/server.mjs' },
  { src: 'server/config.default.json', dest: 'server/config.default.json' },
  { src: 'server/core/paths.mjs',      dest: 'server/core/paths.mjs' },
  { src: 'server/core/config.mjs',     dest: 'server/core/config.mjs' },
  { src: 'server/core/index.mjs',      dest: 'server/core/index.mjs' },
  { src: 'public/index.html',          dest: 'public/index.html',          replacements: true },
  { src: 'public/js/app.mjs',          dest: 'public/js/app.mjs' },
  { src: 'public/js/util.mjs',         dest: 'public/js/util.mjs' },
];

/**
 * Empty directories to create (each gets a .gitkeep).
 * @type {string[]}
 */
const EMPTY_DIRS = [
  'docs/feature-history',
  'docs/groomed-features',
  'server/features',
  'server/database',
  'public/js/app-ui',
  'public/media',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a kebab-case string to Title Case.
 * e.g. "my-new-project" → "My New Project"
 */
function toTitleCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Prompt the user for input via readline.
 * @param {string} question
 * @returns {Promise<string>}
 */
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Recursively copy a directory, skipping any entry whose name is in `exclude`.
 * @param {string} src  Absolute source path
 * @param {string} dest Absolute destination path
 * @param {string[]} exclude Basenames to skip
 */
function copyDir(src, dest, exclude = []) {
  if (!fs.existsSync(src)) {
    console.warn(`  [skip] ${src} does not exist — skipping.`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const srcEntry  = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcEntry, destEntry, exclude);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

/**
 * Ensure a directory exists and place a .gitkeep file inside it.
 * @param {string} dir Absolute path
 */
function createEmptyDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  // fs.writeFileSync(path.join(dir, '.gitkeep'), '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/scaffold.mjs <outputFolder> [kebab-case-project-name]');
    process.exit(1);
  }

  const outputFolder = path.resolve(args[0]);
  const folderBasename = path.basename(outputFolder);

  // Derive package name (kebab-case basename)
  const packageName = folderBasename.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Derive or prompt for human-readable project name
  let projectName;
  if (args[1]) {
    projectName = args[1];
  } else {
    const derived = toTitleCase(folderBasename);
    const answer = await prompt(`Project name [${derived}]: `);
    projectName = answer || derived;
  }

  console.log();
  console.log(`Output folder : ${outputFolder}`);
  console.log(`Project name  : ${projectName}`);
  console.log(`Package name  : ${packageName}`);
  console.log();

  const replacements = {
    '{{PROJECT_NAME}}': projectName,
    '{{PACKAGE_NAME}}': packageName,
  };

  // 1. Create output directory
  fs.mkdirSync(outputFolder, { recursive: true });
  console.log('Creating directory structure...');

  // 2. Copy directories
  for (const { src, dest, exclude = [] } of DIR_COPIES) {
    const srcPath  = path.join(PROJECT_ROOT, src);
    const destPath = path.join(outputFolder, dest);
    console.log(`  copy dir  ${src}`);
    copyDir(srcPath, destPath, exclude);
  }

  // 3. Copy .gitignore
  const gitignoreSrc  = path.join(PROJECT_ROOT, '.gitignore');
  const gitignoreDest = path.join(outputFolder, '.gitignore');
  if (fs.existsSync(gitignoreSrc)) {
    console.log('  copy      .gitignore');
    fs.copyFileSync(gitignoreSrc, gitignoreDest);
  }

  // 4. Copy template files (with optional placeholder replacement)
  console.log('Copying template files...');
  for (const { src, dest, replacements: doReplace } of TEMPLATE_FILES) {
    const srcPath  = path.join(TEMPLATE_DIR, src);
    const destPath = path.join(outputFolder, dest);
    console.log(`  template  ${dest}`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    let content = fs.readFileSync(srcPath, 'utf8');
    if (doReplace) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        content = content.replaceAll(placeholder, value);
      }
    }
    fs.writeFileSync(destPath, content, 'utf8');
  }

  // 5. Create empty dirs with .gitkeep
  console.log('Creating empty directories...');
  for (const dir of EMPTY_DIRS) {
    const dirPath = path.join(outputFolder, dir);
    console.log(`  mkdir     ${dir}`);
    createEmptyDir(dirPath);
  }

  // ---------------------------------------------------------------------------
  // Success summary
  // ---------------------------------------------------------------------------
  console.log();
  console.log('✔  Scaffold complete!');
  console.log();
  console.log('Next steps:');
  console.log(`  cd ${outputFolder}`);
  console.log('  npm install');
  console.log('  node scripts/download-libs.mjs');
  console.log('  npm start');
  console.log();
  console.log(`Then open http://localhost:3000 in your browser.`);
}

main().catch(err => {
  console.error('Scaffold failed:', err);
  process.exit(1);
});
