# Pre Image Generation Prompt Enhancements

## Goal
- Small incremental improvements to the real time updates: showing current step number, calculating total time, etc.
- Ensuring all images being sent through image generation would already have a description by removing direct upload and adding an upload button that runs an image through description generation before being sent directly to the gallery
- Always send description along with images to generation, and create a process for running ollama requests based on the chosen image descriptions and adding the result to the workflow input.

[] Change `describePrompt` and `namePromptPrefix` into a global config
- Pass `describePrompt` and `namePromptPrefix` into the image generation input data, replacing the now removed values from the workflow data.

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

[] The client should store the image's description alongside its URL in the upload image component, and send the description data as `image_X_description` where X is the image's index. On the server side, the workflow data in `comfyui-workflows` has a new parameter, `pregeneratePrompts`, which is an array. For example:
```
{
  "pregeneratePrompts": [
    {
      "model": "gemma:4b"
      "prompt": "Given the description of the first frame of a video: [image_0_description]\n\nImagine the dynamic motion that would carry the scenery one second forward. Write the description here:"
    }
  ]
}
```
WIP