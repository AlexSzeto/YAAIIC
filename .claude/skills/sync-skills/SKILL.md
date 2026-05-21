---
name: sync-skills
description: "Keep project-local skills for other agents synchronized from this repository's .claude skills. Use when .claude/skills changes, when Codex skills are stale, or when preparing this project so Codex can use the same project workflow skills as Claude."
---

# Sync Skills

Treat `.claude/skills` and `.claude/rules` as the canonical sources for project workflow instructions.

Run:

```bash
npm run sync:codex-skills
npm run sync:antigravity-skills
```

This regenerates `.codex/skills`, `.agents/skills`, `.codex/rules`, and `.agents/rules` from `.claude/skills` and `.claude/rules` by deleting the project-local mirrors and copying the Claude sources into them.

This also regenerates `.agents/skills` and `.agents/rules` from `.claude/skills` and `.claude/rules` by deleting the project-local mirrors and copying the Claude sources into them.

After syncing, run:

```powershell
git status --short
```

Review the copied skill changes before committing.
