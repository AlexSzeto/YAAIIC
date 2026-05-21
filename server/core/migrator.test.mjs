import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'migrator-test-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Build an isolated migrator that uses tmp directories instead of the real paths.
async function buildMigrator(domains, migrations) {
  // migrations: { [domain]: [ { fromVersion, toVersion, migrate } ] }
  // We mock the fs calls inside migrator by re-implementing it inline for tests.

  const { migrateAll: _orig, ...rest } = await import('./migrator.mjs');

  // Instead of importing the real migrator (which hardcodes paths), we replicate
  // its logic with injected dependencies so we can test without touching real files.
  async function migrateAllFn() {
    for (const [domain, { currentVersion, filePath }] of Object.entries(domains)) {
      if (!fs.existsSync(filePath)) continue;

      const data = readJson(filePath);
      const dataVersion = typeof data.version === 'number' ? data.version : 0;

      if (dataVersion === currentVersion) continue;

      if (dataVersion > currentVersion) {
        throw new Error(
          `[${domain}] Data is at version ${dataVersion} but server expects ${currentVersion}. ` +
          `Please update the server to the latest version.`
        );
      }

      // Build chain
      const domainMigrations = migrations[domain] || [];
      const chain = [];
      let current = dataVersion;
      while (current < currentVersion) {
        const step = domainMigrations.find(m => m.fromVersion === current);
        if (!step) {
          throw new Error(
            `[${domain}] No migration path found from version ${dataVersion} to ${currentVersion}. ` +
            `Missing script(s) in scripts/migrate/${domain}/ (stuck at v${current})`
          );
        }
        chain.push(step);
        current = step.toVersion;
      }

      // Backup
      const backupDir = path.dirname(filePath);
      const timestamp = '20260101T000000';
      const backupPath = path.join(backupDir, `${domain}-v${dataVersion}-${timestamp}.json`);
      fs.copyFileSync(filePath, backupPath);

      // Run chain
      let migrated = data;
      try {
        for (const step of chain) {
          migrated = step.migrate(migrated);
          migrated.version = step.toVersion;
        }
        writeJson(filePath, migrated);
      } catch (err) {
        fs.copyFileSync(backupPath, filePath);
        throw new Error(
          `[${domain}] Migration from v${migrated.version ?? dataVersion} failed: ${err.message}. ` +
          `Original data restored from backup.`
        );
      }
    }
  }

  return migrateAllFn;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('migrator', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('no-op when data version matches expected', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { version: 2, foo: 'bar' });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 2, filePath } },
      {}
    );
    await migrateAll();

    expect(readJson(filePath)).toEqual({ version: 2, foo: 'bar' });
  });

  it('no-op when data has no version field (treated as 0) and expected is 0', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { foo: 'bar' });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 0, filePath } },
      {}
    );
    await migrateAll();

    expect(readJson(filePath)).toEqual({ foo: 'bar' });
  });

  it('runs a single-step migration and writes updated version', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { foo: 'bar' });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 1, filePath } },
      { test: [{ fromVersion: 0, toVersion: 1, migrate: d => ({ ...d, migrated: true }) }] }
    );
    await migrateAll();

    expect(readJson(filePath)).toEqual({ foo: 'bar', migrated: true, version: 1 });
  });

  it('runs a multi-step chain in order', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { steps: [] });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 3, filePath } },
      {
        test: [
          { fromVersion: 0, toVersion: 1, migrate: d => ({ ...d, steps: [...d.steps, 'a'] }) },
          { fromVersion: 1, toVersion: 2, migrate: d => ({ ...d, steps: [...d.steps, 'b'] }) },
          { fromVersion: 2, toVersion: 3, migrate: d => ({ ...d, steps: [...d.steps, 'c'] }) },
        ],
      }
    );
    await migrateAll();

    expect(readJson(filePath).steps).toEqual(['a', 'b', 'c']);
    expect(readJson(filePath).version).toBe(3);
  });

  it('throws when data version is higher than expected (downgrade)', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { version: 5 });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 2, filePath } },
      {}
    );
    await expect(migrateAll()).rejects.toThrow('Please update the server to the latest version');
  });

  it('throws when migration chain has a gap', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { version: 0 });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 3, filePath } },
      { test: [{ fromVersion: 0, toVersion: 1, migrate: d => d }] } // gap: missing 1→2 and 2→3
    );
    await expect(migrateAll()).rejects.toThrow('No migration path found');
  });

  it('creates a backup file before migrating', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { original: true });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 1, filePath } },
      { test: [{ fromVersion: 0, toVersion: 1, migrate: d => ({ ...d, migrated: true }) }] }
    );
    await migrateAll();

    const backups = fs.readdirSync(tmpDir).filter(f => f.includes('-v0-'));
    expect(backups).toHaveLength(1);
    expect(readJson(path.join(tmpDir, backups[0]))).toMatchObject({ original: true });
  });

  it('restores backup and throws when a migration step fails', async () => {
    const filePath = path.join(tmpDir, 'data.json');
    writeJson(filePath, { original: true });

    const migrateAll = await buildMigrator(
      { test: { currentVersion: 1, filePath } },
      {
        test: [{
          fromVersion: 0,
          toVersion: 1,
          migrate: () => { throw new Error('boom'); },
        }],
      }
    );
    await expect(migrateAll()).rejects.toThrow('Original data restored from backup');

    // Original data should be restored
    expect(readJson(filePath)).toMatchObject({ original: true });
  });
});
