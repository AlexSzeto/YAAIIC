---
description: Subdivide a single goal into multiple stages of testable subgoals
---

1. **CRITICAL: This is a PURE PLANNING step.** You are strictly FORBIDDEN from writing any code, creating files, or modifying any file other than `task.md`.
2. Create a plan to implement the features in `task.md`, following the rules from `.github/copilot-instructions.md`.
3. `task.md` should only contain a title and a goal subtopic with a paragraph describing the feature that needs to be implemented. If this is not the case, **STOP**, and inform the user that the task document is currently formatted incorrectly.
4. Create a set of unchecked goals (using the `[] Objective description` format) to accomplish the objective. Limit the description to a single paragraph of text. 
5. Each individual task should be independently testable, and at the end of each task the project should be executable with its existing functions intact.
6. An exception to rule 5: If a single task is covering a significant portion of the code base (more than 2-3 files) or the effort involved to cover the goal. In that case, divide the big task into smaller tasks where each task covers a logical subsection of changes that can be manually reviewed.
7. **VERIFY: Ensure you have NOT modified any file other than `task.md`.** if you have, undo those changes immediately.