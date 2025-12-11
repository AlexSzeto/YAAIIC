# Pre Image Generation Prompt Enhancements

## Goal
- Small incremental improvements to the real time updates: showing current step number, calculating total time, etc.
- Ensuring all images being sent through image generation would already have a description by removing direct upload and adding an upload button that runs an image through description generation before being sent directly to the gallery
- Always send description along with images to generation, and create a process for running ollama requests based on the chosen image descriptions and adding the result to the workflow input.

[] Workflow progress step indicator (X/Y based on distance from final node)
- Perform this process after the full comfyui workflow loads into memory, but before any of the generation related tasks.
- Make use of the `finalNode` attribute from each workflow definition to track the number of step in the workflow by starting from `finalNode` and recursively looking backwards at any node that is within its input, until the algorithm reach a node that doesn't contain any input from another node. For example: `8 -> 14 -> 92 (final)` would mean the workflow has 3 steps. Record the distance of a node from the final node during the traversal. Calculate the `stepDisplayText` for each node as `(X/Y)`, where Y is the total number of steps (3 in the example) and X is `(distance from final node) - (total number of steps) + 1`. For any node that isn't in the path of the traversal, its `stepDisplayText` is a blank string. When sending the node name to the client via SSE, add `stepDisplayText` before the name of the node.
[] Workflow time to completion client side calculation
- On the server side, start a timer that's tied to the task Id as soon as the Id is available. At the end of the generation, add `timeTaken` in seconds to the attributes stored in the database and sent back as return data. On the client side, modify the completion toast message to `Workflow Completed in X(s)`, where X is `timeTaken`. Do not display `timeTaken` anywhere else in the client UI for now.
[] Lower footprint gallery preview
- Lower the amount of space that the name and date occupy in the gallery preview by moving the text to the lower left corner and enclose it within a rounded rectangle similar to the title text in the image modal.
