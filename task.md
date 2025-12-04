# Bug Cleanup for Generation and Progress UI

## Goals
Fix remaining outstanding bugs, clean up exception handling, and modify the progress UI to take up less space.

[x] Gracefully fail out using SSE when the generation process fails
>>NOTE: Failures like the exception below needs to send a SSE to the client indicating the generation process had failed, and the client should gracefully close up the progress bar
```
Error in task task_1764871312524_04n4ns0xg: Error: ComfyUI request failed: 400 Bad Request
    at processGenerationTask (file:///mnt/dev-240/YAAIIC/server/generate.mjs:490:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
SSE client connected for task task_1764871312524_04n4ns0xg
```
1. In `server/generate.mjs`, wrap the `processGenerationTask()` function body in a try-catch block
2. In the catch block, call `emitTaskError()` with the taskId, error message, and error details
3. Store the workflow configuration in the task object when creating the task so it's available for error handling
4. Ensure `emitTaskError()` sends an SSE 'error-event' to all connected clients with proper error response format
5. Test that errors during workflow loading, ComfyUI request, and file generation all trigger SSE error events
6. Verify that the client's `ProgressBanner` component receives the error event and displays it properly
>>ADDITIONAL IMPLEMENTATION: Created `emitTaskErrorByTaskId()` to handle errors before promptId is available; implemented message buffering system to store SSE messages sent before client connects; added `onError` callback support to ProgressBanner component to re-enable UI on errors in both main and inpaint pages

[x] Gracefully time out if there's no incoming response from the server.
1. In `public/js/sse-manager.mjs`, add a timeout tracking mechanism to the `subscribe()` method
2. Create a `_startTimeout()` private method that sets a timer (e.g., 5 minutes) for task completion
3. Create a `_clearTimeout()` private method to clear the timeout when messages are received
4. Call `_clearTimeout()` in `_handleMessage()` on each progress update, then restart the timeout
5. When timeout expires, call the onError callback with a timeout error message and unsubscribe
6. Add timeout configuration as an optional parameter to `subscribe()` with a sensible default

[x] In `createProgressResponse()` in `generate.mjs`, cross reference `currentStep` with the step Id in the task's associated workflow JSON and extract its `_meta.title` to send to the client
1. Modify `emitProgressUpdate()` to accept the taskId in addition to promptId
2. In `emitProgressUpdate()`, retrieve the task object to access the stored workflow JSON
3. Parse the currentStep parameter to extract the node ID (if it contains node information)
4. Look up the node in the workflow JSON using the node ID
5. Extract the `_meta.title` field from the matched node
6. Pass the extracted title as the `currentStep` parameter to `createProgressResponse()`
7. Add a fallback to use a generic phrase, `Processing...` if the node lookup fails
8. Update the WebSocket handler in `comfyui-websocket.mjs` to pass taskId to `emitProgressUpdate()`

[x] Adjust the layout of the progress indicator as follows:
- Move the indicator to the bottom right of the viewport, and use a toast-like floating window.
- Fix the progress bar so it actually colors in the current progress as the task is being completed.
1. In `public/css/custom-ui.css`, modify `#progress-banner-container` to use fixed positioning at bottom-right
2. Update positioning CSS: `position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;`
3. Change `.progress-banner` width from full-width to a constrained toast width (e.g., `max-width: 400px;`)
4. Add border-radius, box-shadow, and padding to create a floating toast appearance
5. Remove top positioning styles that make it a banner across the top
6. In `.progress-banner-bar`, ensure the background color is set to a visible color (check CSS variables)
7. Verify the `.progress-banner-bar` has a transition effect: `transition: width 0.3s ease-in-out;`

[] Fix gallery load by selection not working as expected. It is currently adding all matching search items to the gallery and not just the selected items from the search.