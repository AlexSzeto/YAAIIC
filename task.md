# Create Inpaint Page

[] On the client side, separate workflows by type and only supply `txt2img` workflows into the current index page:
1. Modify `main.mjs` to filter workflows loaded from the server based on their `type` property.
2. Only include workflows where `type === 'txt2img'` in the workflow dropdown on `index.html`.

[] On the server side, create a new endpoint, `/image-data/uid`, that accepts a single query param (`uid`) and only returns one object in the `imageData` that matches `uid`:
1. Add a new GET endpoint at `/image-data/:uid` in `server.mjs`.
2. Parse the `uid` parameter from the URL path.
3. Search through `imageData.imageData` array to find the object where `uid` matches the provided parameter.
4. Return the single matching object if found, or a 404 error if not found.
5. Include proper error handling and logging for the endpoint.

[] On the client side, create a new page, `inpaint.html` that is a copy of `index.html`, then make the following changes:
1. Remove the gallery button and any gallery related UI layout in the HTML.
2. Rename the text in the `Generate` button to `Inpaint`.
3. Remove the generated image display UI.
4. Create a new inpaint UI preact component, `InpaintComponent`, stored in `js/inpaint-canvas.mjs`, with a canvas element with the id `inpaint` that automatically resize to the image loaded within it, via the `imageUrl` property.
5. Place the inpaint UI beneath the inpaint form.
6. Use `js/inpaint.mjs` to host the scripts used for `inpaint.html`. On page load, parse the query param `uid` and use `/image-data/uid` to load the `name` and send the `imageUrl` to the `InpaintComponent`.

[] Create the InpaintComponent as a reusable preact component:
1. Create `js/inpaint-canvas.mjs` following rule 1 (always use preact/htm for dynamic components).
2. Import preact and htm from the appropriate CDN modules.
3. Create an `InpaintComponent` that accepts `imageUrl` as a property.
4. The component should render a canvas element with id `inpaint`.
5. Implement automatic canvas resizing to match the loaded image dimensions.
6. Add image loading functionality that draws the image onto the canvas when `imageUrl` changes.
7. Include basic canvas interaction setup for future inpainting functionality.
8. Export the component for use in other modules.

[] Create the inpaint page script module:
1. Create `js/inpaint.mjs` to handle inpaint page-specific functionality.
2. Import necessary utilities from `util.mjs` following rule 2.
3. Parse the `uid` query parameter from the current page URL.
4. Fetch image data from the new `/image-data/:uid` endpoint.
5. Initialize the `InpaintComponent` with the fetched image URL.
6. Load workflows from the server and filter to only show `inpaint` type workflows.
7. Implement error handling for missing or invalid UIDs.
8. Include proper initialization and cleanup.

[] Filter workflows by type in the inpaint page:
1. Modify the workflow loading logic in `inpaint.mjs` to only display workflows where `type === 'inpaint'`.
2. Ensure the workflow dropdown is populated with appropriate inpaint workflows.
3. Handle cases where no inpaint workflows are available.
4. Set a default inpaint workflow if available.

[] In the generated image display from `index.html`, add a button to the right of the delete button, add an `Inpaint` button with a paintbrush icon that links to the `inpaint` page with the `uid` of the current image as query parameter:
1. Modify the HTML structure in `index.html` to add an inpaint button container next to the delete button.
2. Style the new inpaint button to match existing button styling in `css/style.css`.
3. Add a paintbrush icon using box-icon (e.g., `bx-brush` or `bx-paint-roll`).
4. Update `generated-image-display.mjs` to handle the inpaint button click event.
5. Construct the inpaint page URL with the current image's `uid` as a query parameter.
6. Navigate to the inpaint page when the button is clicked.
7. Only show the inpaint button when a valid image with a `uid` is displayed.