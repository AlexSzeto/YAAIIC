---
name: archive-feature
description: Archives a completed in-progress feature file to project-management/archived/. Replaces the old archive skill. USE FOR: after all tasks in an in-progress file are checked off; closing out a completed feature before starting the next one.
---

# Archive Feature

Move a completed feature from `project-management/in-progress/` to `project-management/archived/`.

## Invocation

The user must provide an explicit filename from `project-management/in-progress/`. If no filename is given, list the files currently in that directory and ask the user to choose one.

## Steps

1. **Read the in-progress file.** Verify it exists at `project-management/in-progress/<filename>.md`.

2. **Check for incomplete tasks.** If any tasks remain unchecked, surface them and ask the user how to proceed before continuing:
   - **Complete them now** — implement the remaining tasks, then return to this step.
   - **Drop them** — remove them from the file before archiving.
   - **Move them** — create or append to a new in-progress file for a follow-on feature.

3. **Run the archive script.** Execute:
   ```
   node scripts/archive-feature.mjs <filename>
   ```
   This script determines the next archive number, copies the file to `project-management/archived/<number>-<filename>`, and deletes the in-progress file in a single atomic operation.

4. **Confirm.** Report the archive number and filename printed by the script.
