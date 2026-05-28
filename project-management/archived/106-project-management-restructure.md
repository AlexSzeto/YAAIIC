# Project Management Restructure

## Goal

Replace the flat `docs/`-based project management structure with a kanban-style `project-management/` folder with defined lifecycle lanes, rename and consolidate skills to match the new feature lifecycle, and add testing rules to close the gap left by the test infrastructure rollout.

## Tasks

### Folder Structure
- [x] Create `project-management/` at the repo root with five subdirectories: `planned/`, `groomed/`, `in-progress/`, `abandoned/`, `archived/`.

### Migration — Groomed Features
- [x] Review each file in `docs/groomed-features/` with the user one-by-one and sort into `project-management/groomed/` or `project-management/abandoned/`. For `development-loop-overhaul.md` specifically: extract the docs-drift half (Problem 2 and its tasks) into a new file `project-management/groomed/documentation-drift-prevention.md`, place the rest (already being executed) into `project-management/abandoned/`, then delete the original.
- [x] Delete the now-empty `docs/groomed-features/` directory.

### Migration — Feature History
- [x] Move all files from `docs/feature-history/` to `project-management/archived/`.
- [x] Delete the now-empty `docs/feature-history/` directory.

### Migration — Remaining Files
- [x] After `create-feature` skill is ready: use it to break down ideas in `plan.md` into individual `planned/` files, then delete `plan.md`.
- [x] Move `task.md` to `project-management/in-progress/project-management-restructure.md`. This is the last file using the old structure — all future in-progress files live under `project-management/in-progress/`.

### Skills — New
- [x] Create `.claude/skills/create-feature/SKILL.md`: freeform idea capture. Accepts a free-form description, writes a draft file to `project-management/planned/<slug>.md`. Before writing, scans existing files in `planned/` and `groomed/` for conflicts or overlaps and presents them to the user, offering to merge into an existing file instead of creating a new one.
- [x] Create `.claude/skills/groom-feature/SKILL.md`: replaces `plan-feature` + `plan-tasks`. Can be invoked with an explicit `planned/` filename or from scratch. Conducts interactive Q&A one question at a time to develop a thorough spec. If new sub-features surface during grooming that are out of scope, instruct the user to run `create-feature` for them first. At the end, ask: "Save to `groomed/` or start implementing now (`in-progress/`)?" — either way, deletes the source `planned/` file (if one existed). If "save to groomed/": write to `project-management/groomed/<slug>.md`. If "start now": write to `project-management/in-progress/<filename>.md` (prompt user for filename), then compile task list inline following the same standards as the old `plan-tasks` skill.
- [x] Create `.claude/skills/implement-feature/SKILL.md`: replaces `execute` + `execute-all`. Accepts an explicit filename from `project-management/in-progress/`. Tasks must be organized into phases in the task file; each phase ends at a user-visible and manually testable milestone (maintenance or server-only features are exempt and run all tasks then stop). At the end of each phase: run the full test suite (`vitest run`) until all tests pass, then stop and prompt the user to confirm before starting the next phase. Two hard rules that must never be violated: (1) when a task is complete, check it off in the physical file immediately — no batching writes; (2) if the user requests an ad-hoc fix or improvement mid-implementation, write the plan as a new unchecked task in the in-progress file before touching any code.
- [x] Create `.claude/skills/archive-feature/SKILL.md`: replaces `archive`. Accepts an explicit filename from `project-management/in-progress/`. Moves the file to `project-management/archived/`. Copies title, goal, and all completed tasks verbatim. If incomplete tasks remain, ask the user how to handle them before archiving.

### Skills — Delete Old
- [x] Delete `.claude/skills/plan-feature/` directory.
- [x] Delete `.claude/skills/plan-tasks/` directory.
- [x] Delete `.claude/skills/execute/` directory.
- [x] Delete `.claude/skills/execute-all/` directory.
- [x] Delete `.claude/skills/archive/` directory.

### Rules Updates
- [x] Update `.claude/rules/planning.md`: replace all references to `docs/groomed-features/`, `docs/feature-history/`, and `task.md` with the new `project-management/` paths. Update skill name references (`plan-feature` → `groom-feature`, `plan-tasks` → `groom-feature`, `execute`/`execute-all` → `implement-feature`, `archive` → `archive-feature`). Document the full skill lifecycle: `create-feature` → `groom-feature` → `implement-feature` → `archive-feature`.
- [x] Add a **Testing** section to `.claude/rules/server.md`: (1) every new route or service module must include a co-located `.test.mjs` file; (2) at phase boundaries, "passing" means the full `vitest run` suite is green — not just `--changed`; (3) mocks for ComfyUI and Ollama are available in `server/test/mocks/`.
- [x] Add a **Testing** section to `.claude/rules/client.md`: (1) every new component added to `public/js/custom-ui/` must have a render entry added to `public/js/custom-ui/test.vitest.mjs`; (2) at phase boundaries, "passing" means the full `vitest run` suite is green.

## Implementation Details

### Skill Lifecycle
```
create-feature → groom-feature → implement-feature → archive-feature
```

### File Naming
- All files in `project-management/` use kebab-case slugs (no sequential numbering).
- In-progress filenames are chosen by the user at the time `groom-feature` or `plan-tasks` writes to `in-progress/`.

### `implement-feature` Phase Structure
Tasks in an in-progress file should be grouped under `### Phase N — <description>` headings. The skill stops after the last task in each phase, runs `vitest run`, and prompts the user before continuing. For maintenance/server-only features with no visible milestone, all tasks run in a single pass followed by the test run.

### Ad-hoc Rule (implement-feature rule 2)
When a mid-implementation request arrives, the agent must:
1. Write a new unchecked task to the in-progress file describing the change.
2. Only then proceed with code changes.
This ensures the task file always reflects the true state of work, even after interruptions.

### Groomed Features Migration Reference
Files currently in `docs/groomed-features/`:
- `anytale-play-mode.md` and `anytale-play-1-foundation.md` through `anytale-play-6-branching-completion.md` — review with user
- `anytale-outfit-preview-images.md` — review with user
- `anytale-editor-music-tab.md` — review with user
- `comfyui-optional-workflows.md` — review with user
- `development-loop-overhaul.md` — split: docs-drift half → `groomed/documentation-drift-prevention.md`, remainder → `abandoned/`
