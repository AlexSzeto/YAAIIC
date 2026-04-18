# Library Management

YAAIIC uses a two-part system for managing frontend dependencies: **Library Download** for fetching external packages from CDNs, and **Library Sync** for sharing the custom-ui component library across projects.

## Table of Contents

- [Library Download](#library-download)
- [Library Sync](#library-sync)

---

## Library Download

**Script**: `scripts/download-libs.mjs`  
**Config**: `scripts/lib.config.json`

Downloads external JavaScript libraries and Google Fonts to local directories, eliminating CDN dependencies at runtime.

### Usage

```bash
node scripts/download-libs.mjs
```

### What It Does

1. **Downloads JavaScript libraries** from CDN URLs (primarily esm.sh) to `public/lib/`.
2. **Resolves esm.sh shims** — detects re-export wrapper modules and follows redirects to actual bundles.
3. **Downloads Google Fonts** in woff2 format to `public/fonts/` and generates a local `public/css/fonts.css`.
4. **Prints HTML snippets** — outputs importmap and script tag snippets to paste into `index.html`.

### Configuration (`lib.config.json`)

The configuration file has two sections:

#### Libraries

Each library entry specifies:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | CDN URL (typically esm.sh) |
| `outputPath` | string | Local path relative to `public/lib/` |
| `type` | string | `"importmap"` (ES module) or `"script"` (classic script tag) |

```json
{
  "libraries": [
    {
      "url": "https://esm.sh/preact@10.19.2",
      "outputPath": "preact/preact.js",
      "type": "importmap"
    },
    {
      "url": "https://esm.sh/@tarekraafat/autocomplete.js@10.2.7",
      "outputPath": "autocomplete/autoComplete.min.js",
      "type": "script"
    }
  ]
}
```

#### Fonts

Each font entry specifies:

| Field | Type | Description |
|-------|------|-------------|
| `family` | string | Google Fonts family name |
| `axes` | string | Variable font axes string |
| `display` | string | `font-display` CSS value (`"swap"` or `"block"`) |

```json
{
  "fonts": [
    {
      "family": "Figtree",
      "axes": "ital,wght@0,300..900;1,300..900",
      "display": "swap"
    },
    {
      "family": "Material Symbols Outlined",
      "axes": "opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200",
      "display": "block"
    }
  ]
}
```

### Current Libraries

| Package | Version | Output Path | Type |
|---------|---------|------------|------|
| preact | 10.19.2 | `preact/preact.js` | importmap |
| preact/hooks | 10.19.2 | `preact/hooks.js` | importmap |
| preact/compat | 10.19.2 | `preact/compat.js` | importmap |
| @preact/signals | 1.2.2 | `preact/signals.js` | importmap |
| htm/preact | 3.1.1 | `htm/preact.js` | importmap |
| goober | 2.1.13 | `goober/goober.js` | importmap |
| goober/prefixer | 2.1.13 | `goober/prefixer.js` | importmap |
| autocomplete.js | 10.2.7 | `autocomplete/autoComplete.min.js` | script |
| boxicons | latest | `boxicons/boxicons.js` | script |
| favloader | latest | `favloader/favloader.js` | script |

---

## Library Sync

**Script**: `public/js/custom-ui/lib-sync.mjs`  
**Config**: `public/js/custom-ui/config.json`

Bidirectional file synchronization tool for sharing the `custom-ui` component library with a central repository. This allows multiple projects (YAAIIC, AmbientCafe, AmbientBridge, UIBuilder, etc.) to share and update the same design system.

### Usage

```bash
# Copy local custom-ui to central repository (overwrite)
npm run push

# Copy central repository to local custom-ui (hard reset)
npm run pull
```

These are aliased in `package.json`:
```json
{
  "scripts": {
    "pull": "node public/js/custom-ui/lib-sync.mjs pull",
    "push": "node public/js/custom-ui/lib-sync.mjs push"
  }
}
```

### Configuration (`config.json`)

```json
{
  "centralRepo": "F:\\CustomUI\\custom-ui\\"
}
```

The `centralRepo` path points to the shared directory that acts as the source of truth.

### Commands

#### `push`

Mirrors the local `public/js/custom-ui/` directory to the central repository:
- Copies all local files to the repository.
- Deletes files in the repository that don't exist locally.
- Effectively makes the central repo an exact copy of the local directory.

#### `pull`

Mirrors the central repository to the local `public/js/custom-ui/` directory:
- Copies all repository files to the local directory.
- Deletes local files that don't exist in the repository.
- Effectively hard-resets the local custom-ui to match the central repo.

### How It Works

1. Recursively scans both source and destination directories.
2. Computes the set of files in each.
3. Copies all source files to destination (overwriting existing).
4. Deletes any destination files not present in source.

### Workflow

1. Make component changes in any project.
2. Run `npm run push` to publish changes to the central repo.
3. In other projects, run `npm run pull` to receive the updates.

> **Warning**: Both `push` and `pull` are destructive — they overwrite the target directory entirely. There is no merge or conflict resolution.
