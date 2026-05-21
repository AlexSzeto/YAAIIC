# Project Architecture

This document describes the overall architecture and design patterns used in YAAIIC, covering both the frontend and backend.

## Table of Contents

- [Overview](#overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [VRAM Management](#vram-management)
- [Configuration](#configuration)
- [Directory Structure](#directory-structure)
- [Data Persistence](#data-persistence)
- [Data Versioning](#data-versioning)

## Overview

YAAIIC is a full-stack application split into:

- **Frontend** (`public/`): Preact-based SPA served as static files. No build step — uses native ES modules with importmaps.
- **Backend** (`server/`): Express.js with domain-driven architecture. Orchestrates ComfyUI and Ollama services.
- **External Services**: ComfyUI (image/video/audio generation) and Ollama (LLM text generation).

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No build step | Faster iteration, simpler tooling. ES modules + importmaps work natively in modern browsers. |
| Preact over React | 3KB footprint, same API. Suitable for a local tool that doesn't need React's ecosystem. |
| goober over styled-components | 1KB CSS-in-JS. Lightweight, sufficient for component-scoped styling. |
| JSON file storage | Simple persistence for a single-user local tool. No database server needed. |
| Domain-driven backend | Each feature is self-contained. Easy to add/remove capabilities without touching unrelated code. |
| SSE over WebSocket | Simpler client implementation for one-way server-to-client progress updates. |

---

## Frontend Architecture

### Component Layers

The frontend has three distinct layers:

```
┌─────────────────────────────────────┐
│           HTML Pages                │  Entry points (index.html, brew-editor.html, etc.)
├─────────────────────────────────────┤
│         App-UI Components           │  Project-specific logic (public/js/app-ui/)
├─────────────────────────────────────┤
│       Custom-UI Components          │  Reusable design system (public/js/custom-ui/)
├─────────────────────────────────────┤
│    Libraries (Preact, htm, goober)  │  Third-party dependencies (public/lib/)
└─────────────────────────────────────┘
```

1. **Custom-UI** (`public/js/custom-ui/`): Portable, themeable component library shared across projects. Contains buttons, inputs, modals, layouts, and the theme system. See [components.md](components.md).

2. **App-UI** (`public/js/app-ui/`): YAAIIC-specific components built on custom-ui. Contains the generation form, gallery, workflow editor, brew editor, inpaint canvas, tag system, and SSE manager.

3. **Pages**: Each HTML file is an independent entry point that mounts a Preact app tree using the `Page` component as root.

### State Management

- **Local state**: `useState` / `useReducer` hooks for component-scoped state.
- **Global state**: Subscription pattern via signals (e.g., `currentTheme.subscribe()`) for cross-component concerns.
- **Server state**: Fetched on demand via `fetchJson()`. No client-side cache layer.
- **Real-time updates**: SSE subscriptions managed by `SSEManager` class.

### Navigation

Pages are independent HTML files (not a SPA router):

| Page | URL | Purpose |
|------|-----|---------|
| Main App | `/` | Generation, gallery, media management |
| Workflow Editor | `/workflow-editor.html` | Configure ComfyUI workflows |
| Brew Editor | `/brew-editor.html` | Create ambient sound mixes |
| AnyTale | `/anytale.html` | Character creation and scene generation |
| Inpaint | `/inpaint.html` | Draw masks for image inpainting |
| Loading | `/loading.html` | Service readiness checkpoint |

Navigation between pages is via the hamburger menu (`hamburger-menu.mjs`).

---

## Backend Architecture

### Domain-Driven Structure

The backend follows a domain-driven design where each feature is a self-contained module:

```
server/
├── server.mjs              # Entry point: Express setup, middleware, router mounting
├── core/                   # Shared infrastructure
│   ├── config.mjs          # Configuration loader
│   ├── database.mjs        # Media data repository
│   ├── data-versions.mjs   # Domain registry: tracked files and expected versions
│   ├── migrator.mjs        # Startup migration runner
│   ├── paths.mjs           # Centralized path constants
│   ├── sse.mjs             # Server-Sent Events manager
│   ├── service-manager.mjs # ComfyUI/Ollama health & launch
│   ├── llm.mjs             # Ollama API wrapper
│   └── index.mjs           # Barrel exports
└── features/               # Feature domains
    ├── anytale/            # Character, parts, plot, outfit data
    ├── brew/               # Brew recipe management
    ├── chat/               # LLM chat endpoint
    ├── export/             # Media export to external targets
    ├── generation/         # ComfyUI orchestration
    ├── llm/                # LLM model listing
    ├── media/              # Gallery & tag management
    ├── queue/              # Generation task queue
    ├── sound-sources/      # Audio source library
    ├── upload/             # File upload processing
    └── workflows/          # Workflow CRUD & auto-detection
```

### Domain Module Pattern

Each domain folder follows a consistent structure:

```
features/<domain>/
├── router.mjs       # Express route handlers (thin adapters)
├── service.mjs      # Business logic
└── repository.mjs   # Data access (optional, when data layer is non-trivial)
```

**Rules**:
- Routes never contain business logic — they extract parameters and call services.
- Services accept dependencies via constructor/factory functions (dependency injection).
- Data access is isolated in repositories.

### Router Mounting

All domain routers are mounted in `server.mjs`:

```javascript
app.use(mediaRouter);
app.use(uploadRouter);
app.use(generationRouter);
app.use(exportRouter);
app.use(workflowsRouter);
app.use(llmRouter);
app.use(chatRouter);
app.use(brewRouter);
app.use(soundSourcesRouter);
app.use(anytaleRouter);
app.use(queueRouter);
```

### Middleware

1. **Service readiness gating**: Non-exempt HTML requests redirect to `/loading.html` when ComfyUI or Ollama are unavailable.
2. **Static file serving**: `public/` directory served as static assets.
3. **JSON body parsing**: `express.json()` for API endpoints.
4. **Multer**: File upload handling (100 MB limit, 2 files per request).

---

## Data Flow

### Generation Pipeline

```
Client                    Server                    ComfyUI          Ollama
  │                        │                          │                │
  ├─POST /generate────────►│                          │                │
  │                        ├─VRAM management──────────►│               │
  │                        ├─Pre-generation tasks─────────────────────►│
  │◄─{ taskId }────────────┤                          │                │
  │                        │                          │                │
  ├─GET /progress/:taskId─►│                          │                │
  │                        ├─Upload files─────────────►│               │
  │                        ├─Execute workflow──────────►│               │
  │◄─SSE: progress─────────┤◄─WebSocket progress──────┤               │
  │◄─SSE: progress─────────┤◄─WebSocket progress──────┤               │
  │                        ├─Post-generation tasks────────────────────►│
  │◄─SSE: complete─────────┤                          │                │
  │                        │                          │                │
```

### Upload Pipeline

```
Client                    Server                    ComfyUI          Ollama
  │                        │                          │                │
  ├─POST /upload/image────►│                          │                │
  │◄─{ taskId }────────────┤                          │                │
  │                        │                          │                │
  ├─GET /progress/:taskId─►│                          │                │
  │                        ├─Save to storage───────────►│              │
  │                        ├─LLM analysis─────────────────────────────►│
  │◄─SSE: complete─────────┤                          │                │
```

---

## VRAM Management

Since ComfyUI and Ollama share GPU VRAM, the server tracks the last-used workflow and Ollama model. When switching between them:

1. **Workflow change**: Calls ComfyUI's `/free` endpoint to unload the previous model and free VRAM.
2. **Ollama model change**: Unloads the previous Ollama model before loading the new one.
3. **WebSocket reinitialization**: Ensures a fresh ComfyUI WebSocket connection for each generation.

This allows the system to run on consumer GPUs with limited VRAM by never keeping multiple models loaded simultaneously.

---

## Configuration

### Files

| File | Purpose |
|------|---------|
| `server/config.json` | User configuration (created from default on first run) |
| `server/config.default.json` | Default values template |

### Key Settings

```json
{
  "serverPort": 3000,
  "ollamaAPIPath": "http://localhost:11434",
  "ollamaLaunchPath": "path/to/start_ollama.bat",
  "ollamaUseCPU": false,
  "comfyuiAPIPath": "http://localhost:8188",
  "comfyuiLaunchPath": "path/to/start_comfyui.bat",
  "exports": [...]
}
```

### Configuration Loading

1. On startup, `loadConfig()` reads `config.json`.
2. If `config.json` doesn't exist, it copies `config.default.json` to create it.
3. `getConfig()` returns the cached configuration object.

---

## Directory Structure

### Server Directories

| Path | Constant | Purpose |
|------|----------|---------|
| `server/` | `SERVER_DIR` | Server code root |
| `server/database/` | `DATABASE_DIR` | JSON data files |
| `server/storage/` | `STORAGE_DIR` | Generated media files |
| `server/resource/` | `RESOURCE_DIR` | ComfyUI workflow JSONs, CSV data |
| `server/logs/` | `LOGS_DIR` | SSE progress logs |

All paths are defined centrally in `server/core/paths.mjs` using `path.join()`. No module computes paths locally.

---

## Data Persistence

All data is stored as JSON files in `server/database/`:

| File | Contents |
|------|----------|
| `media-data.json` | Generated media history (images, videos, audio) with metadata, tags, folders |
| `anytale-data.json` | AnyTale characters, parts library, plots, and outfits |
| `brew-data.json` | Saved ambient brew recipes |
| `sound-sources.json` | Global sound source definitions |

Workflow configurations are stored separately in `server/resource/comfyui-workflows.json`.
Individual ComfyUI workflow JSON files live in `server/resource/workflows/`.

### Media Data Schema

Each media entry contains:

```json
{
  "uid": 1234567890,
  "name": "Unnamed",
  "description": "AI-generated prose description...",
  "summary": "Objective visual inventory...",
  "tags": "portrait, anime, female",
  "prompt": "user prompt text...",
  "imageUrl": "/media/image_1.png",
  "audioUrl": "/media/audio_1.mp3",
  "workflow": "workflow_name",
  "type": "image",
  "seed": 12345,
  "inpaint": false,
  "inpaintArea": null,
  "folder": "folder-123",
  "timeTaken": 45,
  "timestamp": "2025-12-28T00:00:00.000Z"
}
```

---

## Data Versioning

Each managed data file carries a top-level `"version"` field. On startup, `migrateAll()` in `server/core/migrator.mjs` inspects every registered domain, runs any needed migration scripts, and refuses to start if a migration chain cannot be completed or if the data is newer than the server expects.

### Domain Registry

Tracked domains are defined in `server/core/data-versions.mjs`. A missing `"version"` field in a data file is treated as version `0`.

| Domain | File | Current Version |
|--------|------|-----------------|
| `config` | `server/config.json` | 0 |
| `anytale-data` | `server/database/anytale-data.json` | 0 |
| `media-data` | `server/database/media-data.json` | 0 |
| `brew-data` | `server/database/brew-data.json` | 0 |
| `sound-sources` | `server/database/sound-sources.json` | 0 |

`queue-data` is excluded — it is transient and not schema-versioned.

### Startup Behavior

1. Read each domain file; treat a missing `"version"` field as version `0`.
2. **Versions match** → no-op.
3. **Data version > expected** → server refuses to start; user is asked to update the server.
4. **Data version < expected** → write a timestamped backup to `scripts/migrate/backups/`, then run the migration chain. If the chain fails or has a gap, restore the backup and refuse to start.

### Migration Script Interface

Scripts live at `scripts/migrate/<domain>/<N>-to-<M>.mjs`:

```js
export const fromVersion = 0;
export const toVersion = 1;

export function migrate(data) {
  // transform data from fromVersion shape to toVersion shape
  return data;
}
```

The migrator writes the `"version"` field after each step — scripts do not set it themselves.

### Adding a Migration

1. Create `scripts/migrate/<domain>/<N>-to-<M>.mjs` following the interface above.
2. Bump `currentVersion` for that domain in `server/core/data-versions.mjs`.

### Backup Naming

```
scripts/migrate/backups/<domain>-v<version>-<timestamp>.json
```

Example: `anytale-data-v0-20260521T143200.json`
