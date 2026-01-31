---
description: Plan, Record, and Execute Unplanned Tasks.
---

1. Wait for the user to describe the next task to be performed.
2. Plan out the implementation involved to complete the task, then record the steps as a new unfinished task in `task.md`, and place it before the first unfinished task remaining on the list of tasks under the section titled "Tasks".
3. Perform the newly added tasks in `task.md`, keeping the rules from `.github/copilot-instructions.md` in mind.
4. At the completion of each task, check off the item, stop, and return to step one to prompt the user for further instructions. 

NOTE:

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