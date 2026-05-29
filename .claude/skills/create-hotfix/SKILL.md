---
name: create-hotfix
description: High-urgency spec creation that skips the back-and-forth Q&A of groom-feature. The user dumps everything they know in one go (ending with "that is all"), then the skill investigates the codebase, fills in missing details, and produces an editable outline. After user approval, it writes a fully groomed feature doc directly into in-progress/ and prompts the user to begin implementation immediately. USE FOR: urgent fixes or features that need to move from idea to in-progress spec in one session; situations where the user already knows most of what needs to be done and wants to skip the dialogue step.
---

# Create Hotfix

You are creating an urgent, production-ready feature spec in a single session. There is no back-and-forth discovery phase — the user will front-load their full description, you will investigate the codebase, fill in the gaps, and together you will converge on an approved outline before writing the final spec.

## Phase 1 — Intake

Open with a single prompt that sets urgency expectations:

> **Hotfix intake open.** Describe everything that needs to be done — requirements, constraints, affected areas, any implementation notes you already have. When you are done, end your message with **"that is all"**.

Then wait. Do **not** ask any clarifying questions yet. The user may send multiple messages before saying "that is all". Accumulate all of their input as the working brief.

After the user's **first message** (if it does not already contain "that is all"), acknowledge receipt and remind them:

> Got it — keep going. When you have described everything, end your message with **"that is all"**.

Continue accumulating input until the user says "that is all" (case-insensitive, anywhere in their message), then immediately proceed to Phase 2.

## Phase 2 — Codebase Investigation

Before producing the outline, silently investigate every area the user mentioned. For each relevant piece:

- Locate the relevant source files using Glob and Grep.
- Read the key sections of those files to understand current behavior, data shapes, and integration points.
- Note any constraints, patterns, or conventions that will affect implementation (e.g., existing component structure, API conventions, data schema).
- Identify anything the user did **not** specify that is needed to implement the feature (missing data shapes, unclear edge cases, undecided UI behavior, etc.).

Make a best-guess decision for every unspecified detail based on the existing codebase conventions. Do not ask the user about these — record your assumptions and surface them in the outline.

## Phase 3 — Preliminary Outline

Present the outline as a structured but informal list — not the full feature doc format yet. It must cover:

1. **Goal** — one or two sentences restating the desired outcome in your own words (verify the user agrees with the framing).
2. **Scope** — bullet list of what is in scope and, if helpful, what is explicitly out of scope.
3. **Work items** — a flat or loosely grouped list of the concrete things that need to happen (not individual tasks, but logical chunks of work). Each item should be short (one sentence) but unambiguous.
4. **Your assumptions** — a clearly labelled section listing every detail you filled in that the user did not specify. For each assumption, state what you decided and why (e.g., convention match, simplicity, existing pattern). This section must be present even if minimal.
5. **Open questions** — if anything truly cannot be resolved from the codebase or convention, list it here. Keep this short; prefer assumptions over questions.

Format the outline with plain markdown — no feature doc headers, no checkbox task lists, no phase headings. Keep it scannable. The user should be able to read the whole outline in under two minutes.

End the outline with:

> Review the outline above. Reply with any changes you want (I'll update it), or say **"approved"** to generate the final spec.

## Phase 4 — Revision Loop

Each time the user requests a change:
1. Acknowledge the change in one sentence.
2. Print only the updated item(s) — do **not** reprint the full outline. Label each with its number and title so the user can locate it.
3. End again with the same approval prompt.

If the user explicitly asks to see the full outline reprinted, do so in full. Otherwise, keep responses to only the changed items.

Repeat until the user says "approved" (case-insensitive).

## Phase 5 — Feature Doc Generation

Convert the approved outline into a feature document at the same quality and format as a groomed spec:

### Output file structure

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

<Code snippets, data shapes, class definitions, constraints, and design decisions. This section provides context but does not dictate step-by-step instructions unless a critical restriction applies.>
```

### Task list standards

Apply all standards from `groom-feature`:

- Each task focuses on a single outcome that can be verified — either by automated tests or a brief observable check. Bundle non-independently-verifiable work with adjacent tasks.
- If a bundled task is too large to describe in one sentence, use a nested subtask list (no checkboxes on subtasks).
- Phases end at a user-visible or testable milestone. Maintenance and server-only features use a flat list.
- Leave all task checkboxes unchecked.
- Capture every assumption from the outline in the Implementation Details section.

### Docs-review task (always append)

Always append as the final task:

```
- [ ] Review and update affected living docs: <comma-separated list>
```

Mapping feature scope to affected docs:

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

If the feature touches a named app section and that section's `docs/features/<section>.md` does not exist, prepend a task to create it before the docs-review task.

### Data migration tasks

If the feature changes any tracked data file (`server/database/*.json`, `config.json`), include:
1. A migration script task at `scripts/migrate/<domain>/<N>-to-<M>.mjs`.
2. A task to bump `currentVersion` in `server/core/data-versions.mjs`.

Include the migration script interface in Implementation Details:

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

### Writing the file

1. Derive a kebab-case slug from the feature title.
2. Write the spec to `project-management/in-progress/<slug>.md` using the Write tool.

### Final message

After writing the file, send exactly:

> Spec written to `project-management/in-progress/<slug>.md`. Run `/implement-feature <slug>.md` to begin work immediately.

## Rules

- Do **not** modify any source code.
- Do **not** ask questions during Phase 1 — wait for "that is all".
- Do **not** ask questions during Phase 2 — investigate and assume.
- Do **not** skip the assumptions section in the outline — even if you are highly confident, name every decision the user did not make.
- Do **not** write to `project-management/groomed/` or `project-management/planned/` — hotfixes go straight to `in-progress/`.
- Do **not** invoke `implement-feature` automatically — the user must run it manually.
