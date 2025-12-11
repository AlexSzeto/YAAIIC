# Image to Video Cleanup

## Goal
Tweak the UI to prevent user errors, clarify UI intent, and improve usability

[x] Disable inpainting for videos
- Disable the inpainting option when the currently viewed image from the gallery is a video (webp, webm, mp4, etc.)
1. In `GeneratedImageDisplay.setData()`, check if `data.imageUrl` ends with a video extension (webp, webm, mp4, gif)
2. Create a helper function `isVideoUrl(url)` that returns true for video extensions
3. Update the inpaint button disabled logic: `this.inpaintButton.disabled = !data.uid || isVideoUrl(data.imageUrl)`

[x] Disable input image (upload image) during generation
- Add a disabled state to the custom upload image component and disable it during image generation
1. Add a `disabled` prop to `ImageUpload` component
2. Update `render()` method to apply disabled styling when `props.disabled` is true:
   - Add `disabled` class to the upload area
   - Disable click handlers when disabled
   - Add visual styling for disabled state (greyed out, reduced opacity)
   ```javascript
   // In ImageUpload.render()
   const { disabled } = this.props;
   // Apply disabled class and prevent interactions
   ```
3. Add CSS for `.image-upload-area.disabled` in `index.css`:
   ```css
   .image-upload-area.disabled {
     opacity: 0.5;
     pointer-events: none;
     cursor: not-allowed;
   }
   ```
4. In `main.mjs`, add a `setImageUploadsDisabled(disabled)` function that iterates through `uploadComponentRefs` and updates their disabled state
5. Call `setImageUploadsDisabled(true)` at the start of `handleGenerate()` 
6. Call `setImageUploadsDisabled(false)` at the end of generation (success/error) in the SSE event handlers

[x] Filter videos (show image but grey out and make non-selectable) when gallery is in selection mode (add optional file type filter)
- Update the gallery preview component to grey out and make non-selectable when in selection mode
1. Add `fileTypeFilter` prop to `GalleryDisplay.showModal()` method signature:
   ```javascript
   /**
    * Show the modal
    * @param {boolean} selectionMode - Whether to show in selection mode
    * @param {Function} onSelect - Callback when an item is selected
    * @param {string} fileTypeFilter - Optional filter: 'image' or 'video'
    */
   showModal(selectionMode = false, onSelect = null, fileTypeFilter = null)
   ```
2. Store `fileTypeFilter` in component state
3. Add a utility function to determine if an item is a video (check file extension or workflow type in item data)
   ```javascript
   // Helper to check if item is a video
   isVideoItem(item) {
     // Check imageUrl extension for .mp4, .webm, .gif, .webp, etc.
   }
   ```
4. In `renderGalleryItems()`, when in selection mode with `fileTypeFilter === 'image'`, pass an additional prop to disable video items
5. Update `GalleryPreview` component to accept a `disabled` prop:
   - Add `disabled` styling (greyed out, reduced opacity)
   - Prevent click handler from firing when disabled
   - Add CSS class for disabled state
6. Add CSS for `.gallery-item.disabled` in `index.css`:
   ```css
   .gallery-item.disabled {
     opacity: 0.4;
     pointer-events: none;
   }
   ```
7. In `main.mjs`, update the gallery request handler (`handleGalleryRequest`) to pass `fileTypeFilter: 'image'` when opening gallery in selection mode

[x] Select input image from generated image preview
- In the generated image view, add a `Select` button that is only enabled when the currently selected workflow contains one or more available unfilled input image slot. The select button pushes the preview image info directly into the current workflow.
1. Add a `selectButton` property to `GeneratedImageDisplay` class to store reference to the select button
2. In the HTML structure (`index.html`), add a new "Select" button in the `.image-action-container` section:
   ```html
   <button class="image-select-btn btn-with-icon" title="Use this image as input">
     <box-icon name='check-circle' color='#ffffff' size='16px'></box-icon>
     Select
   </button>
   ```
3. In `GeneratedImageDisplay` constructor, get reference to the select button:
   ```javascript
   this.selectButton = baseElement.querySelector('.image-select-btn');
   ```
4. In `setupButtonListeners()`, add event listener for the select button:
   ```javascript
   this.selectButton.addEventListener('click', () => {
     this.selectImageAsInput();
   });
   ```
5. Create a new method `updateSelectButtonState()` in `GeneratedImageDisplay`:
   ```javascript
   /**
    * Update the select button's disabled state based on current workflow
    * Should be called whenever workflow changes or data changes
    */
   updateSelectButtonState() {
     // Get current workflow from main.mjs
     // Check if workflow has inputImages > 0
     // Check if any upload component slots are unfilled
     // Disable button if no workflow, video file, or all slots filled
     // Enable if there's at least one unfilled slot
   }
   ```
6. Create a callback property `onSelectAsInput` in `GeneratedImageDisplay` constructor to communicate with main.mjs:
   ```javascript
   constructor(baseElement, onUseField = null, onImageDeleted = null, onSelectAsInput = null) {
     // ...
     this.onSelectAsInput = onSelectAsInput;
   }
   ```
7. Create `selectImageAsInput()` method in `GeneratedImageDisplay`:
   ```javascript
   /**
    * Select the current image as input for the workflow
    */
   async selectImageAsInput() {
     if (!this.currentImageData || !this.currentImageData.imageUrl) {
       showErrorToast('No image to select');
       return;
     }
     
     if (isVideoUrl(this.currentImageData.imageUrl)) {
       showErrorToast('Cannot use video as input image');
       return;
     }
     
     // Call the callback to notify main.mjs
     if (this.onSelectAsInput) {
       this.onSelectAsInput(this.currentImageData);
     }
   }
   ```
8. In `setData()` method, call `updateSelectButtonState()` after setting data
9. In `main.mjs`, create a helper function `getCurrentWorkflow()`:
   ```javascript
   /**
    * Get the currently selected workflow object
    * @returns {Object|null} The selected workflow or null
    */
   function getCurrentWorkflow() {
     const workflowSelect = document.getElementById('workflow');
     if (!workflowSelect || !workflowSelect.value) return null;
     return workflows.find(w => w.name === workflowSelect.value);
   }
   ```
10. In `main.mjs`, create a helper function `getFirstUnfilledUploadIndex()`:
    ```javascript
    /**
     * Get the index of the first unfilled image upload component
     * @returns {number} Index of first unfilled component, or -1 if all filled or none exist
     */
    function getFirstUnfilledUploadIndex() {
      for (let i = 0; i < uploadComponentRefs.length; i++) {
        const component = uploadComponentRefs[i];
        if (component && typeof component.hasImage === 'function' && !component.hasImage()) {
          return i;
        }
      }
      return -1; // All slots filled or no components
    }
    ```
11. In `main.mjs`, create a callback function `handleSelectAsInput()`:
    ```javascript
    /**
     * Handle selection of an image from the preview to use as workflow input
     * @param {Object} imageData - The image data object containing imageUrl, uid, etc.
     */
    async function handleSelectAsInput(imageData) {
      const targetIndex = getFirstUnfilledUploadIndex();
      
      if (targetIndex === -1) {
        showErrorToast('All input image slots are filled');
        return;
      }
      
      try {
        // Fetch the image as a blob
        const response = await fetch(imageData.imageUrl);
        const blob = await response.blob();
        
        // Set it on the target upload component
        const component = uploadComponentRefs[targetIndex];
        if (component && typeof component.setImage === 'function') {
          component.setImage(blob, imageData.imageUrl);
          showSuccessToast('Image selected as input');
        } else {
          throw new Error('Upload component not available');
        }
      } catch (err) {
        console.error('Failed to select image as input:', err);
        showErrorToast('Failed to select image as input');
      }
    }
    ```
12. Update `GeneratedImageDisplay` initialization in `main.mjs` to pass the `onSelectAsInput` callback:
    ```javascript
    generatedImageDisplay = new GeneratedImageDisplay(
      document.getElementById('generatedImageDisplay'),
      handleUseField,
      handleImageDeleted,
      handleSelectAsInput
    );
    ```
13. Expose `getCurrentWorkflow()` and `getFirstUnfilledUploadIndex()` to `GeneratedImageDisplay` by creating a getter method `getWorkflowState()`:
    ```javascript
    /**
     * Get the current workflow state for updating UI elements
     * @returns {Object} Object containing workflow and unfilled slot information
     */
    function getWorkflowState() {
      const workflow = getCurrentWorkflow();
      const hasUnfilledSlot = getFirstUnfilledUploadIndex() !== -1;
      return { workflow, hasUnfilledSlot };
    }
    ```
14. Store reference to `getWorkflowState` in `GeneratedImageDisplay`:
    ```javascript
    constructor(baseElement, onUseField = null, onImageDeleted = null, onSelectAsInput = null, getWorkflowState = null) {
      // ...
      this.getWorkflowState = getWorkflowState;
    }
    ```
15. Update `updateSelectButtonState()` implementation to use `getWorkflowState`:
    ```javascript
    updateSelectButtonState() {
      if (!this.getWorkflowState) {
        this.selectButton.disabled = true;
        return;
      }
      
      const { workflow, hasUnfilledSlot } = this.getWorkflowState();
      const isVideo = this.currentImageData && isVideoUrl(this.currentImageData.imageUrl);
      
      // Enable only if: workflow exists, has input images, has unfilled slot, and current image is not a video
      const shouldEnable = workflow && 
                          workflow.inputImages > 0 && 
                          hasUnfilledSlot && 
                          !isVideo;
      
      this.selectButton.disabled = !shouldEnable;
    }
    ```
16. In `main.mjs`, call `generatedImageDisplay.updateSelectButtonState()` after workflow changes in `handleWorkflowChange()`:
    ```javascript
    // At the end of handleWorkflowChange()
    if (generatedImageDisplay && typeof generatedImageDisplay.updateSelectButtonState === 'function') {
      generatedImageDisplay.updateSelectButtonState();
    }
    ```
17. In `main.mjs`, call `generatedImageDisplay.updateSelectButtonState()` after setting images on upload components (in gallery selection callback and after clearing):
    ```javascript
    // After component.setImage() calls
    if (generatedImageDisplay && typeof generatedImageDisplay.updateSelectButtonState === 'function') {
      generatedImageDisplay.updateSelectButtonState();
    }
    ```
18. Update `GeneratedImageDisplay` initialization call to include `getWorkflowState`:
    ```javascript
    generatedImageDisplay = new GeneratedImageDisplay(
      document.getElementById('generatedImageDisplay'),
      handleUseField,
      handleImageDeleted,
      handleSelectAsInput,
      getWorkflowState
    );
    ```
19. Add CSS styling for the select button in `public/css/style.css`:
    ```css
    .image-select-btn {
      /* Similar styling to inpaint and delete buttons */
    }
    
    .image-select-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    ```
