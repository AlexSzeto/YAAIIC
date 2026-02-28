---
description: Implment tasks one by one until the feature is complete
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

Perform all unchecked tasks listed in `task.md`, keeping the rules from `.github/rules.md` in mind. At the completion of each task, check off the item, stop, and wait for me to say 'begin next task' before starting the next task. If any task requires code change, I will request it instead of giving the 'continue' command. For these instances of additional requests, add new numbered subtasks under the relevant task in `task.md` to document the additional work that is being done.