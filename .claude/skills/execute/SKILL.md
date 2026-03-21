---
name: execute
description: Executes tasks in task.md one at a time, pausing after each for the user to approve before proceeding. USE FOR: step-by-step execution where you want to review progress and interject additional requests between tasks.
---

# Execute Tasks Step-by-Step

Perform all unchecked tasks listed in `task.md`, keeping the rules from `.github/rules` in mind. At the completion of each task, check off the item, stop, and wait for me to say 'begin next task' before starting the next task. If any task requires code change, I will request it instead of giving the 'continue' command. For these instances of additional requests, add new numbered subtasks under the relevant task in `task.md` to document the additional work that is being done.
