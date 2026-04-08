---
trigger: model_decision
description: when working on any part of the YAAIIC project (project-specific conventions)
---

## Project: YAAIIC

### Feature Domains
The YAAIIC backend is organized into the following feature domains under `server/features/`:

- **`media/`**: Media data management — `/media-data`, `/tags` endpoints; `media-data.json` database.
- **`generation/`**: AI generation pipeline — `/generate` endpoint; orchestrator, ComfyUI client, pre/post processors.
- **`upload/`**: File upload handling — `/upload/*` endpoints; file processing and staging.
- **`brew/`**: Brew content management — endpoints and database for brew entries.
- **`sound-sources/`**: Sound source management — endpoints and database for sound sources.
- **`export/`**: Export functionality — endpoints for exporting generated media to destinations.
- **`workflows/`**: ComfyUI workflow management — endpoints for listing and serving workflow JSON files.
- **`llm/`**: LLM integration — endpoints for prompt generation and text processing via language models.

### Generation Architecture
- The generation pipeline is orchestrated in `features/generation/orchestrator.mjs`, which manages pre-tasks → ComfyUI → post-tasks.
- Individual pre/post-processing task handlers live in `features/generation/processors/` as separate modules, each registered or loaded dynamically — avoid adding new cases to a monolithic switch/map.
- `comfy-client.mjs` wraps all ComfyUI REST API interactions.

### Frontend Navigation
- Every new page must be registered in `public/js/app-ui/hamburger-menu.mjs` as part of the same task that creates it. Do not ship a page without a navigation entry.

### Repository Pattern (YAAIIC)
- `server.mjs` must not access `globalData` directly; all media data access goes through `MediaRepository` from `features/media/repository.mjs`.
