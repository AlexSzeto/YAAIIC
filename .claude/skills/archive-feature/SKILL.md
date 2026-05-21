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

3. **Determine the archive number.** List the files in `project-management/archived/` and find the highest leading number. The new file's number is that value plus one.

4. **Write the archive file.** Copy the title, goal, and all completed tasks verbatim to `project-management/archived/<number>-<filename>.md`. Preserve the full content including implementation details.

5. **Delete the in-progress file.** Remove `project-management/in-progress/<filename>.md`.

6. **Confirm.** Tell the user the feature has been archived with its assigned number and the in-progress file has been removed.
