# UI Improvements and Enhanced Dialog System

[x] move the generated image display delete button to the left edge of its container:
1. Modify the CSS for `.image-delete-container` in `public/css/style.css` to position the delete button at the left edge of its container
2. Adjust flexbox properties or positioning to ensure proper alignment with existing UI elements

[x] unify the gallery preview checkbox style to use the same style as the `.form-group` checkbox input. Create a new shared checkbox style and assign the style to both the form checkbox and galley preview checkboxes:
1. Create a new shared CSS class `.shared-checkbox` in `public/css/style.css` that extracts the common checkbox styling from `.form-group input, .form-group select`
2. Update the form group input to extend or use the shared checkbox style
3. Modify the gallery preview checkbox styling in `public/js/gallery-preview.js` and related CSS to use the new shared checkbox class
4. Ensure consistent appearance and behavior across both form checkboxes and gallery preview checkboxes

[x] make the gallery delete button visible at all times and disable it when no image is selected. Change the button so it always shows the label "Delete" and a trash can icon, and reuse existing button styles:
1. Modify the `render()` method in `public/js/custom-ui/gallery.js` to always show the delete button instead of conditionally rendering it
2. Update the delete button to use the `btn-with-icon` class for consistent styling with other buttons
3. Add disabled state styling for the delete button when no items are selected
4. Update the button text to always display "Delete" with a trash icon, regardless of selection count
5. Modify the button's `disabled` attribute and styling based on whether `selectedItems.length > 0`
6. Ensure proper accessibility attributes (aria-disabled, title) are updated based on button state

[x] prevent the focus from moving to the delete button when a gallery preview item is checked:
1. Examine the current focus behavior in `public/js/gallery-preview.js` when checkboxes are interacted with
2. Modify the checkbox event handlers to prevent focus changes that might trigger unwanted button focus
3. Add `preventDefault()` or adjust tab index management to ensure focus remains on the checkbox after interaction

[x] update `showDialog()` in `dialog.js` to accept options by expanding its parameters to `showDialog(text, title, options)`. Accept an array of string for `options`, using the strings as labels for options in the dialog. The function should return a promise that resolves with the label of the chosen option:
1. Modify the `showDialog` function signature in `public/js/custom-ui/dialog.js` to accept a third parameter `options`
2. When `options` is provided (array of strings), replace the single "Close" button with multiple option buttons
3. Create dynamic button elements for each option string, with appropriate styling using existing button classes
4. Implement promise resolution logic that resolves with the selected option label when any option button is clicked
5. Maintain backward compatibility by keeping the existing behavior when `options` parameter is not provided
6. Update JSDoc comments to document the new parameter and return value
7. Add proper event handling for option buttons, including keyboard navigation (Enter/Escape)
8. Ensure modal closes properly when any option is selected or when dismissed

[x] update the dialog used for the delete confirmation to use the improved `showDialog()` function:
1. Locate the current delete confirmation implementation in `public/js/custom-ui/gallery.js` (in the `deleteSelectedItems` method)
2. Replace the native `confirm()` call with the enhanced `showDialog()` function
3. Pass appropriate options array (e.g., `['Delete', 'Cancel']`) to create custom confirmation buttons
4. Update the promise handling logic to work with the new dialog return value
5. Ensure the deletion only proceeds when the "Delete" option is selected
6. Test that the new dialog appears correctly and handles both confirmation and cancellation properly
7. Maintain the same user experience while using the consistent custom dialog styling