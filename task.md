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
[ ] Create new directory structure: `server/core`, `server/features`
[ ] Refactor Path Management: Create `server/core/paths.mjs` to handle `__dirname` and root resolution.
[ ] Refactor Config: Create `server/core/config.mjs` to load `config.json` and provide a typed interface.
[ ] Refactor Database: Create `server/core/database.mjs` to manage `media-data.json` loading/saving (Repository Pattern).
[ ] Refactor SSE: Move SSE logic to `server/core/events.mjs` or `server/core/sse-manager.mjs`.

### Phase 2: Simple Domains
[ ] **Media Domain**:
    [ ] Create `server/features/media/repository.mjs` (wraps core DB).
    [ ] Create `server/features/media/service.mjs` (search, filter, delete logic).
    [ ] Create `server/features/media/router.mjs` (Express routes).
[ ] **Upload Domain**:
    [ ] Create `server/features/upload/service.mjs` (ComfyUI upload logic + local storage).
    [ ] Create `server/features/upload/router.mjs` (Multer setup + routes).

### Phase 3: Generation Domain (Complex)
[ ] **ComfyApi Service**:
    [ ] Extract ComfyUI WebSocket/API interaction to `server/features/generation/comfy-client.mjs`.
[ ] **Workflow Management**:
    [ ] Extract workflow loading and validation (nested checks) to `server/features/generation/workflow-validator.mjs`.
[ ] **Task Processors**:
    [ ] Create `server/features/generation/processors/` directory.
    [ ] Extract `extractOutputMediaFromTextFile` to its own module.
    [ ] Extract `crossfadeVideoFrames` to its own module.
    [ ] Extract `executeWorkflow` (nested) logic to its own module.
[ ] **Orchestrator**:
    [ ] Create `server/features/generation/orchestrator.mjs` to coordinate the flow (Pre -> Comfy -> Post).
    [ ] Integrate with `sse-manager.mjs` for progress updates.
[ ] **Router**:
    [ ] Create `server/features/generation/router.mjs` for `/generate` and `/regenerate` endpoints.

### Phase 4: Integration & Cleanup
[ ] Updates `server/server.mjs` to mount the new Feature Routers.
[ ] Verify all endpoints (Upload -> Generate -> Gallery -> Delete).
[ ] Remove legacy massive files (`generate.mjs`, old `server.mjs` code).
