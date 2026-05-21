---
name: execute-all
description: Executes all unchecked tasks listed in task.md in a single continuous pass, checking off each task upon completion. USE FOR: running through the entire task list without stopping between tasks.
---

# Execute All Tasks

Perform all unchecked tasks listed in `task.md`, keeping the rules from `.github/rules` in mind. At the completion of each task, whether it has been fully tested or not, check off the item in `task.md` so we understand that the work is complete. Repeat this until all tasks are completed, and suggest how each of the implemented features can be manually tested.

## After each task that modifies code

Run `npx vitest run --changed` immediately after completing any task that edits source files. Interpret the result as follows:

- **Exit 0, no output** – no tests cover the changed files; treat as a silent pass and continue to the next task.
- **Exit 0, tests listed** – all matched tests passed; report the count and continue to the next task.
- **Non-zero exit** – tests failed. Read the failure output, identify the root cause, fix the issue immediately, then re-run `npx vitest run --changed`. Repeat until all matched tests pass before continuing to the next task.
