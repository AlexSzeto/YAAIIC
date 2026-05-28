---
name: implement-feature
description: Executes all tasks in a project-management/in-progress/ file phase by phase, running the full test suite at the end of each phase and stopping for user confirmation before proceeding. Replaces the old execute + execute-all pair. USE FOR: implementing a feature from an in-progress spec file; resuming a partially completed feature.
---

# Implement Feature

Execute all unchecked tasks in the specified `project-management/in-progress/<filename>.md`, following the rules in `.claude/rules/`. Work phase by phase, stopping at the end of each phase to run tests and get user confirmation.

## Invocation

The user must provide an explicit filename from `project-management/in-progress/`. If no filename is given, list the files currently in that directory and ask the user to choose one.

## Ad-hoc change protocol — runs before everything else

Whenever the user asks for a change, correction, or improvement that is not already a task in the spec file, the following sequence is **mandatory and non-negotiable**. It takes priority over all other instructions, including momentum toward implementation.

**Step 1 — Output this line before touching any file:**
> Spec update [Phase N — Fixes and Changes]: `<one-sentence task description>`

**Step 2 — Write the task to the spec file.**
Append a `#### Fixes and Changes` subheader at the end of the current phase (if one does not already exist), then add the request as a new unchecked task beneath it.

**Step 3 — Check it off immediately after completing it**, following the same Rule 1 discipline as any other task.

This protocol applies to every ad-hoc request without exception — including rollbacks, removals, renames, and "small" one-line fixes. If you find yourself about to call an edit tool without having first output the `Spec update` line and written the task, stop and do steps 1 and 2 first.

## Execution model

### Phase-based features
Tasks are organized under `### Phase N — <description>` headings. Execute all tasks within a phase before stopping.

At the end of each phase:
1. Run `npx vitest run` (full suite, not `--changed`).
2. If tests fail: read the output, identify the root cause, fix the issue, re-run until all tests pass.
3. Once tests are green, report to the user:
   - **Phase goal** — one sentence restating what this phase was meant to achieve (from the phase heading).
   - **Changes made** — brief bullet list of what was modified.
   - **Server restart required** — include this line if any file under `server/` was modified during this phase: *"Server changes were made — restart the server before testing."* Omit entirely if no server files were touched.
   - **Manual testing** — if the phase touched user-visible behavior (UI, endpoints, data), provide concrete steps the user can follow to verify it in the browser or via curl. Omit this section if the phase was purely internal (tests, refactors, migrations with no observable surface).
4. End with: *"Phase N complete. Ready to start Phase N+1?"*
5. Do not proceed until the user confirms.

### Maintenance / server-only features
Features with no phase headings (flat task list) run all tasks in a single pass, then run the full test suite at the end.

## Hard rules — never violate these

**Rule 1 — Physical file stays in sync.**
The moment a task is complete, check it off in the in-progress file immediately. Do not batch multiple checkoffs. If the session is interrupted for any reason, the file must reflect the true state of progress with no more than one task's worth of drift.

**Rule 2 — Ad-hoc protocol is mandatory (see above).**
The ad-hoc change protocol defined at the top of this skill is the enforcement mechanism for this rule. Following it is not optional even when the user's request feels small or obvious.

## After each task that modifies code

Run `npx vitest run --changed` immediately after completing any task that edits source files. Interpret the result:

- **Exit 0, no output** — no tests cover the changed files; treat as a silent pass and continue.
- **Exit 0, tests listed** — all matched tests passed; report the count and continue.
- **Non-zero exit** — tests failed. Fix the issue and re-run before moving to the next task.

Phase-end test runs use the full suite (`npx vitest run`), not `--changed`.

## Completion

When all tasks in all phases are checked off, report completion and suggest running `/archive-feature <filename>.md`.
