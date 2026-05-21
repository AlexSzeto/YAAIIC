---
description: when a planning step workflow starts
---

## Project Management Structure

All project planning lives under `project-management/` at the repo root, organized into kanban-style lanes:

- `project-management/planned/` — freeform ideas captured quickly, not yet fully specified
- `project-management/groomed/` — fully specified features ready to pull into development
- `project-management/in-progress/` — features currently being implemented (one file per active feature)
- `project-management/abandoned/` — features shelved at any stage of the lifecycle
- `project-management/archived/` — completed features preserved as a development record

All files in `project-management/` use kebab-case slugs. No sequential numbering is required.

## Skill Lifecycle

```
create-feature → groom-feature → implement-feature → archive-feature
```

| Skill | Purpose |
|---|---|
| `create-feature` | Capture a freeform idea into `planned/`. Checks for conflicts with existing planned and groomed files. |
| `groom-feature` | Develop a full spec from a `planned/` file or scratch via Q&A. Writes to `groomed/` or directly to `in-progress/`. Deletes the source `planned/` file. |
| `implement-feature` | Execute tasks from an `in-progress/` file phase by phase. Accepts an explicit filename. |
| `archive-feature` | Move a completed `in-progress/` file to `archived/`. |

## Feature File Format

Every file in `groomed/` and `in-progress/` follows this structure:

```markdown
# Feature Title

## Goal

Concise description of the desired outcome. No implementation steps.

## Tasks

### Phase 1 — <Short milestone description>
- [ ] Task description

### Phase 2 — <Short milestone description>
- [ ] Task description

## Implementation Details

Code snippets, data shapes, constraints, and design decisions.
```

- **Title**: `# Feature Title`
- **Goal**: Concise outcome description. No implementation details.
- **Tasks**: Under `## Tasks`. Each task has a single, verifiable outcome. Tasks that are not independently verifiable are bundled with adjacent tasks. If a bundled task is too large for one sentence, use a nested subtask list (no checkboxes on subtasks).
- **Phases**: Tasks grouped under `### Phase N — <description>` headings. Each phase ends at a user-visible or testable milestone. Maintenance and server-only features may use a flat task list.
- **Implementation Details**: Code snippets, data formats, class definitions, and constraints. Provides context but does not dictate step-by-step instructions unless a critical restriction applies.

## Ad-hoc Changes During Implementation

If a change request arrives while `implement-feature` is running, the change must be written as an unchecked task under a `#### Fixes and Changes` subheader at the end of the current phase before any code is touched.
