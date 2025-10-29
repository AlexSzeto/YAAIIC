# Improved Flow Between Inpaint and Main UI
[x] Implement the UID query param for the index page, `uid=XXX`. When a UID is provided, on page load, populate the gallery data with a single entry from the `uid` by loading its associated data.
   1. Move the `getQueryParam` utility function to from `inpaint.mjs` to `util.mjs`, then use the common function in both `inpaint.mjs` and `main.mjs` to parse URL query parameters
   2. Modify the `initializeApplication` function in `main.mjs` to check for the `uid` query parameter on page load
   3. Create a new function `loadImageDataByUID` in `main.mjs` to fetch image data from the server using the `/image-data/{uid}` endpoint
   4. When a UID is found, populate the carousel with a single item by calling `carouselDisplay.setData([imageData])`
   5. Display the first (and only) item in the generated image display by calling `generatedImageDisplay.setData(imageData)`
   6. Handle error cases when the UID is invalid or the image data cannot be loaded

[x] Implement a "Done" button in the inpaint page and place it to the right of the "Inpaint" button. The button links back to the index page and sends the most recent `uid` as a query parameter.
   1. Update the `inpaint.html` file to add a "Done" button in the button row container next to the "Inpaint" button
   2. Style the "Done" button using the existing `btn-with-icon` class with appropriate boxicon ('home')
   3. Add an event listener for the "Done" button in the `initializeInpaintPage` function in `inpaint.mjs`
   4. Create a `handleDoneClick` function that constructs the return URL to the index page with the current UID as a query parameter
   5. Use `window.location.href` to navigate back to the index page with the UID parameter
   6. Ensure the "Done" button is only enabled when valid image data is loaded (similar to existing inpaint/delete button logic)