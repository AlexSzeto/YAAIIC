# Config File Watch Mode

## Goal

The server automatically detects changes to `config.json` on disk and reloads it without requiring a restart. Config values read per-request update immediately; `comfyuiAPIPath` and `ollamaAPIPath` changes trigger a live reconnect attempt; `serverPort` changes log a restart-required warning.

## Tasks

### Phase 1 — Watcher module and tests

- [x] Add `startConfigWatcher(onChange)` to `server/core/config.mjs`:
  - Watch `CONFIG_PATH` using Node's built-in `fs.watch`
  - Debounce raw events by 300 ms (clear/reset a `setTimeout` on each raw event)
  - On debounce fire: snapshot `oldConfig = getConfig()`, call `loadConfig()` to refresh `_config`, call `onChange(newConfig, oldConfig)`
  - Return a `{ close }` object that calls `watcher.close()` to stop watching
- [x] Add `server/core/config.test.mjs` with tests for `startConfigWatcher`:
  - Write a temp config file, start the watcher, overwrite the file, assert `onChange` is called with the updated config values
  - Assert the watcher does not throw if `close()` is called before any event fires
  - Close the watcher in `afterEach` to avoid leaked handles

### Phase 2 — Reconnect hooks and server wiring

- [x] Export `reconnectComfyUIWebSocket(newApiPath)` from `server/comfyui-websocket.mjs`:
  - Set `comfyUIAPIPath = newApiPath`
  - Call `connectToComfyUI(true)` (force teardown and reconnect)
- [x] In `server.mjs`, call `startConfigWatcher` inside `startServer()` after the server begins listening; wire the `onChange` callback to:
  - Update `app.locals.config` to `newConfig`
  - Compute the set of top-level keys whose values changed and log them
  - If `comfyuiAPIPath` changed: call `initialize(newConfig.comfyuiAPIPath)` (comfy-client), `initializeOrchestrator(newConfig.comfyuiAPIPath)`, and `reconnectComfyUIWebSocket(newConfig.comfyuiAPIPath)`; log `♻️ comfyuiAPIPath updated — reconnecting to ComfyUI`
  - If `ollamaAPIPath` changed: call `initializeServices(newConfig)`; log `♻️ ollamaAPIPath updated — service health checks will use new URL`
  - If `serverPort` changed: log `⚠️ serverPort changed — restart the server to rebind the port`
- [x] Review and update affected living docs: `docs/server.md`

## Implementation Details

### Watcher signature

```js
// server/core/config.mjs

/**
 * Watch config.json for changes and invoke onChange whenever the file is modified.
 * Uses a 300 ms debounce to coalesce rapid editor saves into a single reload.
 *
 * @param {(newConfig: Object, oldConfig: Object) => void} onChange
 * @returns {{ close: () => void }}
 */
export function startConfigWatcher(onChange) { ... }
```

### Debounce pattern

```js
let debounceTimer = null;
const watcher = fs.watch(CONFIG_PATH, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const oldConfig = getConfig();
    try {
      const newConfig = loadConfig();
      onChange(newConfig, oldConfig);
    } catch (err) {
      console.error('[config-watcher] Failed to reload config:', err);
    }
  }, 300);
});
return { close: () => { clearTimeout(debounceTimer); watcher.close(); } };
```

### Changed-keys diff helper

```js
function changedKeys(oldConfig, newConfig) {
  const keys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
  return [...keys].filter(k => oldConfig[k] !== newConfig[k]);
}
```

### Fields that require restart vs reconnect

| Field | Action on change |
|---|---|
| `comfyuiAPIPath` | Reinit comfy-client + orchestrator + force WebSocket reconnect |
| `ollamaAPIPath` | Reinit service-manager (next health poll uses new URL) |
| `serverPort` | Warn only — port rebinding requires process restart |
| All others | `app.locals.config` update is sufficient |

### Where to start the watcher in server.mjs

Call `startConfigWatcher` inside `startServer()` after all subsystems are initialized and the server is listening, so a config change during startup does not race with initialization:

```js
async function startServer() {
  // ... existing startup code ...
  app.listen(port, () => { ... });

  startConfigWatcher((newConfig, oldConfig) => {
    // ... onChange logic ...
  });
}
```
