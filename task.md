# Virtual Folders

## Goal
Allow generations to be organized by folders instead of a single unsorted list.

add "folders". Add "folder" attribute to image data. Put buttons next to gallery to show and allow user to change folder. Save inpaint image back to the same folder as the source image. Generated image should go to the current folder. Allow user to move selected items to destination folder in the gallery.

## Tasks

[x] Add "folder" attribute to image data, storing its folder's uid. Each folder has a uid and a label (its displayed name). Existing data without the attribute are considered to be in the "unsorted" folder.
1. Add optional `folder` property to image data objects in `server/database/image-data.json` (string, stores folder uid)
2. Update image data type handling in `server/server.mjs` to accept the optional `folder` field
3. When reading image data without a folder attribute, treat it as belonging to the special "unsorted" folder (represented by empty string or null)

[x] On the server, add a current folder attribute (storing the current uid) to the config in config.json. Add parts of CRUD support for the folder name value: POST `/folder` to add/change current folder name (create folder if it doesn't exist already), UPDATE `/folder` to rename a folder, DELETE `/folder` to "delete" a folder, GET `/folder` to retrieve a json object with two attributes: `list`, an array of uid/name objects, and `current`, the current folder name.
1. Add `currentFolder` property to `server/database/image-data.json` (string, stores current folder uid)
2. Add `folders` property to `server/database/image-data.json` to store folder definitions
```json
{
  "folders": [
    { "uid": "folder-123", "label": "Fantasy Landscapes" },
    { "uid": "folder-456", "label": "Character Portraits" }
  ],
  "currentFolder": "folder-123"
}
```
3. Implement GET `/folder` endpoint that returns:
```json
{
  "list": [
    { "uid": "", "label": "Unsorted" },
    { "uid": "folder-123", "label": "Fantasy Landscapes" }
  ],
  "current": "folder-123"
}
```
4. Implement POST `/folder` endpoint to set current folder (create new folder if uid doesn't exist):
   - Request body: `{ "label": "New Folder" }`
   - Create new folder in config
   - Set as current folder
   - Save config and return updated folder list
5. Implement PUT `/folder` endpoint to rename existing folder:
   - Request body: `{ "uid": "folder-123", "label": "Updated Name" }`
   - Find folder by uid and update label
   - Save config and return updated folder list
6. Implement DELETE `/folder/:uid` endpoint to delete folder:
   - Remove folder from image data list
   - If deleted folder was current, set current to "" (unsorted)
   - Update all image data entries with this folder uid to have no folder attribute (empty string "")
   - Save image data, return updated folder list

[x] Update the generation so the current folder id is always added to a new generation.
1. In `server/server.mjs`, add current folder id to new image data
2. Add `folder` property to generated image data object in `/generate` endpoint
3. Add `folder` property to generated image data object in `/generate/inpaint` endpoint
4. Ensure folder value is set to currentFolder

[x] Update the gallery retrieval endpoint to take a folder uid query parameter. If this parameter is omitted, set the folder uid to the current folder. Change the gallery retrival so that 
1. Modify GET `/image-data` endpoint in `server/server.mjs` to accept `folder` query parameter
2. If `folder` query parameter is omitted, use currentFolder as the folder filter
3. Filter returned image data to only include items where `item.folder === folderId`
4. For "unsorted" folder (empty string or null uid), return items where folder is null, undefined, or empty string
5. Ensure backward compatibility with existing gallery queries

[] Create a text prompt dialog in custom-ui (if possible, place it in `dialog.mjs`) that has a title, text input, confirm, and cancel buttons.
1. In `public/js/custom-ui/dialog.mjs`, create `TextPromptDialog` component class extending Component:
```javascript
// TextPromptDialog
// Public methods: None (controlled via props)
// Props: { title, initialValue, placeholder, onConfirm, onCancel }
// State: { inputValue }
// Private methods:
//   - handleInputChange(e) - updates state.inputValue
//   - handleConfirm() - calls props.onConfirm with input value
//   - handleKeyDown(e) - handle Enter/Escape keys
//   - componentDidMount() - focus input, add listeners
//   - componentWillUnmount() - cleanup listeners
```
2. Render text input field with confirm/cancel buttons in dialog overlay using existing custom ui
3. Export `showTextPrompt(title, initialValue, placeholder)` function that returns a Promise
4. Promise resolves with input value on confirm, null on cancel
5. Add additional CSS styling for text input in `public/css/custom-ui.css`

[] Create a select folder modal, consisting of a vertical list of items, each containing the following columns: a label that can be clicked to select the folder, a button to rename the folder using the text prompt, and a button to delete the folder. When a folder is deleted, the folder attribute is deleted so all of its content are reassigned back to "unsorted". At the bottom right of the modal add an insert button (use the text prompt, and add and select the folder after the insert action) and a cancel button. the blank/unsorted option should always be available and on top of the list. Leave the handling of the select folder event to be implemented outside of the component.
1. Create new file `public/js/custom-ui/folder-select.mjs` with `FolderSelectModal` component:
```javascript
// FolderSelectModal component
// Public methods: None (controlled via props)
// Props: { isOpen, folders, currentFolder, onSelectFolder, onRenameFolder, onDeleteFolder, onInsertFolder, onClose }
// Private methods:
//   - componentDidMount() - fetch folder list from GET /folder
//   - handleFolderClick(uid) - calls props.onSelectFolder(uid)
//   - handleRenameClick(uid, label) - shows text prompt, calls props hander to call PUT /folder
//   - handleDeleteClick(uid) - shows confirmation, calls props hander to call DELETE /folder/:uid
//   - handleInsertClick() - shows text prompt, props hander to call calls POST /folder, then selects
// Internal components:
//   - FolderItem - for rendering a single row of folder item, with the same set of handler props
```
2. Fetch folder list before mount using GET `/folder` endpoint
3. Render scrollable list with "Unsorted" as first item (uid: "")
4. Each folder row contains: clickable label, rename icon button, delete icon button
5. Add footer with "New Folder" and "Cancel" buttons
6. Use `showTextPrompt` for rename and insert actions
7. Use `showDialog` with options for delete confirmation
8. Style the modal in `public/css/custom-ui.css` with proper layout

[] Add a folder button to the left of the gallery button in the main page, and left of the home button in the inpaint page, with the folder icon and the name of the current folder as the button's label. Clicking the button opens the select folder modal. When a folder is selected, change the current folder to the selected folder.
1. In `public/js/app.mjs` (main page), import `FolderSelectModal` from custom-ui
2. Add state to track current folder label
3. Fetch current folder on app load using GET `/folder`
4. Add folder button in the UI toolbar (use folder icon, display current folder label)
5. Add state to control modal open/close
6. When folder is selected in modal, call POST `/folder` to set current folder
7. Update current folder state and refresh gallery data
8. Repeat steps 1-7 for `public/inpaint.html` or its associated script file
9. Ensure folder button is positioned correctly in both pages

[] Update the edit endpoint so it accept an array of generation data objects. Update client calls to the edit endpoint to conform to the new format.
1. Modify POST `/edit` endpoint in `server/server.mjs` to accept both single object and array:
```javascript
// New request format:
// Array: [{ uid: 123, name: "..." }, { uid: 456, name: "..." }]
```
2. Check if request body is array using `Array.isArray(req.body)`, return error if it's not in the correct format
3. Iterate through each item and update corresponding image data
5. Return array of updated items or single item based on input
6. Update client call in `public/js/app.mjs` to send array format when updating multiple items

[] In the gallery, add a "Move" button to the right of the delete button. Only enable this when there are items selected in the gallery, and hide this when the gallery is in select mode. When the move button is clicked, open the select folder modal. When a folder is selected, use the updated edit endpoint to update the folder id for all selected items.
1. In `public/js/custom-ui/gallery.mjs`, import `FolderSelectModal`
2. Add "Move" button next to delete button in gallery toolbar
3. Add state to control folder modal visibility
4. Enable "Move" button only when `selectedItems.length > 0`
5. Hide "Move" button when `selectionMode === true`
6. On "Move" button click, open folder select modal
7. When folder is selected, prepare array of updated image data objects:
```javascript
const updates = selectedItems.map(item => ({
  ...item,
  folder: selectedFolderId
}));
```
8. Call POST `/edit` with array of updates
9. Refresh gallery data after successful move
10. Clear selection after move completes
