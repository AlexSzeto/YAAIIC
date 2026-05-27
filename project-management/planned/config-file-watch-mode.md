# Config File Watch Mode

**Priority:** high

## Goal

Make the server automatically detect and reload `config.json` and `comfyui-workflows.json` when those files change on disk, so users don't need to restart the server after editing configuration or workflow definitions.

## Notes

- Should watch both `config.json` and `comfyui-workflows.json`.
- On change: re-read the file and replace the in-memory config/workflows without restarting the process.
- Node's `fs.watch` or `chokidar` are reasonable options.
