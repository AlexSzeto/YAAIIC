# Inpaint server side upload support

[] Convert the `inpaintArea` inside `inpaint-canvas.mjs` into a preact-signal:
1. Import `signal` from preact/signals in `inpaint-canvas.mjs`.
2. Replace the `inpaintArea` state property with a preact signal initialized to `null`.
3. Update all references to `this.state.inpaintArea` to use the signal's `.value` property.
4. Update the `setState` calls that modify `inpaintArea` to directly assign to the signal's `.value` property.
5. Ensure the component re-renders when the signal changes by accessing `.value` in the render method.
6. Update mouse event handlers to work with the signal instead of component state.

[] Implement the click action for the inpaint button:
1. Prepare the mask image data in the following manner: create a canvas with the same dimension as the original image, then clear the canvas with black (rgb 0, 0, 0), then draw a filled rectangle of the `inpaintArea` in white (rgb 255, 255, 255).
2. Send the following data: `workflow`, `name`, `seed`, `prompt` (see `index.html` and `main.mjs` for references if necessary), as well as the following additional data: `image` as an encoded file containing the data from the image loaded from `imageUrl`, and `mask` from the previous step, to a new endpoint, `/generate/inpaint`, on the server.
3. Add a click event handler to the inpaint button that validates required form data before processing.
4. Create a utility function to generate the mask canvas from the current `inpaintArea` signal.
5. Create a utility function to convert the original image canvas to blob data for upload.
6. Implement form data preparation logic that gathers all required parameters from the form.
7. Add proper error handling for cases where `inpaintArea` is not set or invalid.
8. Show user feedback during the upload process using toast notifications.
9. Handle server response and display appropriate success or error messages.
10. Reset the form or redirect user after successful inpaint submission.

[] Create a new endpoint, `/generate/inpaint`, with temporary test processing:
1. console log `workflow`, `name`, `seed`, and `prompt`.
2. save the data from `image` into `/storage` with the filename `image` and the extension of the original image.
3. save the data from `mask` into `/storage` with the filename `mask.png`.
4. Add a new POST endpoint at `/generate/inpaint` in `server.mjs`.
5. Configure middleware to handle multipart/form-data for file uploads using appropriate Express middleware.
6. Add request validation to ensure all required fields (`workflow`, `name`, `seed`, `prompt`, `image`, `mask`) are present.
7. Implement file extension detection from the original image data for proper storage.
8. Add error handling for file write operations and invalid file formats.
9. Create appropriate storage directory structure if it doesn't exist.
10. Return appropriate HTTP status codes and JSON responses for success and error cases.
11. Add logging for debugging and monitoring upload operations.
