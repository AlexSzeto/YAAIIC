---
name: plan-tasks
description: Compiles a completed feature brainstorming session into a comprehensive, developer-ready task list in task.md. USE FOR: after finishing a feature planning discussion and needing to write the formal task checklist.
---

# Plan Tasks (Compile Spec to task.md)

Now that we've wrapped up the brainstorming process, compile our findings into a comprehensive, developer-ready specification in `task.md`. Do not modify existing, completed tasks. Follow the rules from `.github/rules`. Prioritize best practices, incremental progress, and early testing, ensuring no big jumps in complexity between tasks. Make sure that the answer for every query is captured somewhere in the design, so that context is not lost if the tasks are being handed over to different agents or divided into multiple sessions. Make sure that the code created for each task is exposed through the existing UI for client side additions, or provide curls to test endpoints if the addition is server-side, creating temporary scaffolding if necessary. For all testing, include instructions for manual tests only. Leave all items as unchecked/incomplete. Do not update the code base.
