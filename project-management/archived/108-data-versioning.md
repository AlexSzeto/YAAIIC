# Data Versioning

## Goal

Establish a versioning system that tracks the schema version of each data file (config and database), and runs a chain of migration scripts automatically on server startup to bring data up to the version expected by the current server code. Migration scripts declare the version they accept and the version they produce, enabling multi-step chains. The server refuses to start if data is ahead of the expected version or if a migration chain cannot be resolved.

## Tasks

- [x] Add `BACKUP_DIR` constant to `server/core/paths.mjs` pointing at `scripts/migrate/backups/`.

- [x] Create `server/core/data-versions.mjs` defining the domain registry: a map of domain name → `{ currentVersion, filePath }` for each tracked data file. Initial expected version for all domains is `0` (no migrations exist yet; data files with no `"version"` field are treated as version 0). Tracked domains: `config` (`server/config.json`), `anytale-data`, `media-data`, `brew-data`, `sound-sources` (all in `server/database/`). Exclude `queue-data` (transient).

- [x] Create `server/core/migrator.mjs` exporting `migrateAll(config)`. For each registered domain:
  - Read the data file; parse `data.version` (default `0` if absent).
  - If `data.version > currentVersion`: throw a descriptive error asking the user to update the server to the latest version — **do not start**.
  - If `data.version === currentVersion`: no-op.
  - If `data.version < currentVersion`:
    - Write a timestamped backup to `BACKUP_DIR/<domain>-v<version>-<timestamp>.json` before touching the file.
    - Dynamically discover migration scripts from `scripts/migrate/<domain>/` matching the pattern `<N>-to-<M>.mjs`; import each and read its exported `fromVersion` and `toVersion`.
    - Build the shortest chain from `data.version` to `currentVersion`; throw if no complete chain exists.
    - Run each `migrate(data)` function in sequence; each returns the updated data object.
    - Write the final data (with `"version": currentVersion`) back to the file.
    - On any error during migration: restore the backup file and throw, preventing server startup.

- [x] Wire `migrateAll()` into `server/server.mjs`: call it after config is loaded but before any routes are mounted or the server begins listening.

- [x] Delete all existing numbered migration scripts (`scripts/migrate/1-*.mjs` through `scripts/migrate/11-*.mjs`). These are superseded by the new system; all historical migrations have already been applied to current data.

- [x] Add co-located tests for `migrator.mjs` in `server/core/migrator.test.mjs`. Cover: no-op when versions match, successful single-step migration, successful multi-step chain, error on downgrade (version too high), error when chain has a gap, backup creation before migration, backup restoration on migration failure.

- [x] Review and update affected living docs: `docs/architecture.md`, `docs/server.md`

## Implementation Details

### Domain registry shape

```js
// server/core/data-versions.mjs
import { CONFIG_PATH, DATABASE_DIR } from './paths.mjs';
import path from 'path';

export const DATA_DOMAINS = {
  config:        { currentVersion: 0, filePath: CONFIG_PATH },
  'anytale-data':  { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'anytale-data.json') },
  'media-data':    { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'media-data.json') },
  'brew-data':     { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'brew-data.json') },
  'sound-sources': { currentVersion: 0, filePath: path.join(DATABASE_DIR, 'sound-sources.json') },
};
```

When a future feature adds a migration for a domain, it bumps `currentVersion` here alongside the migration script.

### Migration script interface

```js
// scripts/migrate/<domain>/<N>-to-<M>.mjs
export const fromVersion = 0;
export const toVersion = 1;

/**
 * Transform data from fromVersion to toVersion.
 * @param {Object} data - Parsed JSON data (without "version" field modification needed)
 * @returns {Object} The migrated data object
 */
export function migrate(data) {
  // ... transform data ...
  return data;
}
```

The migrator writes `"version": toVersion` onto the returned object after each step — migration functions do not set `version` themselves.

### Chain resolution

Given `data.version = 1` and `currentVersion = 3`, the migrator looks for scripts forming the chain `1→2→3`. If only `0→1` and `1→2` exist (gap at `2→3`), it throws before touching any data. Chain resolution is a simple greedy walk: start at `data.version`, repeatedly find the script whose `fromVersion` equals the current step, advance to its `toVersion`, repeat until `currentVersion` is reached.

### Backup naming

```
scripts/migrate/backups/<domain>-v<version>-<timestamp>.json
```

Example: `anytale-data-v0-20260521T143200.json`. Timestamp uses `new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)`.

### Server startup integration

```js
// server/server.mjs (after loadConfig(), before app.listen())
import { migrateAll } from './core/migrator.mjs';

const config = loadConfig();
await migrateAll();   // throws and exits if any domain fails
```

### Version 0 baseline

All current data files have no `"version"` field. The migrator reads this as version `0`. Since all domains start at `currentVersion: 0`, the first server startup after this feature is deployed runs cleanly with no migrations. Future features that need schema changes: (1) add a migration script, (2) bump `currentVersion` in `data-versions.mjs`.

### Error messages

| Scenario | Message |
|---|---|
| Data version > expected | `"[<domain>] Data is at version <N> but server expects <M>. Please update the server to the latest version."` |
| Chain gap | `"[<domain>] No migration path found from version <N> to <M>. Missing script(s) in scripts/migrate/<domain>/"` |
| Migration throws | `"[<domain>] Migration from v<N> to v<M> failed: <error>. Original data restored from backup."` |
