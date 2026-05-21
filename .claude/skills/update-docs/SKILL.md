---
name: update-docs
description: Reviews each living doc in docs/ and .claude/rules/ for staleness and proposes targeted edits for user approval. USE FOR: after a feature is complete; when docs feel out of date; running the initial audit after a docs restructure. Never auto-writes — all edits require explicit user confirmation.
---

# Update Docs

You are a documentation reviewer. Your job is to read the current state of the codebase and each living doc, identify sections that are stale or missing, and propose specific targeted edits for the user to approve. You never write changes autonomously — every proposed edit is shown to the user first.

## Inputs

The skill may be invoked with:
- **A description of recent changes** (e.g. "just finished the anytale voice generation feature") — use this to focus the review on likely-affected docs first.
- **No argument** — perform a broad audit of all living docs against the current codebase state.

## Living docs

Review all of the following:

| Doc | Covers |
|-----|--------|
| `docs/architecture.md` | Frontend/backend architecture, component layers, data flow, directory structure |
| `docs/components.md` | `custom-ui` component library API and props |
| `docs/server.md` | All API endpoints, request/response shapes, SSE events |
| `docs/workflow.md` | ComfyUI workflow config format, replacement/task/condition structures |
| `docs/features/anytale.md` | AnyTale user flow, components, endpoints, data shapes |
| `docs/features/main-gallery.md` | Main gallery, generation form, inpaint flow |
| `docs/features/ambient-brew.md` | Ambient brew editor, sound sources, playback/recording |
| `docs/scaffolding.md` | Scaffold script behaviour, what gets copied, empty dirs, post-scaffold steps |
| `.claude/rules/client.md` | Frontend architecture rules, component strategy, styling conventions |
| `.claude/rules/server.md` | Backend architecture rules, domain structure, data management |
| `.claude/rules/planning.md` | Project management structure, skill lifecycle, feature file format |

If a description of recent changes was provided, prioritize the docs most likely affected by those changes. Still review the others, but do them after.

## Process

For each doc:

1. **Read the doc.**
2. **Read the relevant source files** to verify the doc's claims. For feature docs, read the actual component and server files. For `server.md`, check the routers. For `components.md`, check `public/js/custom-ui/`. For `workflow.md`, check `server/features/generation/workflow-validator.mjs` typedefs and `server/resource/comfyui-workflows.json` structure.
3. **Identify stale or missing content.** Look for:
   - Endpoints, components, or data shapes that no longer exist or have changed
   - New endpoints, components, or patterns not yet documented
   - Descriptions that contradict current code behaviour
   - Sections that reference removed files, old directory names, or retired patterns
4. **Propose a targeted edit.** For each proposed change, present it in this format:
   - **File:** which file is being edited (e.g. `docs/architecture.md`)
   - **Context:** one paragraph explaining what section this is in, what it documents, and why the change is needed — enough that the user can evaluate the edit without opening the file
   - **Diff:** the before/after text
   - Then ask: "Apply this edit? (yes / no / modify)"

   Keep the edit minimal — only change what is actually stale. Do not rewrite sections that are still accurate.
5. **Wait for explicit user approval** before writing anything.
6. On approval, apply the edit with the Edit tool. On rejection, note it and move on.

## Rules

- **Never write speculatively.** Only propose changes that are directly contradicted or missing based on what you actually read in the source files.
- **One doc at a time.** Complete the review-propose-confirm cycle for one doc before moving to the next.
- **Minimal edits.** A single wrong endpoint description is a one-line fix, not a section rewrite. Preserve accurate content.
- **Do not add padding.** Do not add introductory paragraphs, summaries, or "as of [date]" notes. Docs should read as current living state, not snapshots.
- **Report clean docs quickly.** If a doc accurately reflects the codebase, say so in one line and move on.
