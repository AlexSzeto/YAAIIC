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

[x] Enable format customization for workflows
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

[x] Submit extra input values during generation
   1. In `public/js/app.mjs`, collect values from all extra input fields on form submit
   2. Include extra input values in the request body when calling `/generate` endpoint
   3. Ensure proper serialization of different input types (text, boolean, etc.)
   4. Update `server/server.mjs` generate endpoint to accept and validate extra input values
   5. Pass extra inputs to workflow generation logic in `server/generate.mjs`

[x] Move the hidden parameter outside of the options object in the workflow schema, and implement not sending these parameters on workflow list requests.
   1. In `server/resource/comfyui-workflows.json`, move the `hidden` property from nested within `options` to the top level of each workflow object
   2. Update workflow schema documentation to reflect that `hidden` is a top-level property
   3. In `server/server.mjs`, locate the endpoint that serves the workflow list (GET `/workflows` or similar)
   4. Add filtering logic to exclude workflows where `hidden: true` from the response
   5. Ensure internal server code can still access hidden workflows when needed (e.g., for `defaultAudioGenerationWorkflow`)
   6. Test that hidden workflows do not appear in client workflow selection dropdown
   7. Test that generation still works with hidden workflows when they are referenced programmatically

[x] Refactor the `renderExtraInputs` function outside of `app.mjs` and reuse it to generate extra inputs for the inpaint form. send these extra inputs for the inpaint requests.
   1. Create new utility file `public/js/app-ui/extra-inputs-renderer.mjs` to house the reusable extra inputs rendering logic
   2. Move `renderExtraInputs()` function from `app.mjs` to the new file
   5. Update `public/js/app.mjs` to import and use the refactored `createExtraInputsRenderer()`
   6. Test that main generation UI still works correctly with refactored function
   7. In `public/js/inpaint-page.mjs`, import `createExtraInputsRenderer()`
   8. Locate the inpaint form initialization code
   9. Fetch the selected workflow configuration to get its `extraInputs` definition
   10. Add a container element in the inpaint form HTML structure for extra inputs (between existing form controls)
   11. Call `createExtraInputsRenderer()` with the container and workflow config when workflow is selected
   12. Update form submission handler to collect extra input values
   13. Include extra input values in the request body when calling the inpaint generation endpoint
   14. In `server/server.mjs`, update the inpaint endpoint to accept and pass extra inputs to the generation logic
   15. Test that inpaint page correctly renders and submits extra inputs

[x] Add `type` from the workflow definition to `generationData` at the start of the generation. Create a migration utilility script, `/migrate/add-workflow-types-to-db.mjs`, to determine the workflow type using the output file format and write it back to existing entries missing this data. Run the util script to backfill the database entries.
   1. In `server/generate.mjs`, locate the `handleMediaGeneration()` function
   2. After loading workflow configuration, add the workflow's `type` property to `generationData` object (e.g., `generationData.type = workflow.options.type`)
   3. Ensure the `type` value is saved to the database when `addMediaDataEntry()` is called
   4. Create new directory `migrate/` in the project root if it doesn't exist
   5. Create new file `migrate/add_workflow-types-to-db.mjs` for the migration script
   6. In the migration script, import necessary modules (`fs`, path utilities, and database functions)
   7. Load all media data entries from `server/database/media-data.json`
   8. For each entry that is missing the `type` property, determine type based on file extensions:
      - If `saveAudioPath` or `saveAudioFilename` exists, set `type` to "audio"
      - Else if entry has video indicators (e.g., workflow name contains "video", or duration/frames metadata, filename contains `webp`), set `type` to "video"
      - Otherwise, set `type` to "image"
   9. Write updated media data back to the database file, in a new property in root: `mediaData`
   10. Add logging to show how many entries were updated
   11. Run the migration script using `node migrate/add_workflow_types_to_db.mjs`
   12. Verify database entries now have `type` property populated correctly
   13. Modify the server to reference `mediaData` when it tries to access `imageData`
   13. Test that newly generated media automatically includes the correct `type` value

[x] On the workflow selector, add a dropdown select to the left of the current workflow select with the label "Workflow Type" and a list of type options. Filter the workflows available for selection for the existing, full width select component by the currently selected type. Allow the options to be passed in as parameters with `label` and `value`, and if only one item is passed in, hide the workflow type select. Pass in "Image", "Video", "Audio" for the index page and just "Inpaint" for the inpaint page.

[x] Rewrite `isSelectDisabled` property for `GeneratedResult` to base the required image type on the current workflow's `type` attribute.
[x] Insert `isInpaintDisabled` property for `GeneratedResult` and move the logic into `app.mjs`. Rewrite the type detection logic using the media data's `type` attribute.

[x] Update the gallery select mode to filter for specific generation types (image/audio/video), hiding unfit formats similar to how it currently behaves (which is to disable entries not matching the desired format). Refactor the image select component to use the filter.
   1. In `public/js/gallery-preview.mjs`, locate the code that handles selection mode rendering and disabling logic
   2. Identify where media entries are currently being disabled based on format compatibility
   3. Create new function `shouldDisableMediaForSelection(mediaEntry, allowedTypes)` that checks if media type matches allowed types
   4. Function should accept a media entry object and an array of allowed types (e.g., `["image"]`, `["audio"]`, `["image", "video"]`)
   5. Function should return `true` if media entry's `type` property is NOT in the allowedTypes array
   6. Update the gallery preview component to use this function when rendering items in selection mode
   7. Apply disabled state (greyed out, unclickable) to media entries that don't match the filter, reusing existing `gallery-item disabled` class
   8. In `public/js/custom-ui/image-select.mjs`, locate where the component triggers gallery selection mode
   9. Update the component to pass `allowedTypes: ["image"]` parameter when opening the gallery
   10. Ensure disabled entries show visual feedback (reduced opacity, cursor not-allowed, etc.)
   12. Test that image-select component disables all non-image media in the gallery
   13. Test that attempting to click disabled entries does not trigger selection
   14. Verify visual styling clearly indicates which entries are selectable vs disabled

[x] Create audio-select component, replicating the general layout of the image-select component with the following differences: use speaker icon instead of picture icon, and add a play/pause icon button between the clear and replace button that uses the global audio player to play back the currently selected audio. Add copies of this component after the image select components depending on the number of audio files required, and send these audio files to the generation workflow in the same way that the image files are being added to the form.

[x] Ensure that an audioUrl is created, saved to the database, and passed back to the client at the end of the audio workflow.
   1. Added `audioUrl` creation when `saveAudioPath` is generated (in `server/generate.mjs`)
   2. Added verification that audio file exists after workflow execution for audio workflows
   3. Confirmed that `audioUrl` is included in database save and SSE completion event
   4. Verified client code properly receives and uses `audioUrl` from the result
   5. Confirmed existing audio entries in database already have `audioUrl` properly saved

[x] Implement the logic to upload audio files to comfyUI, with the expected input having a similar format to uploaded images (using `audio_X`). Update the logic for choosing a filename for comfyUI uploads so that the name from the storage folder is reused (including the file extension - currently, the upload incorrectly hard codes the file type to png), meaning if the same file is uploaded twice into ComfyUI it should overwrite an existing file instead of creating a new file. This applies to inpaint as well - except for the mask image, which should be named as `mask_${imageWidth}_${imageHeight}_${x1}_${y1}_${x2}_${y2}` so masks covering an identical area should end up having the same filename.
   1. Updated ComfyUI upload logic to reuse storage filenames with proper extensions instead of hardcoded `.png`
   2. For image inputs from gallery: extract filename from mediaData URL to preserve extension
   3. For audio inputs: implemented upload to ComfyUI using storage filename (with extension)
   4. For inpaint mask: implemented dimension-based naming using `mask_${width}_${height}_${x1}_${y1}_${x2}_${y2}.png`
   5. Audio files now properly upload to ComfyUI when workflow requires them (via `upload` spec)

[x] Update the logic for the media upload `upload/image` and `upload/audio` such that the filename in `/storage` would be replaced using the same algorithm as generated media files (`${type}_${latestIndex}`), while keeping its original extension.
   1. Changed storage upload naming from `upload_${timestamp}${ext}` to `${type}_${latestIndex}${ext}`
   2. Uses `findNextIndex()` function to get next available index for file type
   3. Preserves original file extension from uploaded file
   4. Applies to both image and audio uploads

[] in the image modal overlay, when an action button is present, move that button to its own area below the image to the bottom right, and expand the modal vertically to fit the button.

[] Test audio workflows end-to-end
   1. Manually test generating audio with first example audio workflow (mp3)
   2. Verify both audio file (mp3) and album image are saved with correct formats to storage folder
   3. Verify database entry includes both `saveAudioPath`/`saveAudioFilename` and `saveImagePath`/`saveImageFilename` 
   4. Verify media data entry has correct workflow type set to "audio"
   5. Open generation view and verify album image displays correctly
   6. Verify audio player overlay renders correctly positioned on top of album image
   7. Verify audio player controls (play/pause button, progress bar, time display) work correctly
   8. Verify audio playback starts and stops properly in generation view
   9. Test seeking in audio player progress bar
   10. Manually test second example audio workflow (ogg format)
   11. Verify ogg audio file generation and album image work correctly
   12. Navigate to gallery and verify audio entries appear with album image thumbnails
   13. Verify speaker icon overlay appears on audio file thumbnails in gallery
   14. Click play button on audio thumbnail in gallery and verify global audio player starts playback
   15. Click play on different audio thumbnail and verify previous audio stops, new one plays
   16. Verify clicking audio thumbnail in gallery does NOT open full viewer (audio playback only)
   17. Test that clicking the thumbnail image area (not the play button) opens the generation viewer
   18. In generation viewer for audio, verify audio player overlay is present and functional
   19. Test regenerating metadata fields (name, prompt, tags) for audio entries
   20. Verify regeneration maintains both audio and image file associations
   21. Test uploading an audio file via upload button
   22. Verify upload accepts mp3, ogg, wav, and other common audio formats
   23. Verify filename-based name detection works for uploaded audio files (camelCase, snake_case, etc.)
   24. Verify uploaded audio triggers automatic album cover generation
   25. Verify database entry is created with both uploaded audio path and generated album image path
   26. Test that uploaded audio entries appear correctly in gallery with speaker icon
   27. Test extra inputs with audio workflows (if applicable - format selection, duration, etc.)
   28. Verify audio format extra input allows selecting between mp3, ogg, wav, flac
   29. Test generating audio with different format selections and verify correct file extensions
   30. Test error handling: invalid audio workflow, missing audio file, playback errors
   31. Test that hidden album cover generation workflow does not appear in workflow selection dropdown
   32. Verify console logs show no errors during audio generation, upload, or playback
   33. Test audio functionality across different browsers (Chrome, Firefox, Edge) if possible