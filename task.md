# Bug Fixes

## Goals
Address the accumulated non essential bugs and tech debts from the most recent round of features.

## Tasks
[x] Add a sent prompt log similar to sent-workflow.json.

> Unlike sent-workflow, at the start of a task, delete the content of sent-prompt.json. Then, for every prompt sent, open sent-prompt.json, add the data for the prompt sent to the end of the file, and write back to the file. Come up with a data format that makes sense for the data being sent and that multiple prompts may be logged in a single task. Be sure to take care of the case if the logs folder or sent-prompt.json doesn't exist.

1. Modify `server/generate.mjs` to add sent-prompt logging in the `processGenerationTask` function at the start of the task
2. Create the logs directory if it doesn't exist, and clear or create `logs/sent-prompt.json` with an empty array
3. Modify `sendTextPrompt` and `sendImagePrompt` functions in `server/llm.mjs` to log each prompt sent
4. Add logging logic that reads the current `sent-prompt.json`, appends the new prompt data, and writes it back

```json
// Format for sent-prompt.json
[
  {
    "timestamp": "2025-12-28T10:30:00.000Z",
    "type": "text",
    "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
    "prompt": "Write a description...",
    "to": "description",
    "response": "The generated response text"
  },
  {
    "timestamp": "2025-12-28T10:30:05.000Z",
    "type": "image",
    "model": "huihui_ai/qwen3-vl-abliterated:8b-instruct",
    "imagePath": "/path/to/image.png",
    "prompt": "Describe this image...",
    "to": "summary",
    "response": "The generated response text"
  }
]
```

[x] Fix the bug where certain regeneration tasks may be missing context.

> NOTE: Task skipped. Bug was caused by other missing data (i.e. summary is empty when tag is being regenerated. Will address this in a future fix.)

> Modify the shape of the regenerate endpoint so it requires the full generation data object. This might aid in certain regeneration tasks that requires text replacement from existing data.

1. Update the `/regenerate` endpoint in `server/server.mjs` to accept a `generationData` object instead of just `uid` and `fields`
2. Modify the request body validation to check for `generationData` and extract the `uid` and `fields` from it
3. Update the regeneration logic to use fields from `generationData` instead of looking them up from the database
4. Add reconstruction of the `savePath` from `imageUrl` in the `generationData` object
5. Modify `server/llm.mjs`'s `modifyDataWithPrompt` function to support text replacement from `generationData` fields (e.g., using `[description]` in prompts)
6. Update the client-side code that calls the `/regenerate` endpoint to send the full `generationData` object

[x] Refactor postGenerationTasks out of config.json into comfyui-workflow.json. Remove the entry from the default file.

1. Add `postGenerationTasks` array at the root level of `server/resource/comfyui-workflows.json`, next to `workflows`.
2. Modify `server/server.mjs` to load and read the global `postGenerationTasks` from `comfyui-workflows.json` instead of from `config.json`
3. Update the code in `server/server.mjs` that adds `postGenerationTasks` to `workflowData` to use the value from the loaded comfyui-workflows data
4. No changes needed to `server/generate.mjs` since it already receives `postGenerationTasks` through `workflowConfig`
5. Remove `postGenerationTasks` from `server/config.json`
6. Remove `postGenerationTasks` from `server/config.default.json`

[x] Change the output shape at the end of the generation task so it sends the entire generationData object regardless of what is in it.

> Fields that originally exist outside of generation data, and conditionals that assigns default values to certain generation data fields, should be added to generationData before it's written in the image database. Remove code that has to name specific fields to send to and from the client for generation data.

1. In `server/generate.mjs`, modify `processGenerationTask` to add all necessary fields to `generationData` before saving
2. Add fields like `workflow`, `inpaint`, `inpaintArea`, `uid`, `timeTaken`, `imageUrl` to `generationData` before database entry
3. Modify `addImageDataEntry` call to pass the entire `generationData` object instead of constructing a separate object
4. Update `emitTaskCompletion` to send the entire `generationData` object instead of individual fields
5. Update client-side SSE handlers to expect `generationData` in completion events
6. Update the `/regenerate` endpoint completion message to use `generationData` structure

[x] Remove the orientation form field and force all workflows to send orientation.

> On the client side the orientation form field and either expect it as a workflow input, or in the case of "detect", send "portrait" if height > width and "landscape" otherwise (this includes square dimensions). This means that workflows returned from the workflow list will need to send the "orientation" data as well.

1. Remove the orientation `Select` component from `public/js/app-ui/generation-form.mjs` (only remove it from the video controls section if it exists)
2. Add `orientation` field to the workflow data returned by the `/generate/workflows` endpoint in `server/server.mjs`
3. In the client-side generation logic (in `public/js/app.mjs`), add logic to determine orientation before sending the generation request:
   - If workflow has `orientation: "detect"`, calculate based on image dimensions (portrait if height > width, landscape otherwise)
   - Otherwise, use the workflow's specified orientation
4. Ensure the orientation value is sent in the generation request body
5. Update the form state management to remove orientation as a user-editable field

[x] Refactor all workflow data sent to the client from the workflow list, other than "name", to go inside an "options" object.

> Modify the structure in `comfyui-workflow.json` directly, and modify the server code to accommodate the shape change. For future feature implementations, it would be implied that anything added to the "options" section of the workflow data would be sent to the client without additional code.

1. Restructure each workflow in `server/resource/comfyui-workflows.json` to nest client-facing fields inside an "options" object
2. Keep server-only fields (`base`, `format`, `finalNode`, `replace`, `upload`, `extractOutputPathFromTextFile`) at the root level
3. Move client-facing fields (`type`, `autocomplete`, `inputImages`, `optionalPrompt`, `nameRequired`, `orientation`, `preGenerationTasks`) into the "options" object
4. Update the `/generate/workflows` endpoint in `server/server.mjs` to send `workflow.options` to the client along with `name`
5. Modify the workflow lookup logic in `server/server.mjs` to access fields from `workflow.options` when needed
6. Update client-side code in `public/js/app.mjs` to access workflow properties from `workflow.options`
7. Update `public/js/app-ui/generation-form.mjs` to access workflow properties from `workflow.options`
8. Update `public/js/inpaint-page.mjs` and `public/js/app-ui/inpaint-form.mjs` to access workflow properties from `workflow.options`

```json
// New workflow data structure in comfyui-workflows.json
{
  "name": "Text to Image (Illustrious Characters)",
  "options": {
    "type": "image",
    "autocomplete": true,
    "inputImages": 0,
    "optionalPrompt": false,
    "nameRequired": false,
    "orientation": "portrait",
    "postGenerationTasks": [...]
  },
  "base": "illustrious-text-to-image.json",
  "format": "png",
  "finalNode": "10",
  "replace": [...]
}
```

```javascript
// What the client receives from /generate/workflows endpoint
{
  "name": "Text to Image (Illustrious Characters)",
  "options": {
    "type": "image",
    "autocomplete": true,
    "inputImages": 0,
    "optionalPrompt": false,
    "nameRequired": false,
    "orientation": "portrait",
    "postGenerationTasks": [...]
  }
}
```

[x] Fix a bug where using the "use in form" actions from the generated display section doesn't retrigger validation to enable/disable the generate button.

> NOTE: task skipped. It looks like this bug no longer occurs.
> If necessary, refactor the validation function so it can be accessed by both interfaces.

1. In `public/js/app.mjs`, create or identify the validation logic that determines if the generate button should be enabled
2. Extract the validation logic into a separate, reusable function if it's currently inline
3. Locate the "use in form" action handlers (e.g., `onUsePrompt`, `onUseName`, `onUseDescription`) in `public/js/app.mjs`
4. After updating the form state in these handlers, trigger a re-render or state update that causes validation to run
5. Ensure the validation function is called whenever form state changes, not just on user input

[] Change the regeneration task tracking UI to use the progress banner instead of generic toast messages.

1. Locate the regeneration task SSE event handling in the client code (likely in `public/js/sse-manager.mjs` or `public/js/app.mjs`)
2. Modify the event handlers for regeneration tasks to use the progress banner component instead of toast notifications
3. Import and use the `ProgressBanner` component from `public/js/custom-ui/progress-banner.mjs`
4. Update the progress update handler to show the progress banner with current step information
5. Update the completion handler to hide the progress banner
6. Update the error handler to show errors in the progress banner

[] Fix the total step number resetting between the pre-generate, generate, and post-generate phases.

> Here is a sample of what the event data looks like:
```
event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"(1/1) Generating prompt...","currentValue":0,"maxValue":2},"timestamp":"2025-12-13T17:34:28.476Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":50,"currentStep":"(1/1) Generating prompt complete","currentValue":1,"maxValue":2},"timestamp":"2025-12-13T17:34:29.509Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":50,"currentStep":"(1/1) Generating description...","currentValue":1,"maxValue":2},"timestamp":"2025-12-13T17:34:29.509Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":100,"currentStep":"(1/1) Generating description complete","currentValue":2,"maxValue":2},"timestamp":"2025-12-13T17:34:29.510Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"Starting generation...","currentValue":0,"maxValue":0},"timestamp":"2025-12-13T17:34:29.526Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"(5/18) Processing Load Image...","currentValue":0,"maxValue":0},"timestamp":"2025-12-13T17:34:29.565Z"}
```
For example, the correct `currentStep` for the first item should be `(1/18) Generating prompt`. To simplify estimation, remove the process that calculates the correct number of pre/post generation tasks and instead count every pre/post generation tasks in the total, when a task is skipped, simply add one to the number of tasks completed and continue.

1. In `server/generate.mjs`, locate the `calculateWorkflowSteps` function or where step calculation happens
2. Modify the step calculation to include pre-generation and post-generation tasks in the total from the start
3. Initialize a global step counter at the beginning of `processGenerationTask` that tracks cumulative progress across all phases
4. Update pre-generation task progress updates to use the global step counter and total
5. Update the ComfyUI workflow execution progress updates to continue from where pre-generation left off
6. Update post-generation task progress updates to continue the global step count
7. When a pre/post-generation task is skipped due to conditions, increment the step counter without emitting a progress update
8. Ensure all progress updates use a consistent `(currentStep/totalSteps)` format

```javascript
// Example of step counting structure
// totalSteps = preGenTasks.length + workflowSteps + postGenTasks.length
// currentStep starts at 0 and increments through all phases
// Progress format: `(${currentStep + 1}/${totalSteps}) ${stepDescription}`
```