# Recalculate Progress

## Goals
Redo the calculation for progress for workflows: use a dynamically calculated step count instead of pre-assigning step numbers.

## Implementation Details

The step calculation should be as follows:
1. Pre generation tasks should only count tasks with the `prompt` parameter set
2. Workflow nodes should only be counted if its `class_type` is known to take substantial time (store the valid node types in a `IMPORTANT_NODE_TYPES` constant), such as `KSampler`, `VAEDecode`, etc. The algorithm now only counts nodes linearly and no longer cares about execution order.
3. Post generation tasks are counted the same way as Pre generation tasks
4. The total number of steps is the sum of pre generation tasks, workflow nodes, and post generation tasks (`totalSteps`)

During the generation:
1. Use a single counter (`currentStep`, 0 indexed) to track current step number between pre-generation, workflow, and post-generation.
2. During pre-generation, advance the counter if a prompt is processed OR skipped.
3. At the start of a prompt, its percentage should be `currentStep / totalSteps`. At the end of a prompt, its percentage should be `(currentStep + 1) / totalSteps`.
4. During comfy node processing, advance the counter if a new node started and belongs to the `IMPORTANT_NODE_TYPES` constant.
5. If a node starts and does not belong to the `IMPORTANT_NODE_TYPES` constant, change the name of the node that is reported back to the client, but do not advance progress.
6. Percentage progress between workflow nodes should still be calculated (i.e. 25% between step 1 and 2 of 5, where `currentStep = 0` and `totalSteps = 5`, the percentage should be calculated as `(progressPercent / 100 + currentStep) / totalSteps` = (25/100 + 0) / 5 = 5%)
7. At the end of the workflow, advance the counter to the number of pregeneration tasks + number of important workflow nodes, in case any important nodes were skipped.
8. During post-generation, advance the counter if a task is processed OR skipped.
9. At the start of a post-generation task, its percentage should be `currentStep / totalSteps`. At the end of a post-generation task, its percentage should be `(currentStep + 1) / totalSteps`.

## Tasks

