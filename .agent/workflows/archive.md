---
description: Archive tasks and cleanup
---

If `task.md` contains multiple titles:
Consolidate the features completed and recontextualize it with a single Title, and a single Goal section. Create a single Implementation Details section, but restore the original titles as subheaders for the implementation details for each feature. Consolidate all tasks under a single Task section.

1. Prepare for the next set of tasks by creating a new `.md` file inside `task-history/` with an appropriately named filename based on the title text inside `task.md`, similar to other existing completed tasks.
2. The file should start with a number indicating the order the task was completed relative to the existing files.
3. Copy the title, goals, related notes (if any), and tasks inside `task.md` that are marked as completed verbatim into the newly created file inside `task-history/`.
4. Delete all completed tasks in `task.md`.
5. If there are remaining tasks, rewrite the title and goals in `task.md` to reflect the remaining tasks.
6. If there are no remaining tasks, empty the title and goals content in `task.md` back to the following default text:

```
# Untitled
## Goals
## Implementation Details
## Tasks
```