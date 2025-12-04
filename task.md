# Bug Cleanup for Generation and Progress UI

## Goals
Fix remaining outstanding bugs, clean up exception handling, and modify the progress UI to take up less space.

[] Gracefully fail out using SSE when the generation process fails
>>NOTE: Failures like the exception below needs to send a SSE to the client indicating the generation process had failed, and the client should gracefully close up the progress bar
```
Error in task task_1764871312524_04n4ns0xg: Error: ComfyUI request failed: 400 Bad Request
    at processGenerationTask (file:///mnt/dev-240/YAAIIC/server/generate.mjs:490:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
SSE client connected for task task_1764871312524_04n4ns0xg
```

[] Gracefully time out if there's no incoming response from the server.

[] In `createProgressResponse()` in `generate.mjs`, cross reference `currentStep` with the step Id in the task's associated workflow JSON and extract its `_meta.title` to send to the client

[] Adjust the layout of the progress indicator as follows:
- Move the indicator to the bottom right of the viewport, and use a toast-like floating window.
- Fix the progress bar so it actually colors in the current progress as the task is being completed.