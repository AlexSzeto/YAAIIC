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

Afterwards, create subtasks for the main tasks according to the following instructions, as duplicated from `plan-subtasks.md`:

1. **CRITICAL: This is a PURE PLANNING step.** You are strictly FORBIDDEN from writing any code, creating files, or modifying any file other than `task.md`.
2. Create a plan to implement the features in `task.md`, following the rules from `.github/copilot-instructions.md`.
3. Do not modify existing, completed tasks.
4. Occasionally, some of the tasks would be pre-filled with numbered subtasks. Do not modify these pre-existing subtasks unless there are mistakes that should be corrected, but additional subtasks may be added to fully complete the task.
5. If the task calls for the creation of data formats, list the planned data format as code blocks within the subtask in `task.md`.
6. For new components or libraries, create a code block in `task.md` and list the name of its planned public and private methods, with comments describing its functionalities.
7. Do not include tests in the implementation.
8. In the same format, write the implementation plan back into `task.md`.
9. Leave all items as unchecked/incomplete.
10. **VERIFY: Ensure you have NOT modified any file other than `task.md`.** if you have, undo those changes immediately.