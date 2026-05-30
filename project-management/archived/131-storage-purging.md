# Storage Purging

## Goal

Scan `server/storage/`, identify files not referenced by any database record, and move them to `server/quarantine/` as a safe recycle bin. A separate endpoint targets hash-indexed portrait files. A minimal config page exposes the purge actions from the hamburger menu.

## Tasks

### Phase 1 — Server service and routes

- [x] Add `QUARANTINE_DIR = path.join(SERVER_DIR, '..', 'quarantine')` to `server/core/paths.mjs`
- [x] Create `server/features/storage/service.mjs` with:
  - `buildReferencedSet()` — walks all four databases and returns a `Set<string>` of referenced basenames (strip `/media/` prefix and any `?...` query string)
  - `purgeUnreferenced()` — ensures quarantine dir exists, lists `STORAGE_DIR`, moves every non-`portrait_*` file absent from the referenced set to `QUARANTINE_DIR`; returns `{ moved: number }`
  - `purgePortraits()` — moves all `portrait_*` files from `STORAGE_DIR` to `QUARANTINE_DIR`; returns `{ moved: number }`
  - `emptyTrash()` — permanently deletes every file in `QUARANTINE_DIR`; returns `{ deleted: number }`
  - `getStats()` — returns `{ storageCount, quarantineCount }`
- [x] Create `server/features/storage/router.mjs` with routes:
  - `GET  /admin/storage/stats`
  - `POST /admin/storage/purge`
  - `POST /admin/storage/purge-portraits`
  - `POST /admin/storage/empty-trash`
- [x] Mount storage router in `server/server.mjs`
- [x] Write `server/features/storage/router.test.mjs` covering happy paths for all four endpoints

### Phase 2 — Config UI page

- [x] Create `public/config.html` (same HTML shell pattern as `anytale.html`) with entry point `public/js/config.mjs`
- [x] Create `public/js/config.mjs` wrapping the app in `Page` + `ToastProvider`
- [x] Create `public/js/app-ui/config-app.mjs` with:
  - A header using `AppHeader` + `HamburgerMenu` + `H1` title "Configuration"
  - Two `Button` components: "Purge Unreferenced Files" (calls `POST /admin/storage/purge`) and "Purge Portrait Cache" (calls `POST /admin/storage/purge-portraits`)
  - Success/error feedback via `useToast`; toast message includes the count returned by the endpoint
- [x] Register "Config" in `public/js/app-ui/hamburger-menu.mjs` pointing to `/config.html`
- [x] Review and update affected living docs: `docs/server.md`, `docs/scaffolding.md`

#### Fixes and Changes
- [x] Add `server/quarantine/` to `.gitignore`
- [x] Fix config-app header order (H1 left, HamburgerMenu right) and replace single-use styled wrappers with Panel and VerticalLayout
- [x] Change quarantine to use timestamped subfolders per purge session (`quarantine/[timestamp]/`) to eliminate filename collision
- [x] Add `anytale.genres[*].tracks[*].audioUrl` to `buildReferencedSet` so AnyTale music files are protected from purge

## Implementation Details

### Database reference fields

| Database | Fields to collect |
|---|---|
| `media-data.json` | `mediaData[*].imageUrl`, `mediaData[*].audioUrl` |
| `anytale-data.json` | `characters[*].portraitUrl`, `characters[*].audioUrl`, `characters[*].parts[*].previewImageUrl`, `outfits[*].renderUrl`, `outfits[*].parts[*].previewImageUrl`, `sfx[*].audioUrl`, `genres[*].tracks[*].audioUrl` |
| `brew-data.json` | `[*].data.sources[*].clips[*].url` |
| `sound-sources.json` | `[*].clips[*].url` |

URL normalisation before adding to the Set:
```js
function urlToBasename(url) {
  if (!url) return null;
  return url.replace(/^\/media\//, '').split('?')[0];
}
```

### Purge logic

- `purgeUnreferenced`: skip files whose name starts with `portrait_`; also skip any file that is a directory.
- `purgePortraits`: move all files matching `/^portrait_/` from `STORAGE_DIR` to `QUARANTINE_DIR`.
- Both move functions: if a file with the same name already exists in quarantine, overwrite it.
- `emptyTrash`: `fs.rm` each file in `QUARANTINE_DIR`; directories are ignored.

### Quarantine path

`server/quarantine/` — sibling to `server/storage/`. Created on first purge if absent.

### Router test strategy

Use `vi.mock` on `../storage/service.mjs` to isolate route logic. Each test asserts HTTP status and JSON shape; does not touch the filesystem.
