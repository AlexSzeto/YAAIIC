[x] initialze the server by loading `server/resource/comfyui-workflows.json` and storing its content in `comfyuiWorkflows`
[x] modify the `generate/img2img` endpoint:
  1. check to see if the request contains `seed`. If it is not passed in, generate a random one and add it to the request. 
  2. Look at how `handleImageGeneration` creates the `fullPath` value, replicate that, and store it as `savePath` inside the request.
  3. Pull the full workflow JSON data based on the passed in `workflow` name and pass it into `handleImageGeneration`.
[x] modify `handleImageGeneration` in the following ways:
  1. Accept `workflow` as a parameter. The JSOn would be passed into the function instead of loaded inside the function.
  2. Accept `modifications` as a parameter. Look at the workflow modification data format as seen in `comfyui-workflows.json` and change how the workflow is modified inside the function so it is dynamically tied to the modifications data. The example given in the data point matches functionally with the existing function, except that the current function has hard coded modifications. `seed` and `savePath` are passed in through `req`. `savePath` replaces the existing `fullPath`.
[x] create a new endpoint, `generate/workflows`, that returns an array of workflow data objects based on the `name` values from `comfyuiWorkflows`.
[x] create a row of UI elements above the autocomplete text area that consist of:
  1. a select input of the list of workflow (fetched from `generate/workflows` on page load) with field name `workflow`
  2. a name text input (leave blank for now) with field name `name`
  3. a number input with field name `seed`
  4. a checkbox labeled `lock seed`.
[x] implement the following in `main`:
  1. On page load, fetch and store the values from `generate/workflows` into `workflows`.
  2. When a workflow is selected, check the `autocomplete` setting for that workflow. Enable or disable the autocomplete module attached to the prompt field based on this setting.
  3. When the page loads and after every image generate request, a random number is placed into the `seed` field unless lock seed is checked. Create a helper function on the client side to do seed generation.