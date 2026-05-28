# Gallery Updates
[x] Allow gallery search to search by string matching descriptions and prompt
   1. Update the server-side `/image-data` endpoint in `server.mjs` to include search matching in `description` and `prompt` fields
   2. Modify the filter logic to check for matches in `item.description` and `item.prompt` fields in addition to existing name and timestamp searches
   3. Ensure the search is case-insensitive for all fields including the new description and prompt searches

[x] When gallery is loaded with items selected, send only the selected items to be viewed by the generated image viewer list
   1. Modify the `handleLoadClick` method in `GalleryDisplay` class to filter the gallery data to only include selected items
   2. Create a new method `getSelectedItemsData` to retrieve the full data objects for selected UIDs from the current gallery data
   3. Update the `onLoad` callback to receive the filtered selected items array instead of the complete gallery data
   4. Ensure the callback properly handles cases where no items are selected (should pass all items in the gallery, same as previous behavior)
   5. Update any consumers of the gallery `onLoad` callback to handle the new filtered data structure
