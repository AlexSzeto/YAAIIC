# Audio Workflows

## Goals
Introduces mp3 and ogg type workflows. Audit existing server code and rename variables and endpoints that specifically mentions "image" to "media". Add generation viewer for audio by overlaying an audio player on top of the generated album image. In the gallery, use an additional speaker icon to represent audio files in the preview component. Change upload button to accept audio files. Change naming algorithm of uploads to detect name value from file name in various case formats (camel, snake, etc.). Allow workflow to send its own list of extra inputs (specifying id, default value,label, and type for each) and these must be sent as options for the client to render. Refactor video inputs to send length and frames as extra inputs. Refactor all image workflows to allow format customization, deleting the hard codedformat field. Finally, test with two manually added audio workflows.

New input types:
- text (single line, same as name, inserted where length/frames used to be)
- select (dropdown, requires list of string options, inserted where length/frames used to be)
- checkbox (boolean, inserted where length/frames used to be)
- textarea (multi line, same as prompt)

## Tasks

[x] Rename image-specific variables and endpoints to media-specific equivalents (batch 1)
   1. In `server/server.mjs`, rename `imageData` object to `mediaData`

[x] Rename image-specific variables and endpoints to media-specific equivalents (batch 2)
   1. Rename `loadImageData()` function to `loadMediaData()`
   2. Rename `saveImageData()` function to `saveMediaData()`
   3. Rename `addImageDataEntry()` function to `addMediaDataEntry()`
   4. Update references server side for import statements and function calls

[x] Rename image-specific variables and endpoints to media-specific equivalents (batch 3)
   1. Rename database file `database/image-data.json` references to `database/media-data.json`
   2. Update server route `/image-data` to `/media-data` and all its variants (`/media-data/:uid`, `/media-data/delete`)
   3. Update references server side for import statements and function calls
   4. Update all client-side JavaScript files in `public/js/` to use new `/media-data` endpoint

[x] Rename image-specific variables and endpoints to media-specific equivalents (batch 4)
   1. In `server/generate.mjs`, rename `handleImageGeneration()` to `handleMediaGeneration()`
   2. Rename `handleImageUpload()` to `handleMediaUpload()`
   3. Rename `uploadImageToComfyUI()` to `uploadFileToComfyUI()` and update to accept file type parameter
   4. Update references server side for import statements and function calls

[x] Rename image-specific variables and endpoints to media-specific equivalents (batch 5)   
   1. Rename static route `/image` to `/media` for serving files from storage folder
   2. Update `public/js/app.mjs` to use `/media` route for file URLs
   3. Update `public/js/gallery-preview.mjs` to use new endpoint names
   4. Update references server side for import statements and function calls
   5. On all client side mjs files, rename `imageData` variables to `mediaData`

[x] Rename media data attributes
   1. Rename media data attribute `savePath` to `saveImagePath`
   2. Rename media data attribute `saveFilename` to `saveImageFilename`
   3. Rename media data attribute `format` to `imageFormat`

[x] Refactor template format to support music generation lyric prompts (change brackets [] to double curly braces {{}})
   1. In `server/llm.mjs`, update template parsing logic to use double curly braces `{{}}` instead of square brackets `[]`
   2. Update the regex pattern that matches template variable placeholders from `\[variable\]` to `{{variable}}`
   3. In `server/resource/comfyui-workflows.json`, update all template strings in `preGenerationTasks` and `postGenerationTasks` to use `{{}}` syntax
   4. Update any template strings that reference variables like `[description]`, `[summary]`, `[image_0_summary]` to use `{{description}}`, `{{summary}}`, `{{image_0_summary}}` etc.
   5. Test that template replacement still works correctly with the new syntax
   6. Verify that existing generation and regeneration tasks using templates continue to function

[x] Implement audio file type support in workflows configuration
   1. In `server/resource/comfyui-workflows.json`, add new workflow option property `type` with values: "image", "video", or "audio"
   2. Update existing image workflows to explicitly set `"type": "image"`
   3. Update existing video workflows to have `"type": "video"`
   4. Add two example audio workflows with `"type": "audio"` (mp3 and ogg)
   5. For audio workflows, specify `audioFormat` (for audio file: "mp3" or "ogg") and hardcoded `imageFormat` (for album cover: "png" or "jpg")
   6. Audio workflows will require an additional set of output path attributes to be defined: `saveAudioPath` and `saveAudioFilename`
   
[x] Inject `ollamaAPIPath` into generation data
   1. In `server/server.mjs`, pass `config.ollamaAPIPath` to the `handleMediaGeneration()` function
   2. In `server/generate.mjs`, update `handleMediaGeneration()` to accept `ollamaAPIPath` parameter
   3. Add `ollamaAPIPath` to the generation data object that gets passed to workflow processing
   4. Ensure `ollamaAPIPath` is available for use in workflow `replace` mappings
   5. Update workflow schema documentation to indicate `ollamaAPIPath` is available as a variable
   6. Test that workflows can successfully reference `ollamaAPIPath` in their configuration

[x] Update file upload handling to support audio files
   1. In `server/server.mjs`, update multer configuration `fileFilter` to accept audio MIME types (audio/mpeg, audio/ogg, audio/*, etc.)
   2. Update file size limit if needed for audio files
   3. In `server/resource/comfyui-workflows.json`, add `defaultAudioGenerationWorkflow` property that references the name of an existing workflow for generating album covers
   4. Add `hidden` parameter to workflow options to mark workflows that shouldn't be included in client workflow lists
   5. Mark the album cover generation workflow as `"hidden": true`
   6. In `server/generate.mjs`, update `uploadFileToComfyUI()` to handle audio file types
   7. When an audio file is uploaded, automatically trigger the `defaultAudioGenerationWorkflow` to generate album cover image (marked as TODO for future implementation)
   8. Pass the extracted `name` value as an input parameter to the album cover generation workflow (will be implemented with subtask 7)
   9. Save both the uploaded audio file and generated album cover image to storage (audio file saved, album cover TODO)
   10. Link both files in the database entry (audio file URL and album cover image URL) (audio file linked, album cover TODO)
   11. Add audio file validation logic (implemented via multer fileFilter)
   12. Update error messages to reference "media" instead of "image"

[x] Implement smart file naming detection from uploaded files
   [x] 1. On the client `util.mjs`, create new function `extractNameFromFilename()` to detect various case formats
   [x] 2. Function should handle: camelCase, PascalCase, snake_case, kebab-case, and "Title Case With Spaces"
   [x] 3. Function should convert to title case with spaces format for the `name` field
   [x] 4. Update client handling before calling upload request to call this function and populate a new form field, `name`, or pass `null` if name detection is unsuccessful
   [x] 5. Add processing for the name field in the upload endpoint. If `name` is provided, add it to the `generationData` before starting `defaultImageGenerationTasks` or running `defaultAudioGenerationWorkflow`
   [x] 6. Complete the implementation for calling album generation workflow for audio uploads

[x] Update client upload button to support audio formats
   1. Update `accept` attribute in main upload input to accept both image and audio files
   2. Update `handleUploadFile` to detect file type (image vs audio)
   3. Route audio files to `/upload/audio` endpoint and images to `/upload/image` endpoint
   4. Use appropriate form field name ('audio' or 'image') based on file type
   5. Update validation messages to reference "image or audio file"

[x] Add audio player component overlay for generation view
   1. Create new component `public/js/custom-ui/audio-player.mjs` for audio playback
   2. Audio player should have play/pause button, progress bar, current time and duration display
   3. Style audio player as an overlay that sits on top of the album image
   4. Audio player overlay should be positioned at the bottom of the album image with semi-transparent background
   5. In `public/js/app.mjs`, detect workflow type and conditionally render audio player overlay when workflow is audio type
   6. Display album image in the generation viewer as normal, with audio player overlaid
   7. Ensure audio player properly receives audio file URL and album image URL
   8. Handle loading states for both audio file and album image

[x] Update gallery preview to show speaker icon overlay for audio files
   1. In `public/js/gallery-preview.mjs`, detect media type from file extension or workflow type metadata
   2. Add small play/stop icon button (using existing custom button) as an overlay on audio file thumbnails. link its click event to a global audio player object.
   3. Display album image as the thumbnail for audio files (same as regular images)
   4. Position button left of name and date to indicate audio content
   5. Keep a global audio player at the app level. When a new audio is sent to the player, the previous audio stops. Use the currently playing audio path to allow the buttons to track which audio is playing without needing the gallery to pass anything into the preview component.
   6. Disable preview click handler for audio files in gallery mode

[x] Implement extra inputs system for workflows
   1. In `server/resource/comfyui-workflows.json`, add new optional property `extraInputs` array to workflow options
   2. Each extra input object should have: `id` (string), `label` (string), `type` (text/number/select/checkbox/textarea), `default` (any), and `options` (array of `label` and `value` objects, for select type)
   3. Update workflow specification and schema to document the new extra inputs format
   1. Update video workflows in `comfyui-workflows.json` to remove hardcoded `length` and `frames` fields
   2. Add `extraInputs` to video workflows with `length` (text type, default value) and `framerate` (text type, default value)


[x] Render extra inputs in client UI
   1. In `public/js/app.mjs`, fetch workflow configuration when workflow is selected
   2. Create function `renderExtraInputs()` to dynamically generate form fields based on workflow's `extraInputs`
   3. For "number" type: render number input
   3. For "text" type: render single-line text input
   4. For "textarea" type: render multi-line textarea (similar to prompt field)
   5. For "select" type: render dropdown with provided options (label, value)
   6. For "checkbox" type: render checkbox input
   7. Position extra inputs in the UI between existing controls (where video length/frames currently appear) except for textarea types, which would be placed below the prompt input
   8. Apply consistent styling to match existing form controls (number to the frames/framerate input, text to name, textarea to prompt, etc)

[x] Refactor video workflows to use extra inputs
   3. Update `server/generate.mjs` to read these values from request body as extra input values
   4. Update video workflow `replace` mappings to use new extra input field names
   5. Test that video generation still works with new extra input system

[] Enable format customization for workflows
   1. Add `imageFormat` as an extra input for all workflows that currently have hardcoded `imageFormat` field (label "Image Format")
   1. Add `audioFormat` as an extra input for all workflows that currently have hardcoded `audioFormat` field (label "Audio Format")
   2. Extra input should be select type with options: ["png", "jpg", "webp"] or ["mp3", "wav", "flac", "ogg"]
   3. Remove hardcoded `imageFormat` and `audioFormat` property from workflow definitions
   4. Update `server/server.mjs` generate endpoint to use format from extra inputs. for all audio workflows and the album workflow, add the following preGenerationTask:
   ```
   {
      "template": "jpg",
      "to": "imageFormat"
   }
   ```
   For video workflows, add:
   ```
   {
      "template": "webp",
      "to": "imageFormat"
   }
   ```
   5. Ensure filename generation uses the extra input instead of the workflow values. Fail gracefully if a required value is missing (imageFormat for image/videos, plus audioFormat for audios). compute the output filename after pre generation tasks.

[] Submit extra input values during generation
   1. In `public/js/app.mjs`, collect values from all extra input fields on form submit
   2. Include extra input values in the request body when calling `/generate` endpoint
   3. Ensure proper serialization of different input types (text, boolean, etc.)
   4. Update `server/server.mjs` generate endpoint to accept and validate extra input values
   5. Pass extra inputs to workflow generation logic in `server/generate.mjs`

[] Test audio workflows end-to-end
   1. Manually test generating audio with first example audio workflow
   2. Verify both audio file and album image are saved with correct formats
   3. Verify album image displays in generation view with audio player overlay
   4. Verify audio player overlay renders correctly on top of album image
   5. Verify audio playback works in browser
   6. Manually test second example audio workflow
   7. Verify audio files appear with album image thumbnails and speaker icon overlay in gallery
   8. Test clicking audio preview in gallery opens proper viewer with audio player
   9. Verify database entry is created correctly with both image URL and audio URL in metadata
   10. Test regenerating metadata fields for audio entries
   11. Verify upload functionality works for audio files with proper name detection
   12. Verify both files (image and audio) are properly linked in the database