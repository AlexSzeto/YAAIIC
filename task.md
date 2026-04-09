# Service Readiness Gating with Loading Page

## Goal

The server tracks whether Ollama and ComfyUI are ready after launch. Any HTML page request while either service is unavailable redirects to a loading page that polls for readiness and redirects back to the original destination once both services are up.

## Tasks

- [x] Add service readiness state tracking to `service-manager.mjs`
- [x] Add a background polling loop that probes both services every 15 seconds until ready
- [x] Add a `GET /status` REST endpoint that returns the readiness of each service as JSON
- [x] Add HTML-page redirect middleware to `server.mjs` that redirects to the loading page when either service is not ready
- [x] Create the `loading.html` page and its Preact entry module

## Implementation Details

### Service Readiness State (`server/core/service-manager.mjs`)

Add two module-level booleans: `ollamaReady` and `comfyuiReady`, both initialized to `false`.

After `checkAndStartServices()` runs:
- If a service was already running at startup, set its flag to `true` immediately.
- If a service was launched (not already running), leave its flag `false` and let the polling loop detect when it becomes available.

Add an exported function `startReadinessPolling()` that:
- Runs every 15 seconds via `setInterval`.
- For each service not yet ready, re-runs its existing health check function (`checkServiceHealth` for Ollama, `checkComfyUIHealth` for ComfyUI).
- When a check succeeds, sets the corresponding flag to `true` and logs it.
- When both flags are `true`, clears the interval.

Export a `getServiceStatus()` function that returns:
```json
{ "ollama": true|false, "comfyui": true|false }
```

### `GET /status` Endpoint (`server/server.mjs` or a new status feature router)

Add a route `GET /status` that calls `getServiceStatus()` and responds with the JSON object. No authentication required.

**Manual test:**
```
curl http://localhost:3000/status
# Expected while services loading: {"ollama":false,"comfyui":false}
# Expected when ready:             {"ollama":true,"comfyui":true}
```

### HTML Redirect Middleware (`server/server.mjs`)

Add an Express middleware **before** the static file middleware that:
1. Checks if `req.path` ends with `.html` (or is `/`).
2. Checks if the path is in the hardcoded exemptions array:
   ```js
   const EXEMPT_PAGES = ['/loading.html']; // future: '/config.html'
   ```
3. If not exempt and either service is not ready, redirects to:
   ```
   /loading.html?redirect=<original encoded path+query>
   ```
4. Otherwise, passes through with `next()`.

### Loading Page (`public/loading.html` + `public/js/app-ui/loading.mjs`)

`loading.html` follows the same shell structure as `index.html` (imports libs, sets up the Preact mount point, imports `loading.mjs`).

`loading.mjs` is a Preact functional component that:
- On mount, reads `redirect` from the URL query string to know where to send the user when done.
- Polls `GET /status` every 15 seconds using `setInterval`.
- Displays a list of services with their individual status using the `Icon` component from `custom-ui/layout/icon.mjs`:
  - Ready: `check-circle` icon
  - Not ready: `loader` icon with `icon-spin` CSS class (defined in `page.mjs`)
- When both services are ready, clears the interval and calls `window.location.replace(redirect)` to navigate to the original destination.
- Uses the `Page` component and `currentTheme.subscribe` for consistent theming.
- The loading page is **not** registered in the hamburger menu (it is a system page, not a user-navigable page).

### Startup Integration (`server/server.mjs`)

After `checkAndStartServices()` resolves, call `startReadinessPolling()` so the background loop begins. Import `startReadinessPolling` and `getServiceStatus` from `service-manager.mjs`.
