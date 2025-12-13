# Video Generation Improvements

## Goal
- Update the video length frame number so it must fit in the formula (X * 4) + 1
- Move video properties between 1st and 3rd row (between workflow and descriptions)
- client side Change length in seconds to number of frames (length)
- Unify gallery behavior so new generations are always added to the start and gallery resets to viewing the first item

[x] (Client) Remove the close button in the upper right corner of the image preview modal, and maintain current capability to close the image preview modal by clicking outside of it.
1. Locate the close button creation code in `public/js/custom-ui/modal.mjs` within the `createImageModal` function
2. Remove the close button element creation and all associated event listeners
3. Remove the `modalWrapper.appendChild(closeButton)` call
4. Keep the overlay click handler that closes modal when clicking outside the image
5. Keep the escape key handler for closing the modal
6. Test that modal still closes properly via overlay click and escape key

[x] (Client) Enable the select button on image preview during gallery view. When selected, immediately load in a gallery with 1 image that consist of the selected image only.
1. Locate where image modals are opened from gallery in `public/js/custom-ui/gallery.mjs` (likely in the `GalleryPreview` component)
2. Update the `handleImageClick` or equivalent method to pass an `onSelect` callback when calling `createImageModal`
3. The `onSelect` callback should:
   - Receive the selected image URL
   - Create a new gallery data array with only the selected item
   - Call the gallery's method to load this single-item array
   - Close the modal
4. Verify that the select button appears in gallery image modals
5. Test that clicking select properly creates a single-item gallery

[x] (Client) Create a new row in the generate form in the main page specifically for video workflow types, and move the Length and Frame rate fields into the new row. Hide this row if the currently selected workflow is not a video workflow. Ensure the following: that all form fields should still exist within the same container, that length and frame rate should be placed below workflow, name, and seed, and that length and frame rate should be above description. Also ensure that after moving the form fields, length and frame rate maintains the css formatting that places the label above the input while still not stretching to fill the entire horizontal space.
1. In `public/index.html`, locate the form structure within the main page
2. Identify the existing length and frame rate form fields
3. Create a new container div for the video-specific row:
```html
<div id="video-controls-row" style="display: none;">
  <!-- Length and frame rate fields will be moved here -->
</div>
```
4. Move the length and frame rate form groups into this new container
5. Position the new container after the seed field and before the description field
6. In `public/js/main.mjs`, locate the workflow change event handler
7. Update the handler to show/hide the `video-controls-row` based on workflow type:
```javascript
// Check if current workflow is video type
const isVideoWorkflow = selectedWorkflow.type === 'video' || 
                       selectedWorkflow.name.toLowerCase().includes('video');
const videoControlsRow = document.getElementById('video-controls-row');
if (videoControlsRow) {
  videoControlsRow.style.display = isVideoWorkflow ? 'flex' : 'none';
}
```
8. Ensure the form groups within the video row use flexbox or grid to maintain vertical label positioning
9. Add CSS rules in `public/css/style.css` if needed:
```css
#video-controls-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

#video-controls-row .form-group {
  flex: 0 1 auto;
  min-width: 150px;
}
```
10. Test with video and non-video workflows to verify show/hide behavior
11. Verify that form submission still captures all field values correctly

[x] (Client) Change the video `frames` field to use the label `Length (frames)`, and update the logic so that the value sent to the server is no longer based on frame rate, but it must be a number in the following sequence: `(n * 4) + 1`, where `n` is 0 or greater. For example, acceptable frame numbers would start with `1, 5, 9, 13, ...`. Do not restrict the number the user can input, but modify the number, rounding up to the next valid number if necessary, before it is sent to the server. Change the default length to `25`.
1. Update `public/index.html`: change the label from "Length (seconds):" to "Length (frames):"
2. Change the input `id` and `name` from "length" to "frames" if needed, or keep as "length" but update semantics
3. Update the input's `value` attribute to "25" as the new default
4. Remove or adjust `min`, `max`, and `step` attributes to accept any positive integer
5. In `public/js/main.mjs`, locate where the form data is collected for generation
6. Create a helper function `normalizeFrameCount(inputValue)`:
```javascript
// Normalize frame count to (n * 4) + 1 sequence
function normalizeFrameCount(inputValue) {
  const num = parseInt(inputValue, 10);
  if (isNaN(num) || num < 1) return 1;
  // Calculate n where (n * 4) + 1 >= num
  const n = Math.ceil((num - 1) / 4);
  return (n * 4) + 1;
}
```
7. Apply this normalization function to the length/frames value before sending to server
8. Test with various inputs (e.g., 1, 10, 25, 30) to verify correct normalization

[] (Client) Insert a new form field, `orientation`, for video workflows, where the field is a dropdown and users can choose between the value `portrait` or `landscape`.
1. In `public/index.html`, add a new form group within the `video-controls-row` created in the previous task:
```html
<div class="form-group">
  <label for="orientation">Orientation:</label>
  <select id="orientation" name="orientation">
    <option value="portrait">Portrait</option>
    <option value="landscape">Landscape</option>
  </select>
</div>
```
2. Position the orientation field alongside length and frame rate fields in the video controls row
3. In `public/js/main.mjs`, update the form data collection function to include the orientation value:
```javascript
// Get orientation value
const orientationField = document.getElementById('orientation');
if (orientationField && orientationField.offsetParent !== null) {
  formData.orientation = orientationField.value;
}
```
4. Ensure the orientation field is visible when video workflows are selected (already handled by showing video-controls-row)
5. Set a default value for orientation (e.g., `landscape`) by adding `selected` attribute to one option
6. Test that the orientation value is included in generation requests for video workflows

[] (Server) Rename all references of `preGenerationPrompts` to `preGenerationTasks`, and `postGenerationPrompts` to `postGenerationTasks`.
1. In `server/generate.mjs`, use search and replace to change all occurrences of `preGenerationPrompts` to `preGenerationTasks`
2. In `server/generate.mjs`, use search and replace to change all occurrences of `postGenerationPrompts` to `postGenerationTasks`
3. In `server/server.mjs`, update any references to these properties in workflow configuration loading or validation
4. Search all workflow JSON files in `server/resource/` directory:
   - Update `wan-image-to-video.json`
   - Update `wan5b-image-to-video.json`
   - Update `wan5b-image-to-video-loop.json`
   - Update any other workflow files that reference these properties
5. Check `server/config.json` and `server/config.default.json` for any references to these property names and update them
6. Verify that the renamed properties are correctly accessed in all code paths
7. Test generation workflows that use pre-generation and post-generation tasks to ensure they still execute correctly
8. Check console logs to confirm tasks are being recognized and executed

[] (Server) Implement a simple conditional data check.
1. In `server/util.mjs`, create a new utility function `checkExecutionCondition`:
```javascript
/**
 * Check if an execution condition is met
 * @param {Object} dataSources - Object containing data sources like { generationData: {...}, value: ... }
 * @param {Object} conditionData - Condition object with structure: { where: {...}, equals: {...} }
 * @returns {boolean} True if condition is met, false otherwise
 */
export function checkExecutionCondition(dataSources, conditionData) {
  if (!conditionData) return true; // No condition means always execute
  
  const { where, equals } = conditionData;
  if (!where || !equals) return true;
  
  /**
   * Helper function to resolve a value from data sources
   * @param {Object} valueSpec - Object like { generationData: "key" } or { value: "directValue" }
   * @returns {*} The resolved value
   */
  const resolveValue = (valueSpec) => {
    const specKeys = Object.keys(valueSpec);
    if (specKeys.length === 0) return undefined;
    
    const sourceKey = specKeys[0]; // e.g., "generationData" or "value"
    
    // If sourceKey is "value", return the direct value
    if (sourceKey === 'value') {
      return valueSpec.value;
    }
    
    // Otherwise, resolve from data sources
    const dataKey = valueSpec[sourceKey]; // e.g., "orientation"
    const sourceData = dataSources[sourceKey];
    if (!sourceData) return undefined;
    
    return sourceData[dataKey];
  };
  
  // Resolve the actual value from 'where'
  const actualValue = resolveValue(where);
  
  // Resolve the expected value from 'equals'
  const expectedValue = resolveValue(equals);
  
  // Compare values
  return actualValue === expectedValue;
}
```
2. In `server/generate.mjs`, import the `checkExecutionCondition` function
3. Locate the pre-generation tasks processing loop (around line 518)
4. Update the loop to check conditions before executing each task:
```javascript
// Check if task has a condition
if (promptConfig.condition) {
  const dataSources = {
    generationData: generationData,
    value: generationData // Allow 'value' as alias for backward compatibility
  };
  const shouldExecute = checkExecutionCondition(dataSources, promptConfig.condition);
  if (!shouldExecute) {
    console.log(`Skipping pre-generation task due to unmet condition`);
    continue;
  }
}
```
5. Locate the workflow modifications processing (around line 580-620)
6. Add similar conditional checking for workflow modifications:
```javascript
for (const modification of modifications) {
  if (modification.condition) {
    const dataSources = {
      generationData: generationData,
      value: generationData
    };
    const shouldExecute = checkExecutionCondition(dataSources, modification.condition);
    if (!shouldExecute) {
      console.log(`Skipping workflow modification due to unmet condition`);
      continue;
    }
  }
  // Apply modification...
}
```
7. Locate the post-generation tasks processing loop (around line 365)
8. Add conditional checking for post-generation tasks similarly
9. Test with a sample workflow config that includes conditional tasks based on orientation

[] Unify gallery behavior so new generations are always added to the start and gallery resets to viewing the first item
1. In `public/js/carousel-setup.mjs`, modify the `addData` method to insert at the beginning:
```javascript
addData(data) {
  if (!data) return;
  
  // Insert at the beginning instead of end
  const newDataList = [data, ...this.dataList];
  this.dataList = newDataList;
  
  // Update pagination component with new data
  this.pagination.setDataList(this.dataList);
  
  // Move to the first item (index 0) instead of last
  setTimeout(() => {
    try {
      this.pagination.goToPage(0);
    } catch (error) {
      console.warn('Failed to navigate to first page:', error.message);
    }
  }, 0);
  
  // Update container visibility
  this.baseElement.style.display = 'block';
  
  console.log('CarouselDisplay data added at start, moved to index 0');
}
```
2. In `public/js/carousel-setup.mjs`, update the `setData` method to always navigate to the first page (index 0) instead of trying to maintain previous selection
3. In `public/js/inpaint.mjs`, locate where inpaint history is updated (around line 498)
4. Change `inpaintHistory.push(currentImageData)` to `inpaintHistory.unshift(currentImageData)` to add at the beginning
5. Update the inpaint history navigation to go to index 0 after adding new item
6. In `public/js/main.mjs`, locate the image upload handler
7. Update upload handling to:
   - Create a single-item gallery with the uploaded image
   - Show the gallery modal automatically
   - Navigate to the first (and only) item
8. In `public/js/main.mjs`, locate the generation completion handler (SSE event handler)
9. Update to automatically show gallery when generation completes:
```javascript
// After adding data to carousel
carouselDisplay.addData(completionData.result);
// Also show gallery with the new item
if (galleryDisplay) {
  galleryDisplay.showModal(false, null, null); // Show without selection mode
}
```
10. Test all four scenarios: upload, generation, gallery load, and inpaint to ensure consistent behavior