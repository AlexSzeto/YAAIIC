# Inpaint History for Inpaint UI
[] Insert the `PaginationComponent` at the bottom of the inpaint page.
   1. Import the `PaginationComponent` and `createPagination` from `custom-ui/pagination.mjs` in `inpaint.mjs`
   2. Add a pagination container div to `inpaint.html` after the inpaint container, with appropriate styling
   3. Initialize the pagination component in `initializeInpaintPage` with empty data and 1 item per page
   4. Create an `updateInpaintDisplay` callback function to handle pagination data updates and load the selected image data
   5. Set the pagination component's `updateDisplay` callback to the `updateInpaintDisplay` function

[] Create a history array of inpaint generations and use the pagination component to navigate between inpaint generations.
   1. Create a global `inpaintHistory` array to store image data objects for all inpaint generations in the current session
   2. Modify `loadImageDataByUID` to add the loaded image data to the history array if not already present
   3. Update `handleInpaint` to add new inpaint results to the history array when a successful inpaint response is received
   4. Create a `updateInpaintHistoryPagination` function to refresh the pagination component with the current history
   5. Modify the `updateInpaintDisplay` callback to load and display the selected image data from history when pagination changes
   6. Add proper error handling for history navigation when image data cannot be loaded
   