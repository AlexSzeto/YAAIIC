---
trigger: model_decision
description: when working on the server side of the website
---

## 4. Backend Architecture (Domain-Driven)

The backend is organized into **Feature Domains** to avoid monolithic files. Each domain is a self-contained folder in `server/features/` managing its own routes, business logic, and data access.

### Directory Structure
- **`server/server.mjs`**: Entry point. initializes Express, loads config, and mounts domain routers.
- **`server/core/`**: Shared foundational code (Config, Logger, EventBus/SSE, Database Driver).
- **`server/features/`**: Each subdirectory is a self-contained feature domain. A typical domain contains:
    - `router.mjs`: Express route definitions for the domain's endpoints.
    - `service.mjs`: Business logic for the domain.
    - `repository.mjs`: Data access layer (if the domain owns persistent data).

### Design Patterns
- **Service Layer**: Routes should **never** contain business logic. They should extract parameters and call a Service.
- **Repository Pattern**: Data access is isolated. `server.mjs` should not directly access database files; all data access goes through a domain-specific repository.
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