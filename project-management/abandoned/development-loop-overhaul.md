# Development Loop Overhaul

## Goal

Eliminate the two chronic maintenance gaps in the current feature delivery loop: an unstructured feature backlog with no lifecycle tracking, and documentation that drifts silently after every feature ships. Both are solved by baking status tracking and documentation review directly into the existing skills rather than relying on manual discipline.

## Implementation Details

### Problem 1 — Unstructured feature backlog

Currently:
- `plan.md` accumulates ideas with no lifecycle tracking
- `docs/groomed-features/` files have no status field — abandoned, pending, and in-progress specs look identical
- The `plan-feature` skill ends by writing to `task.md`; the user manually copies to `groomed-features/` if they want to preserve a spec for later
- No way to survey what is queued without reading every file

Target state:
- Every file in `docs/groomed-features/` carries YAML frontmatter with a `status` field: `draft`, `groomed`, `in-progress`, or `abandoned`
- `plan-feature` writes its output directly to `docs/groomed-features/<slug>.md` with `status: groomed` — `task.md` is only populated when execution begins
- The `archive` skill marks the source groomed-feature `status: archived` instead of leaving it unchanged
- A new `/backlog` skill lists all groomed features grouped by status, surfacing what is ready to pick up next
- `plan.md` is demoted to a raw scratchpad — ideas that get shaped into a spec move to groomed-features; ideas that don't get pruned

### Problem 2 — Documentation drift

Living docs (updated continuously as the system evolves):
- `docs/architecture.md`
- `docs/components.md`
- `docs/server.md`
- `docs/workflow.md`
- `docs/scaffolding.md`
- `.claude/rules/client.md`
- `.claude/rules/server.md`
- `.claude/rules/planning.md`

Historical docs (append-only, never edited after creation):
- `docs/feature-history/` — preserved as development record, not navigated for feature discovery

Target state:
- `plan-tasks` appends a final task to every generated task list: "Review and update affected living docs." The task description names which docs are likely affected based on the feature's scope.
- The `archive` skill, before writing the history file, prompts a docs review: identifies which living docs touch the feature area and checks whether they need updating.
- A new `/update-docs` skill accepts a free-form description of what changed and reviews each living doc for staleness against it, producing a diff of suggested updates for the user to approve.

## Tasks

### Backlog Organization
- [ ] Add YAML frontmatter (`status: groomed`) to all existing files in `docs/groomed-features/` that are still pending. Mark any known-abandoned specs as `status: abandoned`.
- [ ] Update `.claude/skills/plan-feature/SKILL.md`: after spec confirmation, write output to `docs/groomed-features/<kebab-slug>.md` with `status: groomed` frontmatter instead of writing to `task.md`. Prompt the user to run `/execute` or `/execute-all` to begin, which will copy the spec into `task.md` and mark the groomed-feature `status: in-progress`.
- [ ] Update `.claude/skills/plan-tasks/SKILL.md`: when compiling to `task.md`, also mark the source groomed-feature file (if one exists) as `status: in-progress`.
- [ ] Update `.claude/skills/archive/SKILL.md`: after writing the history file, update the source groomed-feature file's frontmatter to `status: archived`.
- [ ] Create `.claude/skills/backlog/SKILL.md`: reads all files in `docs/groomed-features/`, groups them by `status`, and outputs a summary list. Features with `status: groomed` are highlighted as ready to pick up.

### Documentation Process
- [ ] Update `.claude/skills/plan-tasks/SKILL.md`: append a docs-review task at the end of every generated task list. The task names the specific living docs most likely affected by the feature (inferred from the spec content).
- [ ] Update `.claude/skills/archive/SKILL.md`: before writing the history file, scan the feature's completed tasks for changes that affect living docs and surface a prompt to update them, or auto-invoke `/update-docs` if changes are clearly needed.
- [ ] Create `.claude/skills/update-docs/SKILL.md`: an agent skill that accepts a description of recent changes, reads each living doc in `docs/` and `.claude/rules/`, identifies stale sections, and proposes targeted edits for user approval.
- [ ] Do an initial pass with `/update-docs` against the current codebase state to bring all living docs up to date before this loop takes over maintenance.
