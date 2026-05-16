---
name: stage-and-commit
description: "Stages all codebase changes, generates a commit message, and commits. USE FOR: after editing files; after completing tasks; after any code change in a session; at the end of an execute or execute-all run; whenever the codebase is modified. Auto-invoked after every codebase change — always run this after editing, creating, or deleting files. Derives the commit message from newly checked tasks in task.md, or from the context of what was just changed if task.md has no relevant completed items. When auto-invoked by the model, always ask the user to confirm before committing. When the user explicitly triggers this skill (e.g. typed /stage-and-commit), commit immediately without asking."
---

# Stage and Commit

Stage all current codebase changes, generate a meaningful commit message, then commit — either immediately (if the user explicitly triggered this skill) or after user approval (if auto-invoked by the model).

## When to Invoke

This skill should be invoked **automatically by the model** at the end of any turn that modifies files — whether from an individual request or as the final step of an `execute` / `execute-all` run. It is also available as a manual slash command (`/stage-and-commit`).

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

### 4. Determine Whether to Commit Immediately or Ask

**If the user explicitly triggered this skill** (they typed `/stage-and-commit` or directly asked to commit), proceed to Step 5 immediately.

**If this skill was auto-invoked by the model** (after editing files, at the end of a task run, etc.), output the proposed commit message and ask for approval:

> Commit message: `<message>`
> Ready to commit? (yes / no)

Wait for the user's response before continuing. If they say no or provide a revised message, update the commit message accordingly or stop if they decline.

### 5. Commit

Run:
```
git commit -m "<message>"
```

Output confirmation:
> Committed: `<message>`

## Commit Message Style

- Imperative mood, lowercase, no trailing period (e.g. `add breadcrumb scroll fix`, `fix autocomplete positioning`)
- 50 characters or fewer for the subject
- No generic words alone: `fix`, `update`, `cleanup`, `misc`, `wip` are only acceptable as qualifiers alongside a specific subject (e.g. `fix tag selector scroll`)
- When multiple tasks are summarised, join with `;` (e.g. `add floating panels; fix drag behaviour`)

## Completion Check

- Commit message is specific and describes what actually changed
- All changes are staged (`git add -A` was run)
- `git commit` was run with the message
- If auto-invoked, user approved before the commit happened
