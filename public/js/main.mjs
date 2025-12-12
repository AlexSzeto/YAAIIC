// Main application entry point
import { render } from 'preact';
import { html } from 'htm/preact';
import { loadTags } from './tags.mjs';
import { getCurrentDescription } from './autocomplete-setup.mjs';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.mjs';
import { GeneratedImageDisplay } from './generated-image-display.mjs';
import { CarouselDisplay } from './carousel-setup.mjs';
import { createGallery } from './custom-ui/gallery.mjs';
import { createImageModal } from './custom-ui/modal.mjs';
import { createGalleryPreview } from './gallery-preview.mjs';
import { fetchJson, fetchWithRetry, FetchError, getQueryParam } from './util.mjs';
import { sseManager } from './sse-manager.mjs';
import { createProgressBanner } from './custom-ui/progress-banner.mjs';
import { ImageUpload } from './custom-ui/image-upload.mjs';

let workflows = [];
let autoCompleteInstance = null;
let generatedImageDisplay = null;
let carouselDisplay = null;
let galleryDisplay = null;
let currentProgressBanner = null;
let uploadComponentRefs = []; // Store references to ImageUpload component instances

// Helper function to generate random seed
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295); // Max 32-bit unsigned integer
}

// Function to set seed unless locked
function updateSeedIfNotLocked() {
  const lockSeedCheckbox = document.getElementById('lock-seed');
  const seedInput = document.getElementById('seed');
  
  if (!lockSeedCheckbox.checked) {
    seedInput.value = generateRandomSeed();
  }
}

// Function to render image upload components based on workflow
function renderImageUploadComponents(count) {
  const container = document.getElementById('image-upload-slots');
  if (!container) return;
  
  // Clear component refs
  uploadComponentRefs = [];
  
  // First, unmount any existing Preact components by rendering null
  render(null, container);
  
  if (count <= 0) {
    return;
  }
  
  // Create handler for gallery requests
  const handleGalleryRequest = (componentIndex) => {
    if (!galleryDisplay) {
      console.error('GalleryDisplay is not initialized');
      return;
    }

    // Enable selection mode with image filter; when an item is selected, fetch the image and set it on the upload component
    galleryDisplay.showModal(true, async (selectedItem) => {
      try {
        const response = await fetch(selectedItem.imageUrl);
        const blob = await response.blob();
        const componentRef = uploadComponentRefs[componentIndex];
        if (componentRef && typeof componentRef.setImage === 'function') {
          componentRef.setImage(blob, selectedItem.imageUrl);
          
          // Update select button state after setting image
          if (generatedImageDisplay && typeof generatedImageDisplay.updateSelectButtonState === 'function') {
            generatedImageDisplay.updateSelectButtonState();
          }
        }
      } catch (err) {
        console.error('Failed to load selected image from gallery:', err);
        showErrorToast('Failed to load selected image');
      }
    }, 'image');
  };
  
  // Create components
  const components = [];
  for (let i = 0; i < count; i++) {
    components.push(html`
      <${ImageUpload}
        id=${i}
        ref=${(ref) => {
          if (ref) {
            uploadComponentRefs[i] = ref;
          }
        }}
        onImageChange=${(file) => {
          console.log(`Image ${i} changed:`, file);
        }}
        onGalleryRequest=${() => handleGalleryRequest(i)}
      />
    `);
  }
  
  // Render all components
  render(html`${components}`, container);
  
  console.log(`Rendered ${count} image upload components`);
}

/**
 * Get the currently selected workflow object
 * @returns {Object|null} The selected workflow or null
 */
function getCurrentWorkflow() {
  const workflowSelect = document.getElementById('workflow');
  if (!workflowSelect || !workflowSelect.value) return null;
  return workflows.find(w => w.name === workflowSelect.value);
}

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

/**
 * Get the current workflow state for updating UI elements
 * @returns {Object} Object containing workflow and unfilled slot information
 */
function getWorkflowState() {
  const workflow = getCurrentWorkflow();
  const hasUnfilledSlot = getFirstUnfilledUploadIndex() !== -1;
  return { workflow, hasUnfilledSlot };
}

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
      
      // Update select button state after setting image
      if (generatedImageDisplay && typeof generatedImageDisplay.updateSelectButtonState === 'function') {
        generatedImageDisplay.updateSelectButtonState();
      }
    } else {
      throw new Error('Upload component not available');
    }
  } catch (err) {
    console.error('Failed to select image as input:', err);
    showErrorToast('Failed to select image as input');
  }
}

// Function to handle workflow selection change
function handleWorkflowChange() {
  const workflowSelect = document.getElementById('workflow');
  const selectedWorkflowName = workflowSelect.value;
  
  if (!selectedWorkflowName) {
    // No workflow selected - hide and clear upload components
    const imageUploadContainer = document.getElementById('image-upload-container');
    if (imageUploadContainer) {
      imageUploadContainer.style.display = 'none';
    }
    renderImageUploadComponents(0);
    return;
  }
  
  const selectedWorkflow = workflows.find(w => w.name === selectedWorkflowName);
  if (!selectedWorkflow) return;
  
  // Enable or disable autocomplete based on workflow setting
  const descriptionTextarea = document.getElementById('description');
  
  if (selectedWorkflow.autocomplete) {
    // Enable autocomplete by removing the autocomplete="off" attribute
    descriptionTextarea.removeAttribute('autocomplete');
    console.log('Autocomplete enabled for workflow:', selectedWorkflowName);
  } else {
    // Disable autocomplete using the official autocomplete="off" attribute
    descriptionTextarea.setAttribute('autocomplete', 'off');
    console.log('Autocomplete disabled for workflow:', selectedWorkflowName);
  }
  
  // Show/hide image upload container and render components based on inputImages
  const imageUploadContainer = document.getElementById('image-upload-container');
  if (imageUploadContainer) {
    if (selectedWorkflow.inputImages && selectedWorkflow.inputImages > 0) {
      imageUploadContainer.style.display = '';
      renderImageUploadComponents(selectedWorkflow.inputImages);
      console.log('Image upload enabled for workflow:', selectedWorkflowName, 'with', selectedWorkflow.inputImages, 'images');
    } else {
      imageUploadContainer.style.display = 'none';
      renderImageUploadComponents(0);
      console.log('Image upload disabled for workflow:', selectedWorkflowName);
    }
  }
  
  // Show/hide video-specific fields based on workflow type
  const lengthGroup = document.getElementById('length-group');
  const framerateGroup = document.getElementById('framerate-group');
  if (selectedWorkflow.type === 'video') {
    if (lengthGroup) lengthGroup.style.display = '';
    if (framerateGroup) framerateGroup.style.display = '';
    console.log('Video fields enabled for workflow:', selectedWorkflowName);
  } else {
    if (lengthGroup) lengthGroup.style.display = 'none';
    if (framerateGroup) framerateGroup.style.display = 'none';
    console.log('Video fields disabled for workflow:', selectedWorkflowName);
  }
  
  // Update select button state when workflow changes
  if (generatedImageDisplay && typeof generatedImageDisplay.updateSelectButtonState === 'function') {
    generatedImageDisplay.updateSelectButtonState();
  }
}

// Function to populate workflow dropdown
async function loadWorkflows() {
  try {
    console.log('Loading workflows...');
    
    // Use enhanced fetch with retry mechanism
    workflows = await fetchJson('/generate/workflows', {}, {
      maxRetries: 3,
      retryDelay: 1000,
      showUserFeedback: true,
      showSuccessFeedback: false, // Don't show success toast for workflow loading
      successMessage: 'Workflows loaded successfully'
    });
    
    // Filter workflows to only include image and video types for index page
    const imageWorkflows = workflows.filter(workflow => workflow.type === 'image' || workflow.type === 'video');
    
    const workflowSelect = document.getElementById('workflow');
    
    // Clear loading option
    workflowSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a workflow...';
    workflowSelect.appendChild(defaultOption);
    
    // Add workflow options (only image workflows)
    imageWorkflows.forEach(workflow => {
      const option = document.createElement('option');
      option.value = workflow.name;
      option.textContent = workflow.name;
      workflowSelect.appendChild(option);
    });
    
    // Add change event listener
    workflowSelect.addEventListener('change', handleWorkflowChange);
    
    console.log('Workflows loaded:', workflows);
    console.log('Filtered image and video workflows:', imageWorkflows);
  } catch (error) {
    console.error('Error loading workflows:', error);
    // Error feedback is already handled by fetchJson utility
    
    // Set fallback state for workflow dropdown
    const workflowSelect = document.getElementById('workflow');
    workflowSelect.innerHTML = '<option value="">Failed to load workflows - please refresh</option>';
  }
}

// Function to handle field use from GeneratedImageDisplay
function handleUseField(fieldName, value) {
  switch(fieldName) {
    case 'workflow':
      const workflowSelect = document.getElementById('workflow');
      if (workflowSelect && value) {
        // Find and select the workflow option
        const option = Array.from(workflowSelect.options).find(opt => opt.value === value);
        if (option) {
          workflowSelect.value = value;
          console.log(`Set workflow to: ${value}`);
          if (window.showToast) {
            showToast(`Workflow set to: ${value}`);
          }
          // Trigger workflow change handler to update autocomplete settings
          handleWorkflowChange();
        } else {
          console.warn(`Workflow option not found: ${value}`);
          if (window.showToast) {
            showErrorToast(`Workflow "${value}" not found`);
          }
        }
      }
      break;
      
    case 'name':
      const nameInput = document.getElementById('name');
      if (nameInput && value) {
        nameInput.value = value;
        console.log(`Set name to: ${value}`);
        if (window.showToast) {
          showToast(`Name set to: ${value}`);
        }
      }
      break;
      
    case 'tags':
      const descriptionTextarea = document.getElementById('description');
      if (descriptionTextarea && value) {
        descriptionTextarea.value = value;
        console.log(`Set description to: ${value}`);
        if (window.showToast) {
          showToast(`Description set from tags`);
        }
      }
      break;
      
    case 'description':
      const descTextarea = document.getElementById('description');
      if (descTextarea && value) {
        descTextarea.value = value;
        console.log(`Set description to: ${value}`);
        if (window.showToast) {
          showToast(`Description set`);
        }
      }
      break;
      
    case 'seed':
      const seedInput = document.getElementById('seed');
      const lockSeedCheckbox = document.getElementById('lock-seed');
      if (seedInput && value && !isNaN(value)) {
        seedInput.value = parseInt(value);
        // Always enable lock seed when using seed value
        if (lockSeedCheckbox) {
          lockSeedCheckbox.checked = true;
        }
        console.log(`Set seed to: ${value} and enabled lock`);
        if (window.showToast) {
          showToast(`Seed set to: ${value} (locked)`);
        }
      } else {
        console.warn(`Invalid seed value: ${value}`);
        if (window.showToast) {
          showErrorToast(`Invalid seed value: ${value}`);
        }
      }
      break;
      
    default:
      console.error('Unknown field for use:', fieldName);
      if (window.showToast) {
        showErrorToast(`Unknown field: ${fieldName}`);
      }
      return;
  }
}

// Function to load image data by UID from server
async function loadImageDataByUID(uid) {
  try {
    console.log('Loading image data for UID:', uid);
    
    const imageData = await fetchJson(`/image-data/${uid}`, {}, {
      maxRetries: 2,
      retryDelay: 1000,
      showUserFeedback: true,
      showSuccessFeedback: false
    });
    
    console.log('Image data loaded:', imageData);
    return imageData;
    
  } catch (error) {
    console.error('Error loading image data for UID:', uid, error);
    
    let errorMessage = 'Failed to load image data';
    if (error.status === 404) {
      errorMessage = `Image with UID ${uid} not found`;
    } else if (error.status === 400) {
      errorMessage = 'Invalid UID provided';
    }
    
    showErrorToast(errorMessage);
    throw new Error(errorMessage);
  }
}

// Function to set disabled state for all image upload components
function setImageUploadsDisabled(disabled) {
  uploadComponentRefs.forEach((component) => {
    if (component && typeof component.setDisabled === 'function') {
      component.setDisabled(disabled);
    }
  });
}

// Function to handle image generation
async function handleGenerate() {
  const descriptionText = getCurrentDescription();
  const workflowSelect = document.getElementById('workflow');
  const nameInput = document.getElementById('name');
  const seedInput = document.getElementById('seed');
  
  if (!descriptionText.trim()) {
    showErrorToast('Please enter a description before generating an image.');
    return;
  }
  
  if (!workflowSelect.value) {
    showErrorToast('Please select a workflow before generating an image.');
    return;
  }
  
  if (!seedInput.value) {
    showErrorToast('Please enter a seed value.');
    return;
  }

  // Get UI elements for disabling
  const generateButton = document.getElementById('generate-btn');
  const descriptionTextarea = document.getElementById('description');
  
  // Disable UI during request
  generateButton.disabled = true;
  generateButton.textContent = 'Generating...';
  descriptionTextarea.disabled = true;
  setImageUploadsDisabled(true);
  
  try {
    // Update seed for next generation unless locked
    updateSeedIfNotLocked();

    // Calculate video-specific parameters if this is a video workflow
    const selectedWorkflow = workflows.find(w => w.name === workflowSelect.value);
    let videoParams = null;
    if (selectedWorkflow && selectedWorkflow.type === 'video') {
      const lengthInput = document.getElementById('length');
      const framerateInput = document.getElementById('framerate');
      const length = parseFloat(lengthInput.value);
      const framerate = parseInt(framerateInput.value);
      const frames = Math.floor(length * framerate) % 2 === 0 ? Math.floor(length * framerate) + 1 : Math.floor(length * framerate); // Ensure odd number of frames
      videoParams = { frames, framerate };
    }

    // Determine if we need to send images (img2img workflows)
    const hasUploads = uploadComponentRefs.some((component) => component && typeof component.hasImage === 'function' && component.hasImage());

    let response;
    if (hasUploads) {
      // Build multipart form data with uploaded images
      const formData = new FormData();
      formData.append('prompt', descriptionText);
      formData.append('workflow', workflowSelect.value);
      formData.append('seed', seedInput.value);
      if (nameInput.value.trim()) {
        formData.append('name', nameInput.value.trim());
      }
      if (videoParams) {
        formData.append('frames', videoParams.frames);
        formData.append('framerate', videoParams.framerate);
      }
      uploadComponentRefs.forEach((component, index) => {
        if (component && typeof component.hasImage === 'function' && component.hasImage()) {
          const blob = component.getImageBlob();
          if (blob) {
            formData.append(`image_${index}`, blob, `image_${index}.png`);
          }
        }
      });
      response = await fetchWithRetry('/generate/image', {
        method: 'POST',
        body: formData
      }, {
        maxRetries: 1,
        retryDelay: 2000,
        timeout: 10000, // 10 seconds for initial request (just gets taskId)
        showUserFeedback: false
      });
    } else {
      const requestBody = {
        prompt: descriptionText,
        workflow: workflowSelect.value,
        seed: parseInt(seedInput.value)
      };
      if (nameInput.value.trim()) {
        requestBody.name = nameInput.value.trim();
      }
      if (videoParams) {
        requestBody.frames = videoParams.frames;
        requestBody.framerate = videoParams.framerate;
      }
      // Send generation request and get immediate taskId response
      response = await fetchWithRetry('/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }, {
        maxRetries: 1,
        retryDelay: 2000,
        timeout: 10000, // 10 seconds for initial request (just gets taskId)
        showUserFeedback: false
      });
    }

    const result = await response.json();
    
    if (!result.taskId) {
      throw new Error('Server did not return a taskId');
    }
    
    console.log('Generation started with taskId:', result.taskId);
    
    // Unmount previous progress banner if it exists
    if (currentProgressBanner) {
      currentProgressBanner.unmount();
      currentProgressBanner = null;
    }
    
    // Create progress banner with completion callback
    currentProgressBanner = createProgressBanner(
      result.taskId,
      sseManager,
      (completionData) => {
        // Handle completion - add image to carousel
        if (completionData.result && completionData.result.imageUrl) {
          carouselDisplay.addData(completionData.result);
          
          // Show success toast with time taken if available
          const timeTaken = completionData.result.timeTaken;
          const message = timeTaken 
            ? `Workflow completed in ${timeTaken}s` 
            : 'Image generated successfully!';
          showSuccessToast(message);
        }
        
        // Unmount the progress banner
        if (currentProgressBanner) {
          currentProgressBanner.unmount();
          currentProgressBanner = null;
        }
        
        // Re-enable UI
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        descriptionTextarea.disabled = false;
        setImageUploadsDisabled(false);
      },
      (errorData) => {
        // Handle error - re-enable UI
        console.error('Image generation failed:', errorData);
        showErrorToast(errorData.error?.message || 'Image generation failed');
        
        // Unmount the progress banner
        if (currentProgressBanner) {
          currentProgressBanner.unmount();
          currentProgressBanner = null;
        }
        
        // Re-enable UI
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        descriptionTextarea.disabled = false;
        setImageUploadsDisabled(false);
      }
    );
    
    // Update button text to show progress is being tracked
    generateButton.textContent = 'Generating...';

  } catch (error) {
    console.error('Error generating image:', error);
    
    // Provide specific error messages for generation failures
    let errorMessage = 'Generation failed';
    
    if (error instanceof FetchError) {
      switch (error.status) {
        case 400:
          errorMessage = 'Invalid generation parameters. Please check your inputs.';
          break;
        case 408:
        case 504:
          errorMessage = 'Generation timed out. The request may be too complex - try simplifying or try again later.';
          break;
        case 429:
          errorMessage = 'Server is busy. Please wait a moment and try again.';
          break;
        case 500:
          errorMessage = 'Server error during generation. Please try again later.';
          break;
        default:
          errorMessage = error.message || 'Generation failed unexpectedly.';
      }
    } else {
      errorMessage = error.message || 'An unexpected error occurred during generation.';
    }
    
    showErrorToast(errorMessage);
    
    // Re-enable UI on error (success case handled in completion callback)
    generateButton.disabled = false;
    generateButton.textContent = 'Generate';
    descriptionTextarea.disabled = false;
    setImageUploadsDisabled(false);
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  // Initialize the application by ensuring tags are loaded
  try {
    console.log('Main: Initializing application...');
    await loadTags();
    
    // Load workflows on page load
    await loadWorkflows();
    
    // Set initial random seed
    updateSeedIfNotLocked();
    
    // Handler for when an image is deleted from GeneratedImageDisplay
    const handleImageDeleted = (deletedUid) => {
      console.log('Image deleted, refreshing carousel data:', deletedUid);
      // Refresh carousel data to reflect deletion
      if (carouselDisplay) {
        carouselDisplay.removeItemByUid(deletedUid);
      }
      // Also refresh gallery data if it's open
      if (galleryDisplay && galleryDisplay.isVisible && galleryDisplay.isVisible()) {
        galleryDisplay.refreshData();
      }
    };
    
    // Initialize GeneratedImageDisplay
    const generatedImageDisplayElement = document.getElementById('generatedImageDisplay');
    if (generatedImageDisplayElement) {
      generatedImageDisplay = new GeneratedImageDisplay(
        generatedImageDisplayElement,
        handleUseField,
        handleImageDeleted,
        handleSelectAsInput,
        getWorkflowState
      );
    } else {
      console.error('Generated image display element not found');
    }
    
    // Initialize CarouselDisplay
    const carouselDisplayElement = document.getElementById('carouselDisplay');
    if (carouselDisplayElement && generatedImageDisplay) {
      carouselDisplay = new CarouselDisplay(carouselDisplayElement, generatedImageDisplay);
    } else {
      console.error('Carousel display element not found or GeneratedImageDisplay not initialized');
    }
    
    // Initialize GalleryDisplay with onLoad callback
    galleryDisplay = createGallery('/image-data', createGalleryPreview, (dataList) => {
      if (carouselDisplay) {
        carouselDisplay.setData(dataList);
      }
    });
    
    // Set up gallery button
    const galleryButton = document.getElementById('gallery-btn');
    if (galleryButton && galleryDisplay) {
      galleryButton.addEventListener('click', () => {
        galleryDisplay.showModal();
      });
    } else {
      console.error('Gallery button not found or GalleryDisplay not initialized');
    }
    
    // Set up upload button
    const uploadButton = document.getElementById('upload-btn');
    const uploadFileInput = document.getElementById('upload-file-input');
    if (uploadButton && uploadFileInput) {
      uploadButton.addEventListener('click', () => {
        uploadFileInput.click();
      });
      
      uploadFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          showErrorToast('Please select an image file');
          return;
        }
        
        try {
          showToast('Uploading and analyzing image...');
          
          // Create form data
          const formData = new FormData();
          formData.append('image', file);
          
          // Upload image
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
          
          const result = await response.json();
          
          // Show success message
          showSuccessToast(`Image uploaded: ${result.name || 'Unnamed'}`);
          
          // Refresh gallery if it's open
          if (galleryDisplay && galleryDisplay.state && galleryDisplay.state.isVisible) {
            try {
              await galleryDisplay.fetchGalleryData();
            } catch (galleryError) {
              console.warn('Failed to refresh gallery:', galleryError);
            }
          }
          
          // Clear the file input
          uploadFileInput.value = '';
          
        } catch (error) {
          console.error('Upload error:', error);
          showErrorToast('Failed to upload image');
          uploadFileInput.value = '';
        }
      });
    } else {
      console.error('Upload button or file input not found');
    }
    
    // Set up generate button
    const generateButton = document.getElementById('generate-btn');
    if (generateButton) {
      generateButton.addEventListener('click', handleGenerate);
    }
    
    // Check for UID query parameter and load specific image
    const uid = getQueryParam('uid');
    if (uid) {
      console.log('UID found in query parameters:', uid);
      
      // Validate UID is a number
      const numericUID = parseInt(uid);
      if (isNaN(numericUID)) {
        console.error('Invalid UID format:', uid);
        showErrorToast('Invalid image UID format');
      } else {
        try {
          // Load the specific image data
          const imageData = await loadImageDataByUID(numericUID);
          
          // Populate carousel with single item
          if (carouselDisplay) {
            carouselDisplay.setData([imageData]);
          }
          
          // Display the image in the generated image display
          if (generatedImageDisplay) {
            generatedImageDisplay.setData(imageData);
          }
          
          console.log('Successfully loaded image for UID:', uid);
          showSuccessToast(`Loaded image: ${imageData.name || 'Unnamed'}`);
          
        } catch (error) {
          console.error('Failed to load image for UID:', uid, error);
          // Error message already shown by loadImageDataByUID
        }
      }
    }
    
    console.log('Main: Application initialized successfully');
  } catch (error) {
    console.error('Main: Failed to initialize application:', error);
  }
});
