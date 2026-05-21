---
name: execute
description: Executes tasks in task.md one at a time, pausing after each for the user to approve before proceeding. USE FOR: step-by-step execution where you want to review progress and interject additional requests between tasks.
---

# Execute Tasks Step-by-Step

Perform all unchecked tasks listed in `task.md`, keeping the rules from `.github/rules` in mind. At the completion of each task, check off the item, stop, and wait for me to say 'begin next task' before starting the next task. If any task requires code change, I will request it instead of giving the 'continue' command. For these instances of additional requests, add new numbered subtasks under the relevant task in `task.md` to document the additional work that is being done.

## After each task that modifies code

Run `npx vitest run --changed` immediately after completing any task that edits source files. Interpret the result as follows:

- **Exit 0, no output** – no tests cover the changed files; treat as a silent pass and continue normally.
- **Exit 0, tests listed** – all matched tests passed; report the count and continue.
- **Non-zero exit** – tests failed. Read the failure output, identify the root cause, fix the issue immediately, then re-run `npx vitest run --changed`. Repeat until all matched tests pass before stopping to wait for the user.
