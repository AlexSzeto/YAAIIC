# Pre Image Generation Prompt Enhancements

## Goal
- Small incremental improvements to the real time updates: showing current step number, calculating total time, etc.
- Ensuring all images being sent through image generation would already have a description by removing direct upload and adding an upload button that runs an image through description generation before being sent directly to the gallery
- Always send description along with images to generation, and create a process for running ollama requests based on the chosen image descriptions and adding the result to the workflow input.

[] Change `describePrompt` and `namePromptPrefix` into a global config, and change the prompt generation settings so the model name is specified. Each prompt is now an object with the following parameters:
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

[] Workflow progress step indicator (X/Y based on distance from final node)
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

[] Workflow time to completion client side calculation
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

[] Lower footprint gallery preview
1. Modify the gallery preview CSS in [public/css/custom-ui.css](public/css/custom-ui.css)
2. Position the name and date text at the lower left corner using absolute positioning
3. Add a solid dark gray rounded rectangle background container for the text
4. Ensure the styling matches the title text appearance in the image modal

[] Remove the upload button from the upload-image component, and add a upload button to the right of the gallery button. Pressing the button opens a dialog and when a file is chosen, the content of the file is renamed and copied into the storage folder as if it is a generated image, generate a description and a name for the image, and store all the required data into the `image-data` database just like a generated image.

[] The client should store the image's description alongside its URL in the upload image component, and send the description data as `image_X_description` where X is the image's index. On the server side, the workflow data in `comfyui-workflows` has a new parameter, `preGenerationPrompts`, which is an array. For example:
```json
{
  "requiresPrompt": false
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