---
name: review-features
description: Reads all planned and groomed feature files and displays them in organized markdown tables. USE FOR: reviewing the feature backlog; getting an overview of what's planned vs. groomed; filtering features by category or priority. Trigger whenever the user asks to see, list, or review features, the backlog, or planned work.
---

# Review Features

Read all `.md` files from `project-management/planned/` and `project-management/groomed/` and display them as organized markdown tables.

## Step 1 — Read all feature files in parallel

Glob both directories:
- `project-management/planned/*.md`
- `project-management/groomed/*.md`

Read all matched files in parallel. For each file, extract:

- **File** — filename only (no path), e.g. `workflow-editor-fixes.md`
- **Description** — first 1–2 sentences of the `## Goal` section
- **Priority** — value from the `**Priority:**` line (`high`, `medium`, `low`); use `unknown` if absent
- **Grooming Status** — `planned` if the file is in `planned/`, `groomed` if in `groomed/`

## Step 2 — Determine mode from arguments

Check the skill arguments (if any):

| Argument | Mode |
|---|---|
| `--by-priority` or the user said "sort by priority" / "by priority" | **Priority mode** |
| `--category <name>` or a freeform category name | **Category filter mode** |
| No argument | **Default thematic mode** |

## Step 3 — Render tables

### Default thematic mode

Group features into thematic categories of your choosing. Pick category names that reflect the actual content — e.g. "AnyTale", "Workflow Editor", "Media Generation", "Infrastructure". A feature belongs to exactly one category; use judgment for borderline cases.

For each category, output a heading and a table:

```
## <Category Name>

| File | Description | Priority | Grooming Status |
|---|---|---|---|
| filename.md | One-sentence goal | high | planned |
```

### Priority mode (`--by-priority`)

Produce one table per priority level — **High**, **Medium**, **Low** — plus **Unknown** if any files lack a priority. Omit the Priority column since it's the grouping key.

```
## High

| File | Description | Grooming Status |
|---|---|---|
```

### Category filter mode

Show only the features that fit the named category, in a single table with all four columns. If no features match, say so briefly.

## Output rules

- Output only the tables and section headings — no preamble sentence, no trailing summary.
- Keep descriptions to one sentence; trim at the first period if the Goal section runs long.
- Do not modify any files.
