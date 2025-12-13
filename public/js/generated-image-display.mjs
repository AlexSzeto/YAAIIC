// Generated Image Display Module
import { sendToClipboard, fetchWithRetry, FetchError } from './util.mjs';
import { createImageModal } from './custom-ui/modal.mjs';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.mjs';
import { showDialog } from './custom-ui/dialog.mjs';

// Video file extensions that cannot be inpainted
const VIDEO_EXTENSIONS = ['.webp', '.webm', '.mp4', '.gif'];

/**
 * Check if a URL points to a video file based on extension
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL ends with a video extension
 */
function isVideoUrl(url) {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lowerUrl.endsWith(ext));
}

export class GeneratedImageDisplay {
  constructor(baseElement, onUseField = null, onImageDeleted = null, onSelectAsInput = null, getWorkflowState = null) {
    if (!baseElement) {
      throw new Error('BaseElement is required for GeneratedImageDisplay');
    }
    
    this.baseElement = baseElement;
    this.onUseField = onUseField;
    this.onImageDeleted = onImageDeleted; // Callback for when image is deleted
    this.onSelectAsInput = onSelectAsInput; // Callback for when image is selected as input
    this.getWorkflowState = getWorkflowState; // Function to get current workflow state
    this.currentImageData = null; // Store current image data including uid
    
    // Track edit state
    this.editState = {
      isEditing: false,
      fieldBeingEdited: null, // 'name', 'tags', 'description', 'seed', or 'workflow'
      originalValue: null,
      fieldElement: null,
      originalHTML: null
    };
    
    // Get references to the inner elements
    this.imageElement = baseElement.querySelector('.generated-image');
    this.workflowInput = baseElement.querySelector('.info-workflow');
    this.nameInput = baseElement.querySelector('.info-name');
    this.tagsField = baseElement.querySelector('.info-tags-field');
    this.promptTextarea = baseElement.querySelector('.info-prompt');
    this.descriptionTextarea = baseElement.querySelector('.info-description');
    this.seedInput = baseElement.querySelector('.info-seed');
    this.selectButton = baseElement.querySelector('.image-select-btn');
    this.inpaintButton = baseElement.querySelector('.image-inpaint-btn');
    this.deleteButton = baseElement.querySelector('.image-delete-btn');
    
    // Validate that all required elements exist
    if (!this.imageElement || !this.workflowInput || !this.nameInput || !this.tagsField || 
        !this.promptTextarea || !this.descriptionTextarea || !this.seedInput || !this.selectButton || !this.inpaintButton || !this.deleteButton) {
      throw new Error('GeneratedImageDisplay: Required inner elements not found in baseElement');
    }
    
    // Set up button event listeners
    this.setupButtonListeners();
    
    console.log('GeneratedImageDisplay initialized successfully');
  }
  
  /**
   * Set up event listeners for copy, use, and edit buttons
   */
  setupButtonListeners() {
    // Get all copy, use, and edit buttons
    const copyButtons = this.baseElement.querySelectorAll('.copy-btn');
    const useButtons = this.baseElement.querySelectorAll('.use-btn');
    const editButtons = this.baseElement.querySelectorAll('.edit-btn');
    
    // Set up copy button listeners
    copyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const field = e.target.closest('.copy-btn').getAttribute('data-field');
        this.copyFieldToClipboard(field);
      });
    });
    
    // Set up use button listeners
    useButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const field = e.target.closest('.use-btn').getAttribute('data-field');
        this.useFieldInForm(field);
      });
    });
    
    // Set up edit button listeners
    editButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const field = e.target.closest('.edit-btn').getAttribute('data-field');
        this._enterEditMode(field);
      });
    });
    
    // Set up select button listener
    this.selectButton.addEventListener('click', () => {
      this.selectImageAsInput();
    });
    
    // Set up delete button listener
    this.deleteButton.addEventListener('click', () => {
      this.deleteCurrentImage();
    });
    
    // Set up inpaint button listener
    this.inpaintButton.addEventListener('click', () => {
      this.openInpaintPage();
    });
  }
  
  /**
   * Copy field content to clipboard
   * @param {string} fieldName - The name of the field to copy
   */
  async copyFieldToClipboard(fieldName) {
    let value = '';
    
    switch(fieldName) {
      case 'workflow':
        value = this.workflowInput.value;
        break;
      case 'name':
        value = this.nameInput.value;
        break;
      case 'tags':
        value = this.tagsField.value;
        break;
      case 'prompt':
        value = this.promptTextarea.value;
        break;
      case 'description':
        value = this.descriptionTextarea.value;
        break;
      case 'seed':
        value = this.seedInput.value;
        break;
      default:
        console.error('Unknown field for copy:', fieldName);
        return;
    }
    
    if (!value) {
      console.warn(`No content to copy for field: ${fieldName}`);
      return;
    }
    
    const successMessage = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} copied to clipboard`;
    await sendToClipboard(value, successMessage);
  }
  
  /**
   * Use field content in the form
   * @param {string} fieldName - The name of the field to use
   */
  useFieldInForm(fieldName) {
    let value = '';
    
    switch(fieldName) {
      case 'workflow':
        value = this.workflowInput.value;
        break;
      case 'name':
        value = this.nameInput.value;
        break;
      case 'tags':
        // Tags use button is disabled, but handle it anyway
        value = this.tagsField.value;
        break;
      case 'prompt':
        value = this.promptTextarea.value;
        break;
      case 'description':
        value = this.descriptionTextarea.value;
        break;
      case 'seed':
        value = this.seedInput.value;
        break;
      default:
        console.error('Unknown field for use:', fieldName);
        return;
    }
    
    if (!value) {
      console.warn(`No content to use for field: ${fieldName}`);
      return;
    }
    
    // Call the callback function if provided
    if (this.onUseField) {
      this.onUseField(fieldName, value);
    } else {
      console.warn('No onUseField callback provided');
    }
  }
  
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
  
  /**
   * Update the select button's disabled state based on current workflow
   * Should be called whenever workflow changes or data changes
   */
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
  
  /**
   * Open the inpaint page with the current image's UID
   */
  openInpaintPage() {
    if (!this.currentImageData || !this.currentImageData.uid) {
      showErrorToast('No image selected for inpainting');
      return;
    }
    
    const uid = this.currentImageData.uid;
    const inpaintUrl = `inpaint.html?uid=${uid}`;
    
    console.log('Opening inpaint page for UID:', uid);
    
    // Navigate to the inpaint page
    window.location.href = inpaintUrl;
  }
  
  /**
   * Delete the currently displayed image
   */
  async deleteCurrentImage() {
    if (!this.currentImageData || !this.currentImageData.uid) {
      showErrorToast('No image selected for deletion');
      return;
    }
    
    const uid = this.currentImageData.uid;
    const imageName = this.currentImageData.name || 'Unnamed image';
    
    // Show confirmation
    const result = await showDialog(
      `Are you sure you want to delete "${imageName}"? This action cannot be undone.`,
      'Confirm Deletion',
      ['Delete', 'Cancel']
    );
    
    if (result !== 'Delete') {
      return;
    }
    
    // Disable delete button during request
    this.deleteButton.disabled = true;
    
    try {
      showToast('Deleting image...');
      
      const response = await fetchWithRetry('/image-data/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uids: [uid] })
      }, {
        maxRetries: 2,
        retryDelay: 1000,
        showUserFeedback: false // We handle feedback manually
      });
      
      const result = await response.json();
      
      if (result.success && result.deletedCount > 0) {
        showSuccessToast(`Image "${imageName}" deleted successfully`);
        
        // Clear the current display
        this.blankDisplay();
        this.currentImageData = null;
        
        // Notify the carousel component to refresh its data
        if (this.onImageDeleted) {
          this.onImageDeleted(uid);
        }
      } else {
        throw new Error('Image deletion failed - no entries were removed');
      }
      
    } catch (error) {
      console.error('Error deleting image:', error);
      
      let errorMessage = 'Failed to delete image';
      if (error instanceof FetchError) {
        switch (error.status) {
          case 400:
            errorMessage = 'Invalid deletion request';
            break;
          case 404:
            errorMessage = 'Image not found';
            break;
          case 500:
            errorMessage = 'Server error during deletion';
            break;
          default:
            errorMessage = error.message || 'Failed to delete image';
        }
      } else {
        errorMessage = error.message || 'An unexpected error occurred during deletion';
      }
      
      showErrorToast(errorMessage);
    } finally {
      // Re-enable delete button
      this.deleteButton.disabled = false;
    }
  }
  
  /**
   * Update the display with new image data
   * @param {Object|null} data - Image data object with properties: imageUrl, workflow, name, tags, description, seed, uid
   */
  setData(data) {
    // Store the current image data including uid
    this.currentImageData = data;
    
    if (!data) {
      // Gracefully blank out the display
      this.blankDisplay();
      return;
    }
    
    // Set image
    if (data.imageUrl) {
      this.imageElement.src = data.imageUrl;
      this.imageElement.alt = data.name || 'Generated image';
      
      // Handle image load/error
      this.imageElement.onload = () => {
        console.log('Image loaded successfully:', data.imageUrl);
        
        // Add click event to open image in modal with original size
        this.imageElement.style.cursor = 'pointer';
        this.imageElement.onclick = () => {
          createImageModal(data.imageUrl, false); // autoScale=false for original size
        };
      };
      
      this.imageElement.onerror = () => {
        console.error('Failed to load image:', data.imageUrl);
        this.imageElement.alt = 'Failed to load image';
        this.imageElement.style.backgroundColor = '#333333';
        this.imageElement.style.color = '#ff6b6b';
        this.imageElement.style.textAlign = 'center';
        this.imageElement.style.padding = '20px';
      };
    }
    
    // Set text fields
    this.workflowInput.value = data.workflow || '';
    this.nameInput.value = data.name || '';
    // Convert tags array to comma-separated string, default to empty array
    const tags = data.tags || [];
    this.tagsField.value = tags.join(', ');
    this.promptTextarea.value = data.prompt || '';
    this.descriptionTextarea.value = data.description || 'No description available';
    this.seedInput.value = data.seed;
    
    // Show the display
    this.baseElement.style.display = 'block';
    
    // Enable action buttons when valid image data is present
    // Disable inpaint for video files (webp, webm, mp4, gif)
    this.inpaintButton.disabled = !data.uid || isVideoUrl(data.imageUrl);
    this.deleteButton.disabled = !data.uid;
    
    // Update select button state
    this.updateSelectButtonState();
    
    console.log('GeneratedImageDisplay data updated:', data);
  }
  
  /**
   * Blank out the display and hide it
   */
  blankDisplay() {
    // Clear current image data
    this.currentImageData = null;
    
    // Clear image
    this.imageElement.src = '';
    this.imageElement.alt = '';
    this.imageElement.style.backgroundColor = '';
    this.imageElement.style.color = '';
    this.imageElement.style.textAlign = '';
    this.imageElement.style.padding = '';
    this.imageElement.style.cursor = '';
    this.imageElement.onclick = null;
    
    // Clear text fields
    this.workflowInput.value = '';
    this.nameInput.value = '';
    this.tagsField.value = '';
    this.promptTextarea.value = '';
    this.descriptionTextarea.value = '';
    this.seedInput.value = '';
    
    // Disable action buttons
    this.selectButton.disabled = true;
    this.inpaintButton.disabled = true;
    this.deleteButton.disabled = true;
    
    // Hide the display
    this.baseElement.style.display = 'none';
    
    console.log('GeneratedImageDisplay blanked');
  }

  /**
   * Enter edit mode for a specific field
   * @param {string} fieldName - The name of the field to edit
   * @private
   */
  _enterEditMode(fieldName) {
    // Don't allow editing if already in edit mode
    if (this.editState.isEditing) {
      showErrorToast('Please finish editing the current field first');
      return;
    }

    // Don't allow editing if no image data is loaded
    if (!this.currentImageData) {
      showErrorToast('No image data loaded');
      return;
    }

    // Get the field element and its parent section
    let fieldElement;
    let fieldSection;
    
    switch(fieldName) {
      case 'workflow':
        fieldElement = this.workflowInput;
        break;
      case 'name':
        fieldElement = this.nameInput;
        break;
      case 'tags':
        fieldElement = this.tagsField;
        break;
      case 'prompt':
        fieldElement = this.promptTextarea;
        break;
      case 'description':
        fieldElement = this.descriptionTextarea;
        break;
      case 'seed':
        fieldElement = this.seedInput;
        break;
      default:
        console.error('Unknown field for edit:', fieldName);
        return;
    }

    fieldSection = fieldElement.closest('.info-section');
    if (!fieldSection) {
      console.error('Could not find info-section for field:', fieldName);
      return;
    }

    // Store original state
    this.editState.isEditing = true;
    this.editState.fieldBeingEdited = fieldName;
    this.editState.originalValue = fieldElement.value;
    this.editState.fieldElement = fieldElement;
    this.editState.originalHTML = fieldSection.querySelector('.info-buttons').innerHTML;

    // Make field editable
    this._makeFieldEditable(fieldElement, fieldName);

    // Replace action buttons with confirm/cancel buttons
    const buttonsContainer = fieldSection.querySelector('.info-buttons');
    buttonsContainer.innerHTML = `
      <button class="info-btn confirm-edit-btn" title="Confirm edit" style="background-color: #28a745;">
        <box-icon name='check' color='#ffffff' size='16px'></box-icon>
      </button>
      <button class="info-btn cancel-edit-btn" title="Cancel edit" style="background-color: #dc3545;">
        <box-icon name='x' color='#ffffff' size='16px'></box-icon>
      </button>
    `;

    // Add event listeners to confirm/cancel buttons
    buttonsContainer.querySelector('.confirm-edit-btn').addEventListener('click', () => {
      this._confirmEdit();
    });
    
    buttonsContainer.querySelector('.cancel-edit-btn').addEventListener('click', () => {
      this._cancelEdit();
    });

    console.log('Entered edit mode for field:', fieldName);
  }

  /**
   * Exit edit mode and restore original view
   * @private
   */
  _exitEditMode() {
    if (!this.editState.isEditing) {
      return;
    }

    const { fieldBeingEdited, fieldElement, originalHTML } = this.editState;
    
    // Restore field to non-editable state
    this._restoreFieldDisplay(fieldElement, fieldElement.value);

    // Restore action buttons
    const fieldSection = fieldElement.closest('.info-section');
    if (fieldSection) {
      const buttonsContainer = fieldSection.querySelector('.info-buttons');
      buttonsContainer.innerHTML = originalHTML;
      
      // Re-attach event listeners (they were removed when innerHTML was replaced)
      this.setupButtonListeners();
    }

    // Clear edit state
    this.editState.isEditing = false;
    this.editState.fieldBeingEdited = null;
    this.editState.originalValue = null;
    this.editState.fieldElement = null;
    this.editState.originalHTML = null;

    console.log('Exited edit mode for field:', fieldBeingEdited);
  }

  /**
   * Confirm the edit and save to server
   * @private
   */
  async _confirmEdit() {
    if (!this.editState.isEditing || !this.currentImageData) {
      return;
    }

    const { fieldBeingEdited, fieldElement } = this.editState;
    const newValue = fieldElement.value;

    // Disable buttons during save
    const buttonsContainer = fieldElement.closest('.info-section').querySelector('.info-buttons');
    const confirmBtn = buttonsContainer.querySelector('.confirm-edit-btn');
    const cancelBtn = buttonsContainer.querySelector('.cancel-edit-btn');
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      // Update the current image data with the new value
      const updatedData = { ...this.currentImageData };
      
      // Special handling for tags field - convert comma-separated string to array
      if (fieldBeingEdited === 'tags') {
        const tagsArray = newValue
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
        updatedData[fieldBeingEdited] = tagsArray;
      } else {
        updatedData[fieldBeingEdited] = newValue;
      }

      // Send update to server
      showToast('Saving changes...');
      
      const response = await fetchWithRetry('/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData)
      }, {
        maxRetries: 2,
        retryDelay: 1000,
        showUserFeedback: false
      });

      const result = await response.json();

      if (result.success) {
        showSuccessToast('Changes saved successfully');
        
        // Update local data
        this.currentImageData = result.data;
        
        // Exit edit mode
        this._exitEditMode();
      } else {
        throw new Error('Failed to save changes');
      }

    } catch (error) {
      console.error('Error saving edit:', error);
      
      let errorMessage = 'Failed to save changes';
      if (error instanceof FetchError) {
        switch (error.status) {
          case 400:
            errorMessage = 'Invalid data format';
            break;
          case 404:
            errorMessage = 'Image not found';
            break;
          case 500:
            errorMessage = 'Server error';
            break;
          default:
            errorMessage = error.message || 'Failed to save changes';
        }
      } else {
        errorMessage = error.message || 'An unexpected error occurred';
      }
      
      showErrorToast(errorMessage);
      
      // Re-enable buttons
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  /**
   * Cancel the edit and restore original value
   * @private
   */
  _cancelEdit() {
    if (!this.editState.isEditing) {
      return;
    }

    const { fieldElement, originalValue } = this.editState;
    
    // Restore original value
    fieldElement.value = originalValue;
    
    // Exit edit mode
    this._exitEditMode();
    
    showToast('Edit cancelled');
  }

  /**
   * Replace text display with editable textarea
   * @param {HTMLElement} element - The element to make editable
   * @param {string} fieldName - The field name
   * @private
   */
  _makeFieldEditable(element, fieldName) {
    // Remove readonly attribute
    element.removeAttribute('readonly');
    
    // Add CSS class to indicate edit mode
    element.classList.add('editing');
    
    // Focus on the field
    element.focus();
    
    // For textareas, select all text
    if (element.tagName === 'TEXTAREA') {
      element.select();
    } else {
      // For input fields, move cursor to end
      element.setSelectionRange(element.value.length, element.value.length);
    }
  }

  /**
   * Restore textarea to static text display
   * @param {HTMLElement} element - The element to restore
   * @param {string} value - The value to display
   * @private
   */
  _restoreFieldDisplay(element, value) {
    // Set the value
    element.value = value;
    
    // Add readonly attribute back
    element.setAttribute('readonly', '');
    
    // Remove edit mode CSS class
    element.classList.remove('editing');
  }
}
