# Tasks
[x] Make an update to the autocomplete panel's border color to match the rest of the existing UI.
[x] Store the `workflow` value in addition to all existing values after image generation into the JSON database.
[x] Modify the generated image display to show the `workflow` value at the top of the list of displayed text values.
[x] For each of the value fields in the generated image display, add two icon buttons:
1. A copy text button (using the copy icon) that copies the content of the field into the clipboard when pressed.
2. A use value button (using an up arrow icon) that copies the content of the display field into the corresponding field in the generation form UI. The description button copies its content to the prompt field, and the seed button always toggle the lock seed option on in addition to copying the field over.

# Cleanup Requests
[] Update the positioning of all info buttons so they are placed to the right of their corresponding info label horizontally.
[] Create a new utility file, `public/js/util.js`, and refactor the clipboard related functions into an exported function named `sendToClipboard(text)`.
[] Create a new callback function for `GeneratedImageDisplay`, `onUseField(fieldName, value)`, and move the business logic for handling field uses to `main.js`.