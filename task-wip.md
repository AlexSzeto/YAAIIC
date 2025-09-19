# Add Delete Data Feature
[] Augment data in the existing `database/image-data.json` by adding a new attribute, `uid` to each object, by converting `timestamp` to a number using `Date.getTime()`. If a helper script was created to perform this task, delete the helper file after this task is complete.
[] After generating an image, add `uid` to the list of attributes saved to the database. Ensure that `uid` is sent back to the client when requested through `image-data`. Do not display this value in the UI.
[] Add an `image-data/delete` endpoint that takes in an array of UIDs and delete their entries 
[] Add a text with (trash) icon delete button beneath the existing two column layout of the generated image display. Send a request to delete the currently displayed image when the button is pressed. Update the data list to reflect this change when the request is successful.
[] Add a checkbox to the upper-right corner of each gallery preview item. Allow each gallery preview to send a `onSelect(data, state)` and use the `data` param to identify the data item and `state` to determine the new selected state. in the gallery component, create a `selectedItems` array in state and maintain its value through the `onSelect` events.
[] Add a text with (trash) icon delete button to the left of the pagination component in the gallery, and send a request to delete all selected items when the delete button is pressed. If the request is successful, update the gallery data to reflect the change.

# Create Inpaint Modal
[] create a new file, `public/js/inpaint-modal.js`, and export a new class, `InpaintModal`.
1. The constructor takes in `url` and `workflowData`. 
2. Create an instance of `CustomModal` and place the following UI elements inside the modal:
  - a canvas element with the id `inpaint` that takes up to 70% of the viewport vertically or horizontally, maintaining the aspect ratio of the original image.
  - a textbox with the name `instructions` and label `Instructions:`, placed directly below the canvas element.
  - beneath the textbox, a generate button and a cancel button