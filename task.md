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

[x] Implement Dynamic Step Count Calculation

1. Create `IMPORTANT_NODE_TYPES` constant in server/generate.mjs to define workflow node types that take substantial time
   ```javascript
   // In server/generate.mjs
   const IMPORTANT_NODE_TYPES = [
     'KSampler',
     'VAEDecode',
     'VAEEncode',
     // ... other time-consuming node types
   ];
   ```

2. Create function `calculateTotalSteps(preGenTasks, workflowNodes, postGenTasks)` to calculate total steps dynamically
   ```javascript
   /**
    * Calculate the total number of steps for progress tracking
    * @param {Array} preGenTasks - Pre-generation tasks
    * @param {Array} workflowNodes - Workflow nodes from ComfyUI
    * @param {Array} postGenTasks - Post-generation tasks
    * @returns {number} Total step count
    */
   function calculateTotalSteps(preGenTasks, workflowNodes, postGenTasks) {
     // Count pre-gen tasks with prompt parameter
     // Count workflow nodes that match IMPORTANT_NODE_TYPES
     // Count post-gen tasks with prompt parameter
     // Return sum
   }
   ```

3. Update pre-generation task counting logic to only count tasks with `prompt` parameter set

4. Update workflow node counting logic to only count nodes with `class_type` in `IMPORTANT_NODE_TYPES` (linear counting, no execution order)

5. Update post-generation task counting logic to match pre-generation counting (only tasks with `prompt` parameter)

[x] Implement Single Counter Progress Tracking

6. Initialize `currentStep` counter (0-indexed) at the start of generation process

7. Store `totalSteps` value calculated from step calculation function

8. Update pre-generation progress reporting:
   - Advance `currentStep` counter when a prompt is processed OR skipped
   - Calculate start percentage as `currentStep / totalSteps`
   - Calculate end percentage as `(currentStep + 1) / totalSteps`

9. Update ComfyUI node progress reporting:
   - Advance `currentStep` counter only when node belongs to `IMPORTANT_NODE_TYPES`
   - For non-important nodes, update node name in report but do not advance counter
   - Calculate percentage as `(progressPercent / 100 + currentStep) / totalSteps` during node processing

10. Add logic at end of workflow execution to advance counter to `preGenTaskCount + importantNodeCount` to account for any skipped important nodes

11. Update post-generation progress reporting:
    - Advance `currentStep` counter when a task is processed OR skipped
    - Calculate start percentage as `currentStep / totalSteps`
    - Calculate end percentage as `(currentStep + 1) / totalSteps`

[x] Update Progress Event Emission

12. Modify all progress event emissions to use the new calculation methodology

13. Ensure progress percentages are properly converted to 0-100 range for client display

14. Verify that progress events maintain backward compatibility with existing SSE structure

