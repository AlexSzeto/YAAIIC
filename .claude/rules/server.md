---
trigger: model_decision
description: when working on the server side of the website
---

## 4. Backend Architecture (Domain-Driven)

The backend is organized into **Feature Domains** to avoid monolithic files. Each domain is a self-contained folder in `server/features/` managing its own routes, business logic, and data access.

### Directory Structure
- **`server/server.mjs`**: Entry point. initializes Express, loads config, and mounts domain routers.
- **`server/core/`**: Shared foundational code (Config, Logger, EventBus/SSE, Database Driver).
- **`server/features/`**:
    - **`media/`**:
        - `router.mjs`: Endpoints for `/media-data`, `/tags`.
        - `repository.mjs`: access to `media-data.json`.
        - `service.mjs`: Domain logic (filtering, editing).
    - **`generation/`**:
        - `router.mjs`: Endpoints for `/generate`.
        - `orchestrator.mjs`: Manages the generation lifecycle (pre-tasks -> comfy -> post-tasks).
        - `comfy-service.mjs`: Wraps ComfyUI API and WebSocket interactions.
        - `processors/`: Individual task handlers (e.g., `extract-text.mjs`, `crossfade.mjs`).
    - **`upload/`**:
        - `router.mjs`: Endpoints for `/upload/*`.
        - `service.mjs`: File processing and storage logic.

### Design Patterns
- **Service Layer**: Routes should **never** contain business logic. They should extract parameters and call a Service.
- **Repository Pattern**: Data access is isolated. `server.mjs` should not touch `globalData` directly; usage of a specific `MediaRepository` is required.
- **Strategy Pattern for Generation Tasks**: `generate.mjs` currently uses a giant switch/map. This must be refactored into individual processor modules loaded dynamically or registered explicitly.
- **Dependency Injection**: Services should accept their dependencies (like config or other services) in their constructor or factory function, rather than importing global singletons, to facilitate testing and modularity.

### Path Handling
- Always use `path.join()` for file paths.
- Use `process.cwd()` or a dedicated `AppPaths` constant from `server/core/paths.mjs` to resolve project roots, rather than `__dirname` hacks in every file.

## 5. Data Management
- **Persistence**:
    - Primary data storage is **JSON files** in `server/database/`.
    - **Do not use a SQL database** unless explicitly requested.
    - **Flat-file per domain**: All domain data must be stored as a single JSON file in `server/database/` (e.g., `brew-data.json`), not as a directory of per-record files. Mimic the flat array structure of an existing database JSON file, if available.
- **Configuration**:
    - System configuration lives in `config.json`.
    - Defaults are in `config.default.json`.
    - The server should handle missing `config.json` by copying the default on startup.

## 6. Code Hygiene
- **Cleanliness**: Remove unused imports, variables, and console logs before finalizing a task.
- **Modularity**:
    - Extract repeated logic into helper functions.
    - Keep files focused (Single Responsibility Principle).
- **Comments**:
    - Explain *why*, not just *what*.
    - Use `// TODO:` comments to mark areas for future improvement, but try to resolve them if they are within scope.