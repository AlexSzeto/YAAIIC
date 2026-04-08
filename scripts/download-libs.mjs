/**
 * Downloads external libraries defined in public/lib/lib.config.json
 * to local paths under public/lib/.
 *
 * Also downloads Google Fonts defined in the "fonts" config section,
 * saving .woff2 files locally and generating a CSS file.
 *
 * For esm.sh URLs, follows the re-export shim to download the actual bundle.
 *
 * Usage: node scripts/download-libs.mjs
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const LIB_DIR = path.join(PUBLIC_DIR, 'lib');
const CONFIG_PATH = path.join(__dirname, 'lib.config.json');
const FONTS_DIR = path.join(PUBLIC_DIR, 'fonts');
const FONTS_CSS_PATH = path.join(PUBLIC_DIR, 'css', 'fonts.css');

// Modern browser UA to request woff2 format from Google Fonts
const WOFF2_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Follow HTTP redirects and download a URL to a Buffer.
 * @param {string} url
 * @param {number} maxRedirects
 * @param {Record<string,string>} [headers]
 * @returns {Promise<Buffer>}
 */
function download(url, maxRedirects = 10, headers = {}) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers
    };

    client.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        return resolve(download(next, maxRedirects - 1, headers));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * esm.sh returns a small shim file with `export * from "/pkg@ver/..."` lines.
 * This function parses the shim and returns the resolved CDN URLs for the
 * actual bundle files if such redirects are found.
 *
 * @param {string} content - The downloaded shim content
 * @param {string} originUrl - The original URL used to resolve relative paths
 * @returns {string[]} Array of absolute URLs to the actual bundle(s), or empty if not a shim
 */
function parseEsmShimRedirects(content, originUrl) {
  const origin = new URL(originUrl).origin;
  const paths = [];

  // Match: export * from "/path" or import "/path" or export { ... } from "/path"
  const re = /(?:export\s+\*\s+from|import|export\s+\{[^}]*\}\s+from)\s+["'](\/[^"']+)["']/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    paths.push(origin + match[1]);
  }

  return paths;
}

/**
 * Download a library. For esm.sh, detects shims and follows to the real bundle.
 * Concatenates multiple re-exported modules into a single file.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function downloadResolved(url) {
  // Automatically request bundled version for esm.sh to avoid relative chunk imports (e.g., htm.mjs)
  let fetchUrl = url;
  if (fetchUrl.includes('esm.sh') && !fetchUrl.includes('bundle')) {
    fetchUrl += fetchUrl.includes('?') ? '&bundle' : '?bundle';
  }

  const data = await download(fetchUrl);
  const text = data.toString('utf-8');

  // Only process esm.sh shims (small files with re-export patterns)
  if (data.length < 500 && fetchUrl.includes('esm.sh')) {
    const redirectUrls = [...new Set(parseEsmShimRedirects(text, fetchUrl))];
    if (redirectUrls.length > 0) {
      console.log(`    (shim detected, following ${redirectUrls.length} unique redirect(s))`);
      const parts = [];
      for (const redirectUrl of redirectUrls) {
        // Also ensure the redirected URL is bundled
        let finalRedirectUrl = redirectUrl;
        if (!finalRedirectUrl.includes('bundle')) {
          finalRedirectUrl += finalRedirectUrl.includes('?') ? '&bundle' : '?bundle';
        }
        const resolved = await download(finalRedirectUrl);
        parts.push(resolved);
      }
      return Buffer.concat(parts);
    }
  }

  return data;
}

/* ------------------------------------------------------------------ */
/*  Google Fonts download                                              */
/* ------------------------------------------------------------------ */

/**
 * Build the Google Fonts CSS2 API URL for a font config entry.
 * @param {{ family: string, specs: string, display?: string }} font
 * @returns {string}
 */
function buildGoogleFontsUrl(font) {
  const family = `${font.family}:${font.specs}`;
  const display = font.display || 'swap';
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=${display}`;
}

/**
 * Derive a short, filesystem-safe filename from a Google Fonts file URL.
 * e.g.  https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzq...Bs_chQF5e.woff2
 *   =>  "_Xmz-HUzq...Bs_chQF5e.woff2"
 * @param {string} url
 * @returns {string}
 */
function fontFileBasename(url) {
  return path.posix.basename(new URL(url).pathname);
}

/**
 * Download all Google Fonts defined in the config and generate a local CSS file.
 * @param {{ family: string, specs: string, display?: string }[]} fonts
 * @returns {Promise<number>} number of failures
 */
async function downloadFonts(fonts) {
  if (!fonts || fonts.length === 0) return 0;

  console.log(`\nDownloading ${fonts.length} font(s)...\n`);

  let failed = 0;
  const allCssBlocks = [];

  for (const font of fonts) {
    const familyDir = font.family.toLowerCase().replace(/\s+/g, '-');
    const localFontDir = path.join(FONTS_DIR, familyDir);
    fs.mkdirSync(localFontDir, { recursive: true });

    const cssUrl = buildGoogleFontsUrl(font);
    console.log(`  ${font.family}`);
    console.log(`    CSS: ${cssUrl}`);

    let cssText;
    try {
      const cssBuf = await download(cssUrl, 10, { 'User-Agent': WOFF2_USER_AGENT });
      cssText = cssBuf.toString('utf-8');
    } catch (err) {
      console.error(`    FAILED to fetch CSS: ${err.message}\n`);
      failed++;
      continue;
    }

    // Extract all remote font-file URLs from the CSS
    const urlRe = /url\(([^)]+)\)/g;
    let urlMatch;
    const urlMap = new Map(); // remoteUrl -> localBasename

    while ((urlMatch = urlRe.exec(cssText)) !== null) {
      const remoteUrl = urlMatch[1];
      if (!urlMap.has(remoteUrl)) {
        urlMap.set(remoteUrl, fontFileBasename(remoteUrl));
      }
    }

    // Download each font file
    let fileCount = 0;
    for (const [remoteUrl, basename] of urlMap) {
      const destPath = path.join(localFontDir, basename);
      try {
        const data = await download(remoteUrl);
        fs.writeFileSync(destPath, data);
        fileCount++;
      } catch (err) {
        console.error(`    FAILED to download ${basename}: ${err.message}`);
        failed++;
      }
    }

    // Rewrite CSS URLs to local paths
    let localCss = cssText;
    for (const [remoteUrl, basename] of urlMap) {
      localCss = localCss.replaceAll(remoteUrl, `/fonts/${familyDir}/${basename}`);
    }

    allCssBlocks.push(localCss.trim());
    console.log(`    OK (${fileCount} file(s) downloaded)\n`);
  }

  // Write combined CSS
  if (allCssBlocks.length > 0) {
    const cssDir = path.dirname(FONTS_CSS_PATH);
    fs.mkdirSync(cssDir, { recursive: true });
    fs.writeFileSync(FONTS_CSS_PATH, allCssBlocks.join('\n\n') + '\n', 'utf-8');
    console.log(`  Generated ${path.relative(ROOT_DIR, FONTS_CSS_PATH)}\n`);
  }

  return failed;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: lib.config.json not found at', CONFIG_PATH);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const libs = config.libraries || [];
  const fonts = config.fonts || [];

  let failed = 0;

  // --- Libraries ---
  if (libs.length > 0) {
    console.log(`Downloading ${libs.length} libraries...\n`);

    for (const lib of libs) {
      const destPath = path.join(LIB_DIR, lib.path);
      const destDir = path.dirname(destPath);

      fs.mkdirSync(destDir, { recursive: true });

      try {
        console.log(`  ${lib.url}`);
        console.log(`    -> ${lib.path}`);
        const data = await downloadResolved(lib.url);
        fs.writeFileSync(destPath, data);
        console.log(`    OK (${data.length} bytes)\n`);
      } catch (err) {
        console.error(`    FAILED: ${err.message}\n`);
        failed++;
      }
    }
  }

  // --- Fonts ---
  failed += await downloadFonts(fonts);

  if (failed > 0) {
    console.error(`\n${failed} download(s) failed.`);
    process.exit(1);
  }

  // --- HTML Snippet Generation ---
  // Generate code snippet to replace CDN imports in index.html
  console.log('\n================ START SNIPPET ================');
  console.log('<!-- Replace CDN imports in your public/index.html with: -->');

  if (fonts.length > 0) {
    console.log('\n    <!-- Local Fonts -->');
    console.log('    <link rel="stylesheet" href="/css/fonts.css">');
  }

  // Helper to guess injection type if not provided
  function getInjection(lib) {
    if (lib.injectAs) return { type: lib.injectAs, key: lib.importMapKey };
    if (lib.url.includes('esm.sh')) {
      let key = new URL(lib.url).pathname.replace(/^\//, ''); // remove leading slash
      key = key.replace(/@[^/]+/, ''); // remove version string @...
      return { type: 'importmap', key };
    }
    return { type: 'script' };
  }

  const importmapLibs = [];
  const scriptLibs = [];
  
  for (const lib of libs) {
    const inj = getInjection(lib);
    if (inj.type === 'importmap') importmapLibs.push({ ...lib, key: inj.key });
    else scriptLibs.push(lib);
  }

  if (importmapLibs.length > 0) {
    console.log('\n    <!-- Local Imports -->');
    console.log('    <script type="importmap">');
    console.log('      {');
    console.log('        "imports": {');
    importmapLibs.forEach((l, i) => {
      const comma = i === importmapLibs.length - 1 ? '' : ',';
      console.log(`          "${l.key}": "/lib/${l.path}"${comma}`);
    });
    console.log('        }');
    console.log('      }');
    console.log('    </script>');
  }

  if (scriptLibs.length > 0) {
    console.log('\n    <!-- Local Scripts -->');
    for (const l of scriptLibs) {
      console.log(`    <script src="/lib/${l.path}"></script>`);
    }
  }
  console.log('================= END SNIPPET =================\n');

  console.log('Done.');
  process.exit(0);
}

main();
