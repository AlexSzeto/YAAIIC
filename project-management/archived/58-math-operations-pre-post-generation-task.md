# Math Operations Pre/Post Generation Task

## Goal

Add a new `math` task type to the pre/post-generation task pipeline that applies a chain of arithmetic formulas `(value + offset) * scale + bias` (with optional rounding) to a named data field. Use this to replace the client-side WAN video frame normalization with workflow-level math tasks.

## Tasks

- [x] Update `comfyui-workflows.schema.json` to define the `mathTask` type and accept it in task arrays
- [x] Handle the `math` task type in the orchestrator's pre/post-generation task loop
- [x] Add "Math Operations" task type to the workflow editor UI
- [x] Remove `normalizeFrameCount` from the client and add equivalent math pre-generation tasks to all 4 WAN workflows
