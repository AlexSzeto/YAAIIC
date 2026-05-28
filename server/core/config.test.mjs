import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let tempDir;
let tempConfigPath;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  tempConfigPath = path.join(tempDir, 'config.json');
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function getModule() {
  vi.doMock('./paths.mjs', () => ({
    CONFIG_PATH: tempConfigPath,
    DEFAULT_CONFIG_PATH: path.join(tempDir, 'config.default.json'),
  }));
  return await import('./config.mjs');
}

describe('startConfigWatcher', () => {
  it('calls onChange with updated and previous config when file changes', async () => {
    fs.writeFileSync(tempConfigPath, JSON.stringify({ serverPort: 3000 }));

    const { loadConfig, startConfigWatcher } = await getModule();
    loadConfig();

    const onChange = vi.fn();
    const handle = startConfigWatcher(onChange);

    try {
      fs.writeFileSync(tempConfigPath, JSON.stringify({ serverPort: 4000 }));

      // Wait for OS watch event + 300 ms debounce + margin
      await new Promise(resolve => setTimeout(resolve, 700));

      expect(onChange).toHaveBeenCalledOnce();
      const [newConfig, oldConfig] = onChange.mock.calls[0];
      expect(newConfig.serverPort).toBe(4000);
      expect(oldConfig.serverPort).toBe(3000);
    } finally {
      handle.close();
    }
  });

  it('does not throw if close() is called before any event fires', async () => {
    fs.writeFileSync(tempConfigPath, JSON.stringify({ serverPort: 3000 }));

    const { loadConfig, startConfigWatcher } = await getModule();
    loadConfig();

    const handle = startConfigWatcher(vi.fn());
    expect(() => handle.close()).not.toThrow();
  });
});
