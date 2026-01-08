# Per Workflow Post Processing Customization
## Goals
Change the global post generation tasks to only be used for upload/regenerate functions, and let each workflow define its own post generation tasks.

## Tasks
- [ ] Copy the post generation tasks in `comfyui-workflows.json` from the root level to each existing workflow as `postGenerationTasks`.
- [ ] Rename the root level `postGenerationTasks` to `defaultPostGenerationTasks`.
- [ ] Update the server generation process to use the workflow's `postGenerationTasks` if it exists.
- [ ] Update the upload/regenerate process to use the global `defaultPostGenerationTasks`.