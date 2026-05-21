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
- **No argument** — ask the user for a one-sentence description of the feature to build.

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
4. Tell the user to run `/implement-feature <filename>.md` to begin.

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

## Rules

- Do **not** modify any code.
- Do **not** write to `task.md` — the old root-level file is retired.
- Do **not** skip the conflict check when starting from scratch (no source file): briefly scan `project-management/planned/` and `project-management/groomed/` for similar features and surface any overlap before the first question.
