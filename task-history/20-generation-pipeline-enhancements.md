# Generation Pipeline Enhancements

## Goal
Enhance the image generation workflow with flexible LLM-powered prompt processing, improved real-time progress tracking, and seamless image upload integration:

- **Configurable Prompt Processing**: Replace hardcoded prompt generation with a flexible `postGenerationPrompts` and `preGenerationPrompts` system that allows chaining multiple LLM calls (both text and image prompts) with dynamic placeholder substitution and conditional execution
- **Enhanced Progress Tracking**: Add workflow step indicators (X/Y format based on node distance from final output), completion time tracking, and comprehensive SSE updates for all generation stages including pre/post-generation prompt processing
- **Image Upload Integration**: Add dedicated upload functionality that processes uploaded images through the same AI description and naming pipeline as generated images, storing them in the gallery with SSE progress updates
- **Image Description Support**: Enable image input workflows (particularly image-to-video) to leverage AI-generated descriptions from uploaded images as part of pre-generation prompt processing
- **Workflow Configuration Flexibility**: Support optional prompts and direct value assignment in workflow modifications for greater workflow customization

[x] Change `describePrompt` and `namePromptPrefix` into a global config, and change the prompt generation settings so the model name is specified. Each prompt is now an object with the following parameters:
```json
  "postGenerationPrompts": [
    {
      "model": "llava",
      "imagePath": "savePath",
      "prompt": "Write a detailed description of the scene in the image. If the image is focusing on a single character, focus the description on the character. Include atmosphere, lighting, color, mood, and any other minor details relevant to the scene. Be concise. Only include the description, do not include any other text. The description is:",
      "to": "description"
    },
    {
      "model": "gemma:4b",
      "prompt": "Write only one short name that would be a highly descriptive but concise summary for the image. If the image is focusing on a single character, imagine a name that fits the character's appearance instead. The name must be three words or less, and must not include any special characters or punctuation. The name must be in title case. The image description is: [description]",
      "to": "name",
      "replaceBlankFieldOnly": true
    }  
  ]
```
Note that all of the special properties for these processes are now encapsulated as input parameters: `replaceBlankFieldsOnly` indicates a prompt should only be executed to replace an empty or null field, `imagePath` indicates the prompt is an image prompt with the image in the specified path sent in for analysis, `to` indicates the parameter in the data object it should write back into, and text in brackets inside `prompt` (such as `[description]` in the example) should be replaced with text data from the data object currently being processed.

Unlike the current implementation of `processGenerationTask` where values are extracted out of `requestData`, there should be a `generationData` object that starts as a copy of `requestData` and its data would be augmented or replaced through prompts and the generation process. create a function in `generate.mjs`, `modifyGenerationDataWithPrompt(promptData, generationData)` that modifies `generationData` by sending a prompt using the data given in `promptData`.

As specified, the name generation prompt now executes after the image is generated, and uses the image description data instead of the original prompt data as part of the prompt text.

For now, hard code in a conditional clause to prevent these global prompts from executing if the workflow type is "video".
1. Update [server/config.default.json](server/config.default.json) to replace `describePrompt` and `namePromptPrefix` with a new `postGenerationPrompts` array following the JSON structure above
2. Create `modifyGenerationDataWithPrompt(promptData, generationData)` function in [server/generate.mjs](server/generate.mjs)
   ```javascript
   // async modifyGenerationDataWithPrompt(promptData, generationData)
   // - Check if `replaceBlankFieldOnly` is true and target field is not blank, skip processing
   // - Extract prompt text from `promptData.prompt`
   // - Replace bracketed placeholders (e.g., [description]) with values from `generationData`
   // - If `imagePath` is specified in `promptData`, resolve the actual path from `generationData`
   // - Call LLM service (either sendTextPrompt or sendImagePrompt) with the model specified in `promptData.model`
   // - Store the response in `generationData[promptData.to]`
   // - Return modified `generationData`
   ```
3. Modify `processGenerationTask` in [server/generate.mjs](server/generate.mjs) to create a `generationData` object as a copy of `requestData` at the start
4. After image generation completes, iterate through `postGenerationPrompts` from config
5. For each prompt, call `modifyGenerationDataWithPrompt(promptData, generationData)`
6. Add conditional check: skip `postGenerationPrompts` execution if workflow type is "video"
7. Use `generationData` fields (description, name) when storing to database instead of values from `requestData`
8. Remove old `describePrompt` and `namePromptPrefix` usage from the codebase

[x] Workflow progress step indicator (X/Y based on distance from final node)
1. Create a function in [server/generate.mjs](server/generate.mjs) to calculate workflow step structure
   ```javascript
   // calculateWorkflowSteps(workflow, finalNode)
   // - Recursively traverse from finalNode backwards through node inputs
   // - Build a map of nodeId -> distance from final node
   // - Calculate total steps (max distance + 1)
   // - Generate stepDisplayText for each node as "(X/Y)" where:
   //   - Y = total steps
   //   - X = Y - distance
   // - Return: { stepMap: Map<nodeId, { distance, stepDisplayText }>, totalSteps }
   ```
2. Call `calculateWorkflowSteps` after workflow loads but before generation starts
3. Store the step map in the generation context for the task
4. Modify SSE progress updates in [server/comfyui-websocket.mjs](server/comfyui-websocket.mjs) to prepend `stepDisplayText` to node names when sending progress events
5. Update client-side SSE handling in [public/js/sse-manager.mjs](public/js/sse-manager.mjs) to display the step indicator in progress messages

[x] Workflow time to completion client side calculation
1. Add a timer map in [server/generate.mjs](server/generate.mjs) to track start times keyed by task ID
   ```javascript
   // const taskTimers = new Map(); // taskId -> startTime
   ```
2. Start timer immediately after task ID is created in the generation endpoint
3. Calculate `timeTaken` in seconds when generation completes
4. Add `timeTaken` field to the database entry in [server/database/image-data.json](server/database/image-data.json)
   ```json
   {
     "id": "string",
     "prompt": "string",
     "timestamp": "number",
     "timeTaken": "number"
   }
   ```
5. Include `timeTaken` in the response data sent back to client
6. Update completion toast in [public/js/generated-image-display.mjs](public/js/generated-image-display.mjs) to show `Workflow Completed in X(s)` message
7. Clean up timer from the map after generation completes or fails

[x] Lower footprint gallery preview
1. Modify the gallery preview CSS in [public/css/custom-ui.css](public/css/custom-ui.css)
2. Add `position: relative` to the gallery item container
3. Position the name and date text container at the lower left corner using absolute positioning
4. Create a solid dark gray rounded rectangle background container for the text overlay
5. Add appropriate padding, border-radius, and margins to the text container
6. Ensure the styling matches the title text appearance in the image modal (font size, weight, color)
7. Test with various gallery items to ensure readability and proper overlay positioning

[x] Remove the upload button from the upload-image component, and add a upload button to the right of the gallery button. Pressing the button opens a dialog and when a file is chosen, the content of the file is renamed and copied into the storage folder as if it is a generated image, generate a description and a name for the image, and store all the required data into the `image-data` database just like a generated image.
1. Remove the upload button from [public/js/custom-ui/image-upload.mjs](public/js/custom-ui/image-upload.mjs) component
2. Add a new upload button in [public/index.html](public/index.html) positioned to the right of the gallery button
3. Create a file input dialog handler that triggers when the upload button is clicked
4. Create a new server endpoint in [server/server.mjs](server/server.mjs) for handling uploaded images
   ```javascript
   // POST /api/upload-image
   // - Accept multipart/form-data with image file
   // - Generate unique filename with timestamp
   // - Copy file to server/storage/ directory
   // - Return file path for further processing
   ```
5. After file upload, send the image path to the description generation endpoint
6. Use the existing `modifyGenerationDataWithPrompt` function with config's `postGenerationPrompts` to generate description and name
7. Create a database entry in [server/database/image-data.json](server/database/image-data.json) with:
   ```json
   {
     "id": "uploaded-{timestamp}",
     "prompt": "",
     "timestamp": "number",
     "timeTaken": 0,
     "name": "generated name",
     "description": "generated description",
     "savePath": "path/to/uploaded/file"
   }
   ```
8. Return the complete entry to the client and update the gallery display
9. Show a toast notification indicating successful upload and description generation

[x] Update the upload image endpoint to use sse similarly to workflow generation tasks
1. Modify the `/api/upload-image` endpoint in [server/server.mjs](server/server.mjs) to return a task ID immediately
2. Create a new generation task queue entry for the upload processing
3. Use the existing SSE infrastructure in [server/sse.mjs](server/sse.mjs) to broadcast progress updates
4. Send SSE events for each stage: "Uploading file", "Generating description", "Generating name", "Saving to database"
5. Update client-side upload handler in [public/index.html](public/index.html) to listen for SSE events using the task ID
6. Display progress updates in a progress banner using [public/js/custom-ui/progress-banner.mjs](public/js/custom-ui/progress-banner.mjs)
7. Handle completion event to refresh gallery and show success toast
8. Handle error events and display appropriate error messages

[x] The client should store the image's description alongside its URL in the upload image component, and send the description data as `image_X_description` where X is the image's index. On the server side, the workflow data in `comfyui-workflows` has a new parameter, `preGenerationPrompts`, which is an array. For example:
```json
{
  "optionalPrompt": true,
  "preGenerationPrompts": [
    {
      "model": "gemma:4b",
      "prompt": "Given the description of the first frame of a video: [image_0_description]\n\nImagine the dynamic motion that would carry the scenery one second forward. Write the description here:",
      "to": "prompt"
    }
  ]
}
```
When the request parameters are sent to the generation function, and before the workflow inputs are modified, all pregeneration prompts process using `modifyGenerationDataWithPrompt` and its results are used to augment or replace data in `generationData` before the comfyui workflow modification process starts.
1. Update [public/js/custom-ui/image-upload.mjs](public/js/custom-ui/image-upload.mjs) to store image descriptions
   ```javascript
   // Add a descriptions array to component state
   // this.state = { images: [], descriptions: [] }
   // When image is uploaded/selected, store its description alongside URL
   // Add method: getImageWithDescription(index) - returns { url, description }
   ```
2. Modify form submission in [public/js/main.mjs](public/js/main.mjs) to include image descriptions
3. For each uploaded image at index X, send `image_X_description` parameter with the request
4. Update workflow configurations in [server/resource/comfyui-workflows.json](server/resource/comfyui-workflows.json) to add `preGenerationPrompts` field for workflows that need it (e.g., video workflows)
5. In [server/generate.mjs](server/generate.mjs), modify the generation function to process pre-generation prompts
6. Before workflow input modification, iterate through `workflow.preGenerationPrompts` if it exists
7. For each pre-generation prompt, call `modifyGenerationDataWithPrompt(promptData, generationData)`
8. Use the augmented `generationData` when modifying workflow inputs
9. Ensure bracket placeholders like `[image_0_description]` are properly replaced with actual description values from request parameters

[x] Implement support for the `optionalPrompt` workflow data parameter. Send this value as part of the workflow list, and skip workflow validation for a filled in prompt when this parameter is set to true

[x] modify the generation step calculation algorithm to include pre generation prompts and post generation prompts. Do not modify the upload task progress.
1. Create `calculateWorkflowSteps` function in [server/generate.mjs](server/generate.mjs)
   ```javascript
   // calculateWorkflowSteps(workflow, finalNode, hasPreGenPrompts, hasPostGenPrompts)
   // - Recursively traverse from finalNode backwards through node inputs
   // - Build a map of nodeId -> distance from final node
   // - Calculate base workflow total steps (max distance + 1)
   // - If hasPreGenPrompts is true, add 1 to total steps
   // - If hasPostGenPrompts is true, add 1 to total steps
   // - If pre-gen prompts exist, shift workflow step numbers to start at 2 instead of 1
   // - Generate stepDisplayText for each node as "(X/Y)" where:
   //   - Y = total steps
   //   - X = (Y - distance) or (Y - distance + 1) if pre-gen prompts exist
   // - Return: { stepMap: Map<nodeId, { distance, stepDisplayText }>, totalSteps, preGenStepInfo, postGenStepInfo }
   //   - preGenStepInfo: { stepText: "(1/Y)", promptCount: number } (if pre-gen prompts exist)
   //   - postGenStepInfo: { stepText: "(Y/Y)", promptCount: number } (if post-gen prompts exist)
   ```
2. Call `calculateWorkflowSteps` in the generation function after workflow loads but before generation starts
3. Store the step map and step info in the generation task context
4. Modify [server/comfyui-websocket.mjs](server/comfyui-websocket.mjs) to use the step map when sending progress events
5. Prepend `stepDisplayText` from the step map to node names in progress SSE events
6. In [server/generate.mjs](server/generate.mjs), add SSE progress updates for pre-generation prompts
7. When processing pre-generation prompts, send SSE progress updates with step text "(1/Y)"
8. Calculate percentage progress by dividing 100% evenly among the number of pre-gen prompts (e.g., 3 prompts: 33%, 66%, 100%)
9. Add SSE progress updates for post-generation prompts
10. When processing post-generation prompts, send SSE progress updates with step text "(Y/Y)"
11. Calculate percentage progress by dividing 100% evenly among the number of post-gen prompts
12. Update client-side SSE handling in [public/js/sse-manager.mjs](public/js/sse-manager.mjs) to display the step indicator in progress messages

[x] Support direct value assignment in workflow modifications without requiring values to come from generationData

- When a workflow modification contains a `value` property instead of a `from` property, the system should directly use that value rather than looking it up from `generationData`. This allows hardcoding specific values in workflow configurations.

1. Modify workflow modification logic in [server/generate.mjs](server/generate.mjs#L582-L597)
2. Update modification processing to check for `value` property first
3. If `value` is present, use it directly instead of looking up from `generationData[from]`
4. If `value` is not present, fall back to existing `from` behavior
5. Support `prefix` and `postfix` with both direct values and lookup values
6. Update logging to distinguish between direct value and lookup modifications
