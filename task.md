# Virtual Folders

## Goal
Allow generations to be organized by folders instead of a single unsorted list.

add "folders". Add "folder" attribute to image data. Put buttons next to gallery to show and allow user to change folder. Save inpaint image back to the same folder as the source image. Generated image should go to the current folder. Allow user to move selected items to destination folder in the gallery.

## Tasks
[] Add "folder" attribute to image data, storing its folder's uid. Each folder has a uid and a label (its displayed name). Existing data without the attribute are considered to be in the "unsorted" folder.
[] On the server, add a current folder attribute (storing the current uid) to the config in config.json. Add parts of CRUD support for the folder name value: POST `/folder` to add/change current folder name (create folder if it doesn't exist already), UPDATE `/folder` to rename a folder, DELETE `/folder` to "delete" a folder, GET `/folder` to retrieve a json object with two attributes: `list`, an array of uid/name objects, and `current`, the current folder name.
[] Update the generation so the current folder id is always added to a new generation.
[] Update the gallery retrieval endpoint to take a folder uid query parameter. If this parameter is omitted, set the folder uid to the current folder. Change the gallery retrival so that 
[] Create a text prompt dialog in custom-ui (if possible, place it in `dialog.mjs`) that has a title, text input, confirm, and cancel buttons.
[] Create a select folder modal, consisting of a vertical list of items, each containing the following columns: a label that can be clicked to select the folder, a button to rename the folder using the text prompt, and a button to delete the folder. When a folder is deleted, the folder attribute is deleted so all of its content are reassigned back to "unsorted". At the bottom right of the modal add an insert button (use the text prompt, and add and select the folder after the insert action) and a cancel button. the blank/unsorted option should always be available and on top of the list. Leave the handling of the select folder event to be implemented outside of the component.
[] Add a folder button to the left of the gallery button in the main page, and left of the home button in the inpaint page, with the folder icon and the name of the current folder as the button's label. Clicking the button opens the select folder modal. When a folder is selected, change the current folder to the selected folder.
[] Update the edit endpoint so it accept an array of generation data objects. Update client calls to the edit endpoint to conform to the new format.
[] In the gallery, add a "Move" button to the right of the delete button. Only enable this when there are items selected in the gallery, and hide this when the gallery is in select mode. When the move button is clicked, open the select folder modal. When a folder is selected, use the updated edit endpoint to update the folder id for all selected items.
