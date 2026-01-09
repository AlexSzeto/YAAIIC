# Per Workflow Post Processing Customization
## Goals
Change the global post generation tasks to only be used for upload/regenerate functions, and let each workflow define its own post generation tasks.

## Tasks
- [x] Refactor `comfyui-workflows.json` to move global post generation tasks
    - Read `server/resource/comfyui-workflows.json`.
    - Rename the root level `postGenerationTasks` property to `defaultImageGenerationTasks`.
    - Iterate through each workflow in the `workflows` array and add the `postGenerationTasks` array (copied from the original root level) to the workflow object.
    - Planned structure change for `server/resource/comfyui-workflows.json`:
        ```json
        {
          "defaultImageGenerationTasks": [ ... ], // Renamed from postGenerationTasks
          "workflows": [
            {
              "name": "example_workflow",
              "postGenerationTasks": [ ... ] // Added copy of original global tasks
            }
          ]
        }
        ```
- [x] Update `server/server.mjs` to respect workflow-specific tasks
    - In the `/generate` endpoint, remove the code block that manually injects global `postGenerationTasks` into `workflowData` (around line 276).
    - In the `/regenerate` endpoint (around line 651), change `comfyuiWorkflows.postGenerationTasks` to `comfyuiWorkflows.defaultImageGenerationTasks`.
- [x] Update `server/generate.mjs` to use default tasks for uploads
    - In `processUploadTask` (around line 331), change the property access `workflowsConfig.postGenerationTasks` to `workflowsConfig.defaultImageGenerationTasks`.
