# Server Refactoring: Domain-Specific Architecture

## Goal
Refactor the monolithic `server.mjs` and `generate.mjs` into a specialized, domain-driven architecture to improve maintainability and scalability.

## Implementation Details
- **Architecture**: Move from "Script-based" to "Feature-based" folder structure.
- **Phase 1**: Setup Core Infrastructure (Config, DB, Paths).
- **Phase 2**: Migrate "Leaf" domains (Upload, Media) that have few dependencies.
- **Phase 3**: Migrate the Core "Generation" domain (the most complex part).
- **Phase 4**: Cleanup and switch entry point to new architecture.

## Tasks
### Phase 1: Core Infrastructure
[x] Create new directory structure: `server/core`, `server/features`
[x] Refactor Path Management: Create `server/core/paths.mjs` to handle `__dirname` and root resolution.
[x] Refactor Config: Create `server/core/config.mjs` to load `config.json` and provide a typed interface.
[x] Refactor Database: Create `server/core/database.mjs` to manage `media-data.json` loading/saving (Repository Pattern).
[x] Refactor SSE: Kept `server/sse.mjs` in place (already well-structured). No move needed.

### Phase 2: Simple Domains
[x] **Media Domain**:
    [x] Create `server/features/media/repository.mjs` (wraps core DB).
    [x] Create `server/features/media/service.mjs` (search, filter, delete logic).
    [x] Create `server/features/media/router.mjs` (Express routes).
[x] **Upload Domain**:
    [x] Create `server/features/upload/service.mjs` (ComfyUI upload logic + local storage).
    [x] Create `server/features/upload/router.mjs` (Multer setup + routes).

### Phase 3: Generation Domain (Complex)
[x] **ComfyApi Service**:
    [x] Extract ComfyUI WebSocket/API interaction to `server/features/generation/comfy-client.mjs`.
[x] **Workflow Management**:
    [x] Extract workflow loading and validation (nested checks) to `server/features/generation/workflow-validator.mjs`.
[x] **Task Processors**:
    [x] Create `server/features/generation/processors/` directory.
    [x] Extract `extractOutputMediaFromTextFile` to its own module.
    [x] Extract `crossfadeVideoFrames` to its own module.
    [x] Extract `extractOutputTexts` to its own module.
    [x] Extract `executeWorkflow` (nested) logic to its own module.
    [x] Create `processors/index.mjs` barrel with `PROCESS_HANDLERS` registry.
[x] **Orchestrator**:
    [x] Create `server/features/generation/orchestrator.mjs` to coordinate the flow (Pre -> Comfy -> Post).
    [x] Integrate with `sse-manager.mjs` for progress updates.
[x] **Router**:
    [x] Create `server/features/generation/router.mjs` for `/generate` and `/regenerate` endpoints.

### Phase 4: Integration & Cleanup
[x] Updates `server/server.mjs` to mount the new Feature Routers.
[ ] Verify all endpoints (Upload -> Generate -> Gallery -> Delete).
[ ] Remove legacy massive files (`generate.mjs`, old `server.mjs` code).
