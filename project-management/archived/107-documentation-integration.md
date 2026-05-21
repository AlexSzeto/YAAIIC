# Documentation Integration into Development Cycle

## Goal

Eliminate documentation drift by removing stale schema files, adding inline `@typedef` JSDocs for key data structures, creating per-section feature docs for major client areas, auditing `scaffolding.md`, and wiring living-doc creation and review into the `groom-feature` and `archive-feature` skills.

## Tasks

### Phase 1 — Clean up and establish data-structure documentation
- [x] Delete `server/resource/comfyui-workflows.schema.json` and `server/resource/media-data-schema.json`
- [x] Add `@typedef` JSDocs to `server/features/generation/orchestrator.mjs` (and workflow validator if separate) for `WorkflowObject`, `LLMTask`, `ExtraInput`, `Condition`, `Replacement`, and related types
- [x] Add `@typedef` JSDocs to `server/features/media/repository.mjs` for `MediaEntry` and related types
- [x] Add `@typedef` JSDocs to `server/features/anytale/` service or repository for `Character`, `Outfit`, `Plot`, and related types

### Phase 2 — Create per-section feature docs
- [x] Create `docs/features/anytale.md` — user flow, component interactions, server endpoints, key data shapes
- [x] Create `docs/features/main-gallery.md` — gallery/generation flow, inpaint flow, component interactions
- [x] Create `docs/features/ambient-brew.md` — brew editor flow, sound source management, component interactions

### Phase 3 — Audit and update scaffolding.md
- [x] Audit `docs/scaffolding.md` against the current project structure and update any stale content

### Phase 4 — Update skills
- [x] Update `groom-feature` skill: append a docs-review task naming affected living docs; if the feature touches a specific app section (anytale, brew, main/inpaint/workflow-editor), add a task to create `docs/features/<section>.md` if it doesn't already exist
- [x] Update `archive-feature` skill: skipped — docs-review is already injected as a task by groom-feature; archive only runs after all tasks are complete, making a second review redundant
- [x] Create `.claude/skills/update-docs/SKILL.md`: an agent skill that accepts a description of recent changes, reads each living doc in `docs/` and `.claude/rules/`, identifies stale sections, and proposes targeted edits for user approval

### Phase 5 — Initial pass
- [x] Run `/update-docs` against the current codebase state to bring all living docs up to date before the loop takes over maintenance

## Implementation Details

### Living docs list (going forward)
- `docs/architecture.md`
- `docs/components.md`
- `docs/server.md`
- `docs/workflow.md`
- `docs/features/anytale.md`
- `docs/features/main-gallery.md`
- `docs/features/ambient-brew.md`
- `docs/scaffolding.md` — include in review only when a feature adds new pages (changes to `hamburger-menu.mjs`) or new `custom-ui` components
- `.claude/rules/client.md`
- `.claude/rules/server.md`
- `.claude/rules/planning.md`

### @typedef JSDocs placement
Place typedefs in the file that **owns/defines** the data structure (typically the repository or service that constructs it), not in every consumer. This keeps the definition co-logged with the source of truth.

### groom-feature skill changes
- Always append a docs-review task at the end of every generated task list, naming the specific living docs most likely affected (inferred from the feature spec content)
- Additionally, if the feature scope touches a named app section (anytale, brew, main/inpaint/workflow-editor), append a task to create `docs/features/<section>.md` if it doesn't already exist

### archive-feature skill changes
- Before writing the archive file, scan the feature's completed tasks for changes affecting living docs and surface a prompt to review or auto-invoke `/update-docs`
- If the feature created new pages or new `custom-ui` components, include `docs/scaffolding.md` in the review list

### /update-docs skill
- Accepts a free-form description of what changed (or runs a broad audit if no description given)
- Reads each living doc in `docs/` and `.claude/rules/`
- Identifies stale sections and proposes targeted diffs for user approval
- Does not auto-write; all edits require explicit user confirmation
