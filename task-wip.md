# Modal Refactor Feature
[] **Create CustomModal Class Foundation**: Export a new class, `CustomModal`, using preact/htm, in `js/custom-ui/modal.js`, with variables to manage the wrapper, container, and the close button UI elements of a modal.
1. Set up basic preact/htm class structure with proper imports from 'preact' and 'htm/preact'
2. Create constructor that accepts props object with the following properties:
   - `lock` (boolean, default: false) - Whether to disable all close mechanisms initially
3. Initialize state variables for wrapper, container, and close button elements
4. Set up basic modal DOM structure using preact/htm render patterns
5. Apply existing CSS classes from image-modal styles for consistency

[] **Implement Modal Content Container Access**: Refactor out the code used to create a blank modal from `createImageModal` into this custom class. The class should provide public access to the container so elements can be added into the container.
1. Extract overlay, wrapper, and container creation logic from `createImageModal`
2. Use `props.children` to handle content that would be placed inside the modal container.
3. Ensure proper DOM structure matches existing image-modal-overlay/wrapper/container hierarchy
4. Maintain compatibility with existing CSS styling classes

[] **Implement closeModal() Method**: Implement a method, `closeModal()`, for closing the modal. Connect the listener for existing ways to close the modal to this method.
1. Create `closeModal()` method that handles DOM cleanup and removal
2. Connect close button click listener to `closeModal()` method
3. Connect overlay click listener to `closeModal()` method (when clicking outside modal content)
4. Connect ESC key press listener to `closeModal()` method
5. Ensure proper cleanup of event listeners and DOM elements from document.body

[] **Implement setModalLock() Method**: Implement a method, `setModalLock(lock)`, that disable all existing ways to close the modal (close button, clicking the overlay, pressing ESC) when `lock` is set to `true`, and re-enables all of these ways when `lock` is set to `false`.
1. Create `setModalLock(lock)` method that toggles modal lock state
2. Disable/enable close button functionality based on lock state
3. Disable/enable overlay click-to-close functionality based on lock state  
4. Disable/enable ESC key press functionality based on lock state
5. Update constructor to accept `lock` as a property and use `setModalLock()` to set initial lock state after UI initialization

[] **Refactor createImageModal Function**: Rewrite `createImageModal` to create an instance of `CustomModal`, then place the image element inside the blank modal.
1. Update `createImageModal` function to instantiate `CustomModal` class instead of creating modal DOM directly
2. Move image element creation and configuration logic to use the CustomModal container
3. Preserve existing autoScale and original sizing functionality
4. Maintain image loading, error handling, and scaling calculation logic
5. Ensure backward compatibility with existing `createImageModal(url, autoScale)` function signature

[] **Create createDialogModal Function**: Export a new function, `createDialogModal(text, title)`, inside `js/custom-ui/modal.js` to create an instance of `CustomModal`, refactoring the function `showDialog()` from `custom-dialog.js`. If there are style inconsistencies, use the styles that are defined either in `CustomModal` or the UI of other existing function within `modal.js`.
1. Create `createDialogModal(text, title)` function that uses `CustomModal` class
2. Port dialog content creation logic from `showDialog()` function
3. Create dialog title, content, and close button elements using preact/htm
4. Handle empty text content with "No description text provided." fallback
5. Apply consistent styling using existing modal CSS classes rather than dialog-specific classes

[] **Update References to Dialog Function**: Find and update all references to `showDialog()` from `custom-dialog.js` to use the new `createDialogModal()` function from `modal.js`.
1. Search codebase for imports of `showDialog` from `custom-dialog.js`
2. Update import statements to use `createDialogModal` from `modal.js`
3. Update function calls from `showDialog(text, title)` to `createDialogModal(text, title)`
4. Verify all references are updated and no broken imports remain
5. Test that dialog functionality works correctly with new implementation

[] **Delete custom-dialog.js File**: Delete `custom-dialog.js` once all of its functionalities are ported over.
1. Verify all `showDialog()` functionality has been successfully ported to `createDialogModal()`
2. Confirm no remaining references to `custom-dialog.js` exist in the codebase
3. Run tests to ensure no regressions in dialog functionality
4. Delete the `public/js/custom-ui/dialog.js` file
5. Update any documentation that references the old dialog system

[] **Refactor Gallery to Use CustomModal**: Refactor `gallery.js` to use preact/htm. Take advantage of `CustomModal` to create the outer container for the gallery component.
1. Update `GalleryDisplay` class to use `CustomModal` for the modal overlay and structure
2. Replace the current modal DOM creation in render() method with `CustomModal` instance
3. Move gallery content (grid, pagination, controls) into the CustomModal container
4. Maintain existing gallery functionality including search, pagination, and load/cancel actions
5. Ensure proper integration with existing preact/htm structure and preserve modal close behavior

# Add Delete Data Feature
[] Augment data in the existing `database/image-data.json` by adding a new attribute, `uid` to each object, by converting `timestamp` to a number using `Date.getTime()`. If a helper script was created to perform this task, delete the helper file after this task is complete.
[] After generating an image, add `uid` to the list of attributes saved to the database. Ensure that `uid` is sent back to the client when requested through `image-data`. Do not display this value in the UI.
[] Add an `image-data/delete` endpoint that takes in an array of UIDs and delete their entries 
[] Add a text with (trash) icon delete button beneath the existing two column layout of the generated image display. Send a request to delete the currently displayed image when the button is pressed. Update the data list to reflect this change when the request is successful.
[] Add a checkbox to the upper-right corner of each gallery preview item. Allow each gallery preview to send a `onSelect(data, state)` and use the `data` param to identify the data item and `state` to determine the new selected state. in the gallery component, create a `selectedItems` array in state and maintain its value through the `onSelect` events.
[] Add a text with (trash) icon delete button to the left of the pagination component in the gallery, and send a request to delete all selected items when the delete button is pressed. If the request is successful, update the gallery data to reflect the change.

# Create Inpaint Modal
[] read a new attribute, `type`, that can be (currently) set to `txt2img` or `inpaint`.
[] create a new file, `public/js/inpaint-modal.js`, and export a new class, `InpaintModal`.
1. The constructor takes in `url` and `workflowData`. 
2. Create an instance of `CustomModal` and place the following UI elements inside the modal:
  - a canvas element with the id `inpaint` that takes up to 70% of the viewport vertically or horizontally, maintaining the aspect ratio of the original image.
  - a textbox with the name `instructions` and label `Instructions:`, placed directly below the canvas element.
  - beneath the textbox, a generate button and a cancel button
[] add a new button, inpaint, next to the delete button in the generated image display

# Add Progress Percent Dialog During Image Generation