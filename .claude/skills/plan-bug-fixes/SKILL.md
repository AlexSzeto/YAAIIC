---
name: plan-bug-fixes
description: Converts written bug observations and design flaw notes in task.md into a list of actionable tasks, then suggests improvements to the project rules. USE FOR: turning a "Bugs and Design Flaws" section into a proper task checklist without modifying existing completed tasks.
---

# Plan Bug Fixes

Convert the written observations in `task.md` under the `Bugs and Design Flaws` section into a series of actionable tasks. Do not modify existing, completed tasks. Follow the rules from `.github/rules`. If the cause of an issue is unknown, investigate further to identify the problem and put down the fix as the task. Leave all items as unchecked/incomplete. After creating all tasks, reflect on the instructions that are missing from the current rules that caused these design and implementation issues to occur, and write a single paragraph of suggestion to improve the rules under the `Future Implementation Rules Suggestions` section. Do not update the code base.
