---
name: implement-feature
description: Executes all tasks in a project-management/in-progress/ file phase by phase, running the full test suite at the end of each phase and stopping for user confirmation before proceeding. Replaces the old execute + execute-all pair. USE FOR: implementing a feature from an in-progress spec file; resuming a partially completed feature.
---

# Implement Feature

Execute all unchecked tasks in the specified `project-management/in-progress/<filename>.md`, following the rules in `.claude/rules/`. Work phase by phase, stopping at the end of each phase to run tests and get user confirmation.

## Invocation

The user must provide an explicit filename from `project-management/in-progress/`. If no filename is given, list the files currently in that directory and ask the user to choose one.

## Execution model

### Phase-based features
Tasks are organized under `### Phase N — <description>` headings. Execute all tasks within a phase before stopping.

At the end of each phase:
1. Run `npx vitest run` (full suite, not `--changed`).
2. If tests fail: read the output, identify the root cause, fix the issue, re-run until all tests pass.
3. Once tests are green, stop and prompt the user: *"Phase N complete. Ready to start Phase N+1?"*
4. Do not proceed until the user confirms.

### Maintenance / server-only features
Features with no phase headings (flat task list) run all tasks in a single pass, then run the full test suite at the end.

## Hard rules — never violate these

**Rule 1 — Physical file stays in sync.**
The moment a task is complete, check it off in the in-progress file immediately. Do not batch multiple checkoffs. If the session is interrupted for any reason, the file must reflect the true state of progress with no more than one task's worth of drift.

**Rule 2 — Ad-hoc requests go into the file first.**
If the user asks for a change, fix, or improvement while implementation is in progress:
1. Append a `#### Fixes and Changes` subheader at the end of the current phase (if one does not already exist).
2. Write the request as a new unchecked task under that subheader.
3. Only then make any code changes.
This rule applies even for small one-line fixes.

## After each task that modifies code

Run `npx vitest run --changed` immediately after completing any task that edits source files. Interpret the result:

- **Exit 0, no output** — no tests cover the changed files; treat as a silent pass and continue.
- **Exit 0, tests listed** — all matched tests passed; report the count and continue.
- **Non-zero exit** — tests failed. Fix the issue and re-run before moving to the next task.

Phase-end test runs use the full suite (`npx vitest run`), not `--changed`.

## Completion

When all tasks in all phases are checked off, report completion and suggest running `/archive-feature <filename>.md`.
