# Documentation Drift Prevention

## Goal

Eliminate documentation drift by baking doc-review steps directly into the feature delivery loop. Living docs are reviewed and updated as part of shipping each feature, rather than relying on manual discipline after the fact.

## Implementation Details

### Living docs (updated continuously as the system evolves)
- `docs/architecture.md`
- `docs/components.md`
- `docs/server.md`
- `docs/workflow.md`
- `docs/scaffolding.md`
- `.claude/rules/client.md`
- `.claude/rules/server.md`
- `.claude/rules/planning.md`

### Historical docs (append-only, never edited after creation)
- `project-management/archived/` — preserved as development record, not navigated for feature discovery

### Target state
- `groom-feature` appends a final task to every generated task list: "Review and update affected living docs." The task description names which docs are likely affected based on the feature's scope.
- The `archive-feature` skill, before writing the history file, prompts a docs review: identifies which living docs touch the feature area and checks whether they need updating.
- A new `/update-docs` skill accepts a free-form description of what changed and reviews each living doc for staleness against it, producing a diff of suggested updates for the user to approve.

## Tasks

### Documentation Process
- [ ] Update `.claude/skills/groom-feature/SKILL.md`: append a docs-review task at the end of every generated task list. The task description names the specific living docs most likely affected by the feature (inferred from the spec content).
- [ ] Update `.claude/skills/archive-feature/SKILL.md`: before writing the history file, scan the feature's completed tasks for changes that affect living docs and surface a prompt to update them, or auto-invoke `/update-docs` if changes are clearly needed.
- [ ] Create `.claude/skills/update-docs/SKILL.md`: an agent skill that accepts a description of recent changes, reads each living doc in `docs/` and `.claude/rules/`, identifies stale sections, and proposes targeted edits for user approval.
- [ ] Do an initial pass with `/update-docs` against the current codebase state to bring all living docs up to date before this loop takes over maintenance.
