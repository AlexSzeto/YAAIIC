# Generation Progress Improvements

**Priority:** low

## Goal

Make generation progress tracking accurate and resilient: evaluate post-generation task booleans at generation start time so step counts are predicted correctly before the run begins; allow pre/post-generation processes (workflows, frame blend, etc.) to report granular progress; and enable clients that connect mid-generation to receive current progress state and correctly lock/show the in-progress workflow.

## Notes

- Step prediction: booleans that gate post-generation tasks should be captured at queue time, not evaluated lazily during execution.
- Per-process progress: workflows should report completion percentage; frame blend should derive percentage from current frame index.
- Reconnect recovery: a client joining a workflow already in progress should receive the current progress snapshot via SSE and enter the same locked/progress UI state as existing clients.
