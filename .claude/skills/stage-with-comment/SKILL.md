---
name: stage-with-comment
description: "Stages all codebase changes and outputs a suggested commit message. USE FOR: after editing files; after completing tasks; after any code change in a session; at the end of an execute or execute-all run; whenever the codebase is modified. Auto-invoked after every codebase change — always run this after editing, creating, or deleting files. Derives the commit message from newly checked tasks in task.md, or from the context of what was just changed if task.md has no relevant completed items."
argument-hint: "Optional: override or supplement the commit message"
---

# Commit Changes

Stage all current codebase changes and output a meaningful commit message derived from recently completed tasks or the context of what was changed. Does **not** run `git commit`.

## When to Invoke

This skill should be invoked **automatically by the model** at the end of any turn that modifies files — whether from an individual request or as the final step of an `execute` / `execute-all` run. It is also available as a manual slash command.

## Procedure

### 1. Check for Changes

Run `git status --short` to detect staged and unstaged changes.

- If there are no changes, output: "Nothing to commit." and stop.

### 2. Determine Commit Message

Apply these rules in order, using the first source that yields a meaningful message:

**A. task.md newly-checked items** — Read `task.md`. Look for tasks that were checked (`[x]`) as part of the current session. Summarise those tasks into a concise imperative phrase (e.g. `add drag-and-drop list rearrangement`). Use multiple phrases joined by `;` if more than one distinct task was completed.

**B. Skill argument** — If the user supplied text as a skill argument, use it directly as the commit message (apply light formatting: lowercase first word, trim trailing punctuation).

**C. Context of changes** — If neither source is available, run `git diff --cached --stat` and `git diff --stat` to see which files changed, then write a short phrase describing what was changed (e.g. `update theme constants in dynamic list`). Keep it under 72 characters.

**D. Fallback** — If none of the above yields specifics, use `update` as the message. This is a last resort only.

### 3. Stage All Changes

Run:
```
git add -A
```

### 4. Output Message

Output the commit message in this format:
> Commit message: `<message>`

Do **not** run `git commit`.

## Commit Message Style

- Imperative mood, lowercase, no trailing period (e.g. `add breadcrumb scroll fix`, `fix autocomplete positioning`)
- 50 characters or fewer for the subject
- No generic words alone: `fix`, `update`, `cleanup`, `misc`, `wip` are only acceptable as qualifiers alongside a specific subject (e.g. `fix tag selector scroll`)
- When multiple tasks are summarised, join with `;` (e.g. `add floating panels; fix drag behaviour`)

## Completion Check

- Commit message is specific and describes what actually changed
- User received a one-line message output
- All changes are staged (`git add -A` was run)
- No `git commit` was run
