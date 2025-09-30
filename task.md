# Execute inpaint workflow
[x] Modify the inpaint endpoint so that it would call `handleImageGeneration` after uploading the image files. Prepare the workflow data by sending `workflow`, `name`, `seed`, `prompt`, `imagePath` (currently being returned as `imageFilename`), `maskPath` (currently returned as `maskFilename`), and `inpaint` (always `true`). Do not send the `upload` data to the generation function.
   1. In `server.mjs`, locate the `/generate/inpaint` endpoint after the ComfyUI upload section
   2. Add workflow lookup logic similar to the `/generate/txt2img` endpoint to find the workflow configuration by name
   3. Generate random seed if not provided in the request, matching the txt2img endpoint pattern
   4. Create storage path for the generated inpaint result image using `findNextIndex` function
   5. Prepare the request body with `imagePath` and `maskPath` using the uploaded filenames from ComfyUI upload results
   6. Set `inpaint: true` flag in the request body to identify this as an inpaint operation
   7. Remove the `uploads` data from the request body before calling `handleImageGeneration`
   8. Call `handleImageGeneration(req, res, workflowData)` with the prepared request and workflow configuration
   9. Remove the current success response return since `handleImageGeneration` will handle the response

[x] Modify `handleImageGeneration` from `generate.mjs` to accomodate for inpaint workflows. Ensure that the extra parameter `inpaint` is stored in `image-data.json` and added to the return data.
   1. Update the function to accept and handle `imagePath` and `maskPath` parameters from `req.body`
   2. Add `inpaint` flag parameter handling from `req.body` (boolean value)
   3. Include `imagePath` and `maskPath` in the workflow modifications processing alongside existing parameters
   4. Modify the `imageDataEntry` object creation to include the `inpaint` flag field
   5. Update the JSON response data to include the `inpaint` flag in the returned data object
   6. Ensure proper logging of inpaint-specific parameters for debugging purposes 
