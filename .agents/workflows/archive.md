---
description: Archive tasks and cleanup
---

When running commands on Windows, the run_command tool may append an extra quote or malform the command string, causing it to hang or fail.

To fix this, wrap the command in cmd /c and append & :: to the end. This executes the command and then executes a comment, which safely absorbs any trailing garbage characters.

Pattern:

cmd /c <your_command> & ::

Examples:

Instead of:

dir

Use:

cmd /c dir & ::

Instead of:

python main.py

Use:

cmd /c python [main.py](http://main.py) & ::

Prepare for the next set of tasks by creating a new `.md` file inside `docs/feature-history/` with an appropriately named filename based on the title text inside `task.md`, similar to other existing completed tasks. The file should start with a number indicating the order the task was completed relative to the existing files. Copy the title, goals, related notes (if any), and tasks inside `task.md` that are marked as completed verbatim into the newly created file inside `docs/feature-history/`, then delete all completed tasks in `task.md`. If there are remaining tasks, rewrite the title and goals in `task.md` to reflect the remaining tasks. If there are no remaining tasks, empty the title and goals content in `task.md` back to the following default text: