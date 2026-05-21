---
name: groom-feature
description: Develops a thorough, developer-ready feature spec through interactive Q&A, then writes it to project-management/groomed/ or project-management/in-progress/. Replaces the old plan-feature + plan-tasks pair. USE FOR: turning a planned idea into a full spec; grooming an existing planned/ file; starting implementation planning for a well-understood feature.
---

# Groom Feature

You are developing a full feature specification through iterative dialogue, one question at a time. The end goal is a detailed spec that can be handed off to any developer or agent without ambiguity.

## Inputs

The skill may be invoked with:
- **A filename from `project-management/planned/`** — read that file first and use its goal/notes as the starting context.
- **A free-form description** — treat it as the seed and begin questioning from there.
- **No argument** — read all files in `project-management/planned/`, parse each file's `**Priority:**` line, and present a numbered list sorted by priority before asking the user which feature to groom:

```
High priority:
  1. Feature Name — one-sentence goal
  2. Feature Name — one-sentence goal

Medium priority:
  3. Feature Name — one-sentence goal

Low priority:
  4. Feature Name — one-sentence goal

(unset)
  5. Feature Name — one-sentence goal
```

Ask: *"Which feature would you like to groom? Enter a number, or describe a new feature from scratch."* If the user picks a number, load that file and proceed as if it was passed as an argument. If the user describes a new feature, treat it as a free-form description and do **not** use any planned file.

If a `planned/` source file was used, read it before asking the first question.

## Questioning process

- Ask **one question at a time**. Each question should build on the previous answer and dig into a relevant detail.
- Cover: user-facing behavior, edge cases, data shapes, dependencies on existing features, constraints, and anything that would block a developer from starting.
- If a new sub-feature surfaces that is clearly out of scope, do **not** spec it here. Tell the user: *"That sounds like a separate feature — run `/create-feature` to capture it, then we can groom it independently."*
- Continue until you are confident the spec is thorough enough to hand off.

## Finalizing the spec

When the spec is ready, present a summary and ask the user to confirm.

On confirmation, ask: **"Save to `groomed/` for later, or start implementing now (`in-progress/`)?"**

### Option A — Save to groomed/
1. Derive a kebab-case slug from the feature name.
2. Write the spec to `project-management/groomed/<slug>.md` using the structure below.
3. If a source `planned/` file existed, delete it.
4. Tell the user to run `/implement-feature <slug>.md` when ready to begin.

### Option B — Start now (in-progress/)
1. Prompt the user for a filename (suggest the kebab-case slug).
2. Write the spec **and task list** to `project-management/in-progress/<filename>.md` using the structure below, including a fully populated `## Tasks` section organized into phases (see Task List Standards).
3. If a source `planned/` file existed, delete it.
4. Invoke the `implement-feature` skill with `<filename>.md` as the argument — do not just tell the user to run it manually.

## Output file structure

```markdown
# <Feature Title>

## Goal

<Concise description of the desired outcome. No implementation steps.>

## Tasks

### Phase 1 — <Short milestone description>
- [ ] Task description

### Phase 2 — <Short milestone description>
- [ ] Task description

(omit phases for maintenance/server-only features — use flat task list instead)

## Implementation Details

<Code snippets, data shapes, class definitions, constraints, and design decisions captured during grooming. This section provides context but does not dictate step-by-step instructions unless a critical restriction applies.>
```

## Task List Standards

- Each task focuses on a single outcome that can be verified — either by automated tests or a brief observable check (e.g. what to open or curl). If a piece of work is not independently verifiable, bundle it with the adjacent task(s) that complete the testable unit.
- If a bundled task becomes too large to describe in one sentence, break it into subtasks using a nested list (no checkboxes needed on subtasks — they are implementation notes, not tracked items).
- Phases end at a user-visible or testable milestone. Maintenance and server-only features may use a single flat list.
- Every answer from the Q&A that affects implementation must be captured somewhere in the spec — no context should be lost between sessions.
- Leave all task checkboxes unchecked.
- **Always append a docs-review task** as the final task of the last phase (or flat list). See below.

## Docs-Review Task (always append)

Every generated task list must end with a docs-review task. Infer which living docs are likely affected from the feature spec content, and name them explicitly in the task description:

```
- [ ] Review and update affected living docs: <comma-separated list of likely affected docs>
```

**Mapping feature scope → affected docs:**

| Feature touches… | Likely affected docs |
|---|---|
| AnyTale (characters, parts, plots, outfits) | `docs/features/anytale.md` |
| Ambient brew / sound sources | `docs/features/ambient-brew.md` |
| Main gallery, generation form, inpaint | `docs/features/main-gallery.md` |
| ComfyUI workflow config, pre/post tasks | `docs/workflow.md` |
| New or changed API endpoints | `docs/server.md` |
| New `custom-ui` components | `docs/components.md` |
| New pages (changes to `hamburger-menu.mjs`) | `docs/scaffolding.md` |
| Backend architecture, new feature domains | `docs/architecture.md` |
| Client-side patterns, component strategy | `.claude/rules/client.md` |
| Server-side patterns, domain structure | `.claude/rules/server.md` |

A feature may affect multiple docs — list all that apply. When in doubt, err toward listing more rather than fewer.

**Feature doc creation:** If the feature touches a named app section (anytale, brew, main/inpaint/workflow-editor) and that section's `docs/features/<section>.md` file does not yet exist, prepend a task before the docs-review task to create it:

```
- [ ] Create `docs/features/<section>.md` documenting the user flow, component interactions, server endpoints, and key data shapes for the <section> feature area
```

## Data Migration Tasks

If a feature changes the schema of any tracked data file (`server/config.json`, `server/database/anytale-data.json`, `server/database/media-data.json`, `server/database/brew-data.json`, `server/database/sound-sources.json`), the task list **must** include:

1. A migration script at `scripts/migrate/<domain>/<N>-to-<M>.mjs` (where `<domain>` matches the filename without `.json`, `<N>` is the current version, `<M>` is `<N>+1`).
2. A task to bump `currentVersion` for that domain in `server/core/data-versions.mjs`.

Migration scripts export a fixed interface — include this in the Implementation Details section when a migration is required:

```js
// scripts/migrate/<domain>/<N>-to-<M>.mjs
export const fromVersion = N;
export const toVersion = M;

/**
 * @param {Object} data - Parsed JSON data (do not set data.version — the migrator handles that)
 * @returns {Object} The migrated data object
 */
export function migrate(data) {
  // ... transform data ...
  return data;
}
```

The migrator (`server/core/migrator.mjs`) runs all required scripts automatically on server startup, backs up data before migrating, and restores on failure. Migration scripts do **not** set `data.version` — the migrator writes the final version after each step.

## Rules

- Do **not** modify any code.
- Do **not** write to `task.md` — the old root-level file is retired.
- Do **not** skip the conflict check when starting from scratch (no source file): briefly scan `project-management/planned/` and `project-management/groomed/` for similar features and surface any overlap before the first question.
