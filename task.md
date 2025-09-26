# Add Delete Data Feature
[x] Augment data in the existing `database/image-data.json` by adding a new attribute, `uid` to each object, by converting `timestamp` to a number using `Date.getTime()`. If a helper script was created to perform this task, delete the helper file after this task is complete:
1. Create a helper script `update-uid.mjs` in the server folder to read the existing `database/image-data.json` file
2. For each image data object in the `imageData` array, add a `uid` property by converting the existing `timestamp` to a number using `new Date(timestamp).getTime()`
3. Write the updated data back to the JSON file, preserving all existing data structure
4. Run the helper script once to perform the update
5. Delete the helper script file after successful execution

[x] After generating an image, add `uid` to the list of attributes saved to the database. Ensure that `uid` is sent back to the client when requested through `image-data`. Do not display this value in the UI:
1. Modify the `addImageDataEntry` function in `server.mjs` to automatically generate a `uid` when adding new entries by using `Date.getTime()` on the timestamp
2. Verify that the `/image-data` GET endpoint already returns all object properties (including the new `uid`) without modification
3. Test that newly generated images include the `uid` in their database entries

[x] Add an `image-data/delete` endpoint that takes in an array of UIDs and delete their entries:
1. Create a new DELETE endpoint at `/image-data/delete` in `server.mjs`
2. Accept a JSON request body with a `uids` property containing an array of UID numbers
3. For each UID in the array, find and remove the corresponding entry from `imageData.imageData`
4. Call `saveImageData()` to persist the changes to the JSON file
5. Return a success response with the count of deleted entries
6. Include error handling for invalid UIDs and file write failures

[x] Add a text with (trash) icon delete button beneath the existing two column layout of the generated image display. Send a request to delete the currently displayed image when the button is pressed. Update the data list to reflect this change when the request is successful:
1. Add a delete button container div below the generated image display in `public/index.html` with appropriate styling
2. Include a text label "Delete Image" and a trash icon using box-icon, styled consistently with existing UI elements
3. Modify the `GeneratedImageDisplay` class in `generated-image-display.js` to:
   - Store the current image data's `uid` when `setData()` is called
   - Add a click event listener to the delete button that calls a new `deleteCurrentImage()` method
   - Implement `deleteCurrentImage()` to send a DELETE request to `/image-data/delete` with the current UID
   - Show user feedback during the deletion process using toast notifications
   - Trigger a callback to notify the carousel component to refresh its data when deletion succeeds
4. Modify the carousel component initialization in `main.js` to handle data refresh after deletion

[x] Add a checkbox to the upper-right corner of each gallery preview item. Allow each gallery preview to send a `onSelect(data, state)` and use the `data` param to identify the data item and `state` to determine the new selected state. in the gallery component, create a `selectedItems` array in state and maintain its value through the `onSelect` events:
1. Modify the `previewFactory` function in `main.js` to include a checkbox element positioned in the upper-right corner of each preview
2. Add CSS styling in `css/style.css` for the preview checkbox with proper positioning and hover effects
3. Update the `previewFactory` to accept an `onSelect` callback parameter and attach it to checkbox change events
4. Pass the image data object and checkbox state to the `onSelect` callback when the checkbox is toggled
5. Modify the `GalleryDisplay` component in `gallery.js` to:
   - Add a `selectedItems` array to the component's state to track selected item UIDs
   - Implement an `handleItemSelect(data, isSelected)` method that updates the `selectedItems` array
   - Pass the `handleItemSelect` method to the `previewFactory` via props
   - Ensure the selected state persists when gallery data is refreshed or paginated

[] Add a text with (trash) icon delete button to the left of the pagination component in the gallery, and send a request to delete all selected items when the delete button is pressed. If the request is successful, update the gallery data to reflect the change:
1. Add a bulk delete button container to the left of the pagination component in the gallery modal's HTML structure
2. Include a text label showing the count of selected items and a trash icon, styled consistently with existing buttons
3. Show/hide the delete button based on whether any items are selected (only show when `selectedItems` has elements)
4. Implement a `deleteSelectedItems()` method in the `GalleryDisplay` component that:
   - Sends a DELETE request to `/image-data/delete` with the array of selected UIDs
   - Shows loading feedback during the request
   - Displays success/error messages using toast notifications
   - Refreshes the gallery data and clears the selection after successful deletion
   - Handles errors gracefully with user-friendly error messages
5. Add a confirmation dialog before performing bulk deletion to prevent accidental data loss
