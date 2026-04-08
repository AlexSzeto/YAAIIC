---
name: adhoc
description: Iterative ad-hoc task planning and execution cycle. Prompts for a new task description, plans and records it in task.md, executes the work, then repeats. USE FOR: when you want to plan and execute tasks one at a time in a continuous loop, waiting for user input between iterations.
---

# Ad-hoc Task Cycle

1. Wait for the user to describe the next task to be performed.
2. Plan out the implementation involved to complete the task, then record the steps as a new unfinished task in `task.md`, and place it before the first unfinished task remaining on the list of tasks under the section titled "Tasks".
3. Perform the newly added tasks in `task.md`, keeping the rules from `.github/rules` in mind.
4. At the completion of each task, check off the item, stop, and return to step one to prompt the user for the next task, repeating the planning and execution cycle.
