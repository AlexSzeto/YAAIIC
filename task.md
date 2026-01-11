# Export to Destination

## Goals
Create a configurable list of export destinations and allow the user to export files via an action in the generated result UI.

## Implementation Details
- Refactor `folder-select.mjs` and make the folder selection modal into a list selection modal, with customizable title, list item icons, and label for the new action button.
- Export to destination data object:
```json
{
   "id": "save-to-safekeep-pretty-pics",
    "name": "Safekeep Pretty Pics",
    "exportType": "save",
    "types": ["image", "video"],
    "folderTemplate": "C:\\safekeep-pretty-pics\\",
    "filenameTemplate": "{{name|split-by-spaces|snakecase|lowercase}}",
}
```
- Export to endpoint data object:
```json
{
   "id": "save-to-dm-tools",
   "name": "Saved to DM Tools",
   "exportType": "post",
   "types": ["image"],
   "filenameTemplate": "{{name|split-by-spaces|snakecase|lowercase}}",
   "endpoint": "https://localhost:5000/campaign/media",
   "prepareDataTasks": [
      {
         "from": "image_0",
         "to": "file"
      },
      {
         "template": "images",
         "to": "subtype"
      },
      {
         "template": "{{orientation}}",
         "to": "tags"
      }
   ],
   "sendProperties": ["name", "file", "subtype", "tags"]
}
```
- On the client, add a new action to the generated result UI , "Export", that allows the user to export the result to a destination. Clicking it opens a list selection modal with the list of export destinations that fits one of the export's supported types. Disable edit/delete on the list items, and disable the create new item action for now. Adding/Editing exports will be added in a future task. Selecting one of the export list item triggers the export process.
- All template substitutions need to support pipes. Pipes are separated by a vertical bar (|) and are applied in order. Supported pipes include:
    - `split-by-spaces` splits the string by spaces and temporarily changes the data type to an array of strings.
    - `snakecase`  joins the array of strings into a snake case string.
    - `camelcase` joins the array of strings into a camel case string.
    - `kebabcase` joins the array of strings into a kebab case string.
    - `titlecase` joins the array of strings into a title case string.
    - `join-by-spaces` joins the array of strings into a space separated string.
    - `lowercase` turns each array element into a lowercase string, or the string into a lowercase string if it is not an array.
    - `uppercase` turns each array element into an uppercase string, or the string into an uppercase string if it is not an array.
- If at the end of the pipe the data type is an array, it will be joined without any spaces.
- Server serves a list of export names and types at `/exports`.
- Server accepts export request from `POST` `/export`. The request body:
```json
{
   "exportId": "save-to-safekeep-pretty-pics",
   "mediaId": "123",
}
```
- The filename of the save destination or blob object is created by parsing the file name template with the extension of `imageFormat` or `audioFormat` from the media data object.
- The order of operations for export to endpoint goes:
   - start with the media data object of the media being exported.
   - prepare data by running the prepare data tasks, using the same object tranformation methods that generation workflows go through. Two special cases: for "image_0", load the image data and prepare it as a blob for upload in the specified format, giving it a filename using the method mentioned above. For "audio_0", load the audio data and prepare it as a blob for upload in the specified format.
   - filter out any properties that are not in the sendProperties array.
   - send the data to the endpoint using the POST method and the filtered properties as the JSON body. Upload any blobs as files.
- The order of operations for export to folder goes:
   - start with the media data object of the media being exported.
   - resolve the storage path of the file from `imageUrl` or `audioUrl` (refactor the media storage resolver from media `GET` to DRY this).
   - parse the folder and file name template and resolve the destination path.
   - copy the file to the destination folder using the resolved path.

## Tasks