# Gallery Load by Selection Fix

## Goals
Fix the gallery load by selection feature to load only selected items instead of all matching search results.

[x] Fix gallery load by selection not working as expected. It is currently adding all matching search items to the gallery and not just the selected items from the search.
1. Locate the `handleLoadClick` method in `public/js/custom-ui/gallery.mjs` that handles the Load button click
2. Modify the method to pass `selectedItems` instead of `galleryData` to the `onLoad` callback, with the caveat that if no item is selected, the entire `galleryData` should be passed by default
3. Update the `onLoad` callback to receive the selected item objects instead of just UIDs, ensuring the callback has all necessary data for each selected item
4. Test the fix by opening the gallery, searching for items, selecting a few items, and verifying that only the selected items are loaded
