# Pre Image Generation Prompt Enhancements

## Goal
- Small incremental improvements to the real time updates: showing current step number, calculating total time, etc.
- Ensuring all images being sent through image generation would already have a description by removing direct upload and adding an upload button that runs an image through description generation before being sent directly to the gallery
- Always send description along with images to generation, and create a process for running ollama requests based on the chosen image descriptions and adding the result to the workflow input.

[] Workflow progress step indicator (X/Y based on distance from final node)
- Perform this process after the full comfyui workflow loads into memory, but before any of the generation related tasks.
- Make use of the `finalNode` attribute from each workflow definition to track the number of step in the workflow by starting from `finalNode` and recursively looking backwards at any node that is within its input, until the algorithm reach a node that doesn't contain any input from another node. For example: `8 -> 14 -> 92 (final)` would mean the workflow has 3 steps. Increment the number of steps by 1 if the workflow runs name generation. Calculate the `stepDisplayText` for each node by 
[] Workflow time to completion client side calculation
[] Lower footprint gallery preview
- Lower the amount of space that the name and date occupy in the gallery preview by moving the text to the lower left corner and enclose it within a rounded rectangle similar to the title text in the image modal.
