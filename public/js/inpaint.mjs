// Inpaint page script module
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { signal } from '@preact/signals';
import { InpaintComponent } from './inpaint-canvas.mjs';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.mjs';
import { PaginationComponent, createPagination } from './custom-ui/pagination.mjs';
import { fetchJson, fetchWithRetry, getQueryParam } from './util.mjs';

let workflows = [];
let currentImageData = null;
let paginationInstance = null;
let inpaintHistory = []; // Global array to store image data objects for all inpaint generations in the current session

// Initialize inpaintArea as a preact signal
const inpaintArea = signal(null);

// Export inpaintArea for use in other modules
export { inpaintArea };

// Utility function to generate mask canvas from inpaintArea signal
function generateMaskCanvas(imageCanvas, inpaintAreaValue) {
  if (!inpaintAreaValue || !imageCanvas) {
    throw new Error('Invalid inpaint area or image canvas');
  }
  
  // Create a new canvas with the same dimensions as the original image
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = imageCanvas.width;
  maskCanvas.height = imageCanvas.height;
  
  const ctx = maskCanvas.getContext('2d');
  
  // Clear canvas with black (RGB 0, 0, 0)
  ctx.fillStyle = 'rgb(0, 0, 0)';
  ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  
  // Calculate rectangle bounds from inpaint area
  const { x1, y1, x2, y2 } = inpaintAreaValue;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  
  // Draw filled rectangle in white (RGB 255, 255, 255)
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(left, top, width, height);
  
  return maskCanvas;
}

// Utility function to convert canvas to blob
function canvasToBlob(canvas, mimeType = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, mimeType);
  });
}

// Function to create a clean canvas with only the original image (no overlays)
function createOriginalImageCanvas() {
  const displayCanvas = document.getElementById('inpaint');
  if (!displayCanvas) {
    throw new Error('Inpaint canvas not found');
  }
  
  // Create a new canvas for the original image
  const originalCanvas = document.createElement('canvas');
  originalCanvas.width = displayCanvas.width;
  originalCanvas.height = displayCanvas.height;
  
  const ctx = originalCanvas.getContext('2d');
  
  // Create a temporary image from the original imageUrl to ensure we get clean data
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Draw only the original image without any overlays
      ctx.drawImage(img, 0, 0);
      resolve(originalCanvas);
    };
    img.onerror = () => {
      reject(new Error('Failed to load original image'));
    };
    
    // Use the original image URL from currentImageData
    if (currentImageData && currentImageData.imageUrl) {
      img.src = currentImageData.imageUrl;
    } else {
      reject(new Error('No original image URL available'));
    }
  });
}

// Function to validate form data before processing
function validateFormData() {
  const workflowSelect = document.getElementById('workflow');
  const nameInput = document.getElementById('name');
  const seedInput = document.getElementById('seed');
  const descriptionTextarea = document.getElementById('description');
  
  const errors = [];
  
  if (!workflowSelect.value) {
    errors.push('Please select a workflow');
  }
  
  if (!nameInput.value.trim()) {
    errors.push('Please enter a name');
  }
  
  if (!seedInput.value) {
    errors.push('Please enter a seed value');
  }
  
  if (!descriptionTextarea.value.trim()) {
    errors.push('Please enter a description');
  }
  
  if (!inpaintArea.value) {
    errors.push('Please select an inpaint area on the canvas');
  }
  
  return errors;
}

// Function to handle inpaint button click
async function handleInpaint() {
  try {
    // Validate form data
    const validationErrors = validateFormData();
    if (validationErrors.length > 0) {
      showErrorToast(validationErrors.join(', '));
      return;
    }
    
    // Get form data
    const workflowSelect = document.getElementById('workflow');
    const nameInput = document.getElementById('name');
    const seedInput = document.getElementById('seed');
    const descriptionTextarea = document.getElementById('description');
    const generateButton = document.getElementById('generate-btn');
    
    // Disable UI during request
    generateButton.disabled = true;
    generateButton.textContent = 'Processing...';
    
    // Show processing toast
    showToast('Preparing inpaint request...');
    
    // Get the original image canvas (clean, without overlays)
    const imageCanvas = await createOriginalImageCanvas();
    
    // Generate mask canvas
    const maskCanvas = generateMaskCanvas(imageCanvas, inpaintArea.value);
    
    // Convert canvases to blobs
    const imageBlob = await canvasToBlob(imageCanvas, 'image/png');
    const maskBlob = await canvasToBlob(maskCanvas, 'image/png');
    
    // Prepare form data
    const formData = new FormData();
    formData.append('workflow', workflowSelect.value);
    formData.append('name', nameInput.value.trim());
    formData.append('seed', seedInput.value);
    formData.append('prompt', descriptionTextarea.value.trim());
    formData.append('inpaintArea', JSON.stringify(inpaintArea.value));
    formData.append('image', imageBlob, 'image.png');
    formData.append('mask', maskBlob, 'mask.png');
    
    showToast('Sending inpaint request...');
    
    // Send request to server using fetchWithRetry
    const response = await fetchWithRetry('/generate/inpaint', {
      method: 'POST',
      body: formData
    }, {
      maxRetries: 1, // Limited retries for file uploads
      retryDelay: 2000,
      timeout: 300000, // 5 minutes timeout for inpaint processing
      showUserFeedback: false // We handle feedback manually
    });
    
    const result = await response.json();
    
    showSuccessToast('Inpaint request completed successfully!');
    console.log('Inpaint result:', result);
    
    // Check if we have a uid in the response data for refreshing the interface
    if (result.data && result.data.uid) {
      const newUID = result.data.uid;
      console.log('Updating interface with new UID:', newUID);
      
      // Refresh the interface by loading the new image data
      await loadImageDataByUID(newUID);
      
      // The loadImageDataByUID function will automatically add to history and update pagination
      // The updateInpaintHistoryPagination function automatically navigates to the latest item
      
      // Reset the inpaint area since we have a new image, unless we have inpaintArea in response
      if (result.data.inpaintArea) {
        console.log('Preserving inpaintArea from result:', result.data.inpaintArea);
        inpaintArea.value = result.data.inpaintArea;
      } else {
        inpaintArea.value = null;
      }
      
      // Update the seed if not locked for potential future inpaints
      updateSeedIfNotLocked();
      
      showSuccessToast('Interface refreshed with inpaint result - now showing latest generation');
    } else {
      console.warn('No UID found in inpaint response, interface not refreshed');
      // Reset form or redirect as needed
      // For now, just reset the inpaint area unless preserved in response
      if (result.data && result.data.inpaintArea) {
        inpaintArea.value = result.data.inpaintArea;
      } else {
        inpaintArea.value = null;
      }
    }
    
  } catch (error) {
    console.error('Error during inpaint:', error);
    showErrorToast(`Inpaint failed: ${error.message}`);
  } finally {
    // Re-enable UI
    const generateButton = document.getElementById('generate-btn');
    generateButton.disabled = false;
    generateButton.innerHTML = '<box-icon name="play" color="#ffffff"></box-icon> Inpaint';
  }
}

// Create signals for app state
const appState = signal({
  loading: true,
  error: null,
  imageData: null
});

// InpaintApp component to handle the inpaint container rendering
class InpaintApp extends Component {
  render() {
    const state = appState.value;
    
    return html`
      <div class="content-container">
        ${state.loading && html`
          <p>Loading image for inpainting...</p>
        `}
        
        ${state.error && html`
          <p>${state.error}</p>
        `}
        
        ${!state.loading && !state.error && state.imageData?.imageUrl && html`
          <${InpaintComponent} 
            imageUrl=${state.imageData.imageUrl} 
            inpaintArea=${inpaintArea} 
          />
        `}
        
        ${!state.loading && !state.error && !state.imageData?.imageUrl && html`
          <p>No image loaded for inpainting</p>
        `}
      </div>
    `;
  }
}

// Function to render the InpaintApp
function renderInpaintApp() {
  const inpaintContainer = document.getElementById('inpaintContainer');
  if (inpaintContainer) {
    render(html`<${InpaintApp} />`, inpaintContainer);
  }
}

// Function to handle workflow selection change
function handleWorkflowChange() {
  const workflowSelect = document.getElementById('workflow');
  const selectedWorkflowName = workflowSelect.value;
  
  if (!selectedWorkflowName) return;
  
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
}

// Function to load workflows and filter for inpaint type
async function loadInpaintWorkflows() {
  try {
    console.log('Loading workflows for inpaint page...');
    
    // Load all workflows from server
    workflows = await fetchJson('/generate/workflows', {}, {
      maxRetries: 3,
      retryDelay: 1000,
      showUserFeedback: true,
      showSuccessFeedback: false,
      successMessage: 'Workflows loaded successfully'
    });
    
    // Filter workflows to only include inpaint type
    const inpaintWorkflows = workflows.filter(workflow => workflow.type === 'inpaint');
    
    const workflowSelect = document.getElementById('workflow');
    
    // Clear loading option
    workflowSelect.innerHTML = '';
    
    if (inpaintWorkflows.length === 0) {
      // Handle case where no inpaint workflows are available
      const noWorkflowOption = document.createElement('option');
      noWorkflowOption.value = '';
      noWorkflowOption.textContent = 'No inpaint workflows available';
      workflowSelect.appendChild(noWorkflowOption);
      workflowSelect.disabled = true;
      console.warn('No inpaint workflows found');
      showErrorToast('No inpaint workflows are available');
    } else {
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select an inpaint workflow...';
      workflowSelect.appendChild(defaultOption);
      
      // Add inpaint workflow options
      inpaintWorkflows.forEach(workflow => {
        const option = document.createElement('option');
        option.value = workflow.name;
        option.textContent = workflow.name;
        workflowSelect.appendChild(option);
      });
      
      // Set default inpaint workflow if available
      if (inpaintWorkflows.length > 0) {
        workflowSelect.value = inpaintWorkflows[0].name;
        console.log('Default inpaint workflow set to:', inpaintWorkflows[0].name);
        // Trigger workflow change handler to update autocomplete settings
        handleWorkflowChange();
      }
      
      workflowSelect.disabled = false;
    }
    
    // Add change event listener
    workflowSelect.addEventListener('change', handleWorkflowChange);
    
    console.log('All workflows loaded:', workflows);
    console.log('Filtered inpaint workflows:', inpaintWorkflows);
  } catch (error) {
    console.error('Error loading workflows:', error);
    
    // Set fallback state for workflow dropdown
    const workflowSelect = document.getElementById('workflow');
    workflowSelect.innerHTML = '<option value="">Failed to load workflows - please refresh</option>';
    workflowSelect.disabled = true;
  }
}

// Function to load image data by UID
async function loadImageDataByUID(uid) {
  try {
    console.log('Loading image data for UID:', uid);
    
    // Set loading state
    appState.value = { loading: true, error: null, imageData: null };
    renderInpaintApp();
    
    currentImageData = await fetchJson(`/image-data/${uid}`, {}, {
      maxRetries: 2,
      retryDelay: 1000,
      showUserFeedback: true,
      showSuccessFeedback: false
    });
    
    console.log('Image data loaded:', currentImageData);
    
    // Populate form fields with the loaded image data
    populateFormWithImageData(currentImageData);
    
    // Update app state with loaded image data
    appState.value = { loading: false, error: null, imageData: currentImageData };
    renderInpaintApp();
    
    // Add to history array if not already present
    try {
      const existingIndex = inpaintHistory.findIndex(item => item.uid === currentImageData.uid);
      if (existingIndex === -1) {
        inpaintHistory.push(currentImageData);
        console.log('Added image data to history. Total items:', inpaintHistory.length);
        
        // Update pagination with new history
        updateInpaintHistoryPagination();
      } else {
        console.log('Image data already exists in history at index:', existingIndex);
        // Update existing entry with latest data
        inpaintHistory[existingIndex] = currentImageData;
        updateInpaintHistoryPagination();
      }
    } catch (error) {
      console.error('Error managing inpaint history:', error);
      // Don't show error toast here as this is not critical to the user experience
      // The image will still load and work, just without history navigation
    }
    
    // Set inpaintArea from loaded data if available
    if (currentImageData.inpaintArea) {
      console.log('Restoring inpaintArea from loaded data:', currentImageData.inpaintArea);
      inpaintArea.value = currentImageData.inpaintArea;
    }
    
    // Enable Done button since we have valid image data
    const doneButton = document.getElementById('done-btn');
    if (doneButton) {
      doneButton.disabled = false;
    }
    
    showSuccessToast('Image loaded for inpainting');
    
  } catch (error) {
    console.error('Error loading image data:', error);
    
    let errorMessage = 'Failed to load image data';
    if (error.status === 404) {
      errorMessage = `Image with UID ${uid} not found`;
    } else if (error.status === 400) {
      errorMessage = 'Invalid UID provided';
    }
    
    showErrorToast(errorMessage);
    
    // Update app state with error
    appState.value = { loading: false, error: errorMessage, imageData: null };
    renderInpaintApp();
    
    // Clear current data and history reference for this failed load
    currentImageData = null;
    inpaintArea.value = null;
  }
}

// Function to generate random seed
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295); // Max 32-bit unsigned integer
}

// Function to handle pagination data updates and load the selected image data
function updateInpaintDisplay(pageData) {
  console.log('updateInpaintDisplay called with pageData:', pageData);
  
  if (pageData && pageData.length > 0) {
    const selectedImageData = pageData[0]; // Get the first (and only) item for this page
    console.log('Loading image data from history:', selectedImageData);
    
    try {
      // Validate that the selected image data has required properties
      if (!selectedImageData || !selectedImageData.uid) {
        throw new Error('Invalid image data: missing UID');
      }
      
      if (!selectedImageData.imageUrl) {
        throw new Error('Invalid image data: missing image URL');
      }
      
      // Update the current image data and app state
      currentImageData = selectedImageData;
      appState.value = { loading: false, error: null, imageData: selectedImageData };
      renderInpaintApp();
      
      // Populate form fields with the selected image data
      populateFormWithImageData(selectedImageData);
      
      // Set inpaintArea from loaded data if available
      if (selectedImageData.inpaintArea) {
        console.log('Restoring inpaintArea from history:', selectedImageData.inpaintArea);
        inpaintArea.value = selectedImageData.inpaintArea;
      } else {
        inpaintArea.value = null;
      }
      
      console.log('Successfully loaded image data from history');
      
    } catch (error) {
      console.error('Error loading image data from history:', error);
      showErrorToast(`Failed to load image from history: ${error.message}`);
      
      // Set error state for the app
      appState.value = { 
        loading: false, 
        error: `History navigation failed: ${error.message}`, 
        imageData: null 
      };
      renderInpaintApp();
    }
    
  } else {
    console.log('No pagination data available - hiding interface');
    
    // Clear current state when no data is available
    currentImageData = null;
    inpaintArea.value = null;
    
    // Set appropriate app state
    appState.value = { 
      loading: false, 
      error: 'No image data available in history', 
      imageData: null 
    };
    renderInpaintApp();
  }
}

// Function to refresh the pagination component with the current history
function updateInpaintHistoryPagination() {
  try {
    if (paginationInstance) {
      console.log('Updating pagination with history:', inpaintHistory.length, 'items');
      
      // Use callback to ensure goToPage() executes after setDataList() state update is complete
      paginationInstance.setDataList([...inpaintHistory], () => {
        // Navigate to the most recent item (last in array) after data list has been updated
        if (inpaintHistory.length > 0) {
          const lastPageIndex = inpaintHistory.length - 1;
          paginationInstance.goToPage(lastPageIndex);
          console.log('Navigated to most recent history item at index:', lastPageIndex);
        } else {
          console.log('No history items available for pagination');
        }
      });
    } else {
      console.warn('Pagination instance not available for history update');
    }
  } catch (error) {
    console.error('Error updating pagination with history:', error);
    showErrorToast(`Failed to update pagination: ${error.message}`);
  }
}

// Function to populate form fields with image data
function populateFormWithImageData(imageData) {
  try {
    // Populate the name field if available
    const nameInput = document.getElementById('name');
    if (nameInput && imageData.name) {
      nameInput.value = imageData.name;
    }
    
    // Populate the description field with prompt if available
    const descriptionTextarea = document.getElementById('description');
    if (descriptionTextarea && imageData.prompt) {
      descriptionTextarea.value = imageData.prompt;
    }
    
    // Populate the seed field if available and not locked
    const seedInput = document.getElementById('seed');
    const lockSeedCheckbox = document.getElementById('lock-seed');
    if (seedInput && imageData.seed && !lockSeedCheckbox.checked) {
      seedInput.value = imageData.seed;
    }
    
    // Populate the workflow field if available
    const workflowSelect = document.getElementById('workflow');
    if (workflowSelect && imageData.workflow) {
      workflowSelect.value = imageData.workflow;
      // Trigger workflow change handler to update autocomplete settings
      handleWorkflowChange();
    }
    
    console.log('Form fields populated with image data');
    
  } catch (error) {
    console.error('Error populating form fields:', error);
  }
}

// Function to set initial random seed
function updateSeedIfNotLocked() {
  const lockSeedCheckbox = document.getElementById('lock-seed');
  const seedInput = document.getElementById('seed');
  
  if (!lockSeedCheckbox.checked) {
    seedInput.value = generateRandomSeed();
  }
}

// Function to handle Done button click
function handleDoneClick() {
  // Get current UID from the URL or current image data
  let currentUID = getQueryParam('uid');
  
  // If we have current image data with a UID, use that (in case it was updated by inpaint)
  if (currentImageData && currentImageData.uid) {
    currentUID = currentImageData.uid;
  }
  
  // Construct return URL to index page
  let returnUrl = '/';
  if (currentUID) {
    returnUrl = `/?uid=${currentUID}`;
  }
  
  console.log('Navigating back to main page with URL:', returnUrl);
  
  // Navigate back to the index page
  window.location.href = returnUrl;
}

// Initialize the inpaint page
async function initializeInpaintPage() {
  try {
    console.log('Initializing inpaint page...');
    
    // Initialize the InpaintApp with loading state
    renderInpaintApp();
    
    // Parse UID from query parameters
    const uid = getQueryParam('uid');
    
    if (!uid) {
      console.error('No UID provided in query parameters');
      showErrorToast('No image UID provided');
      
      // Update app state with error
      appState.value = { loading: false, error: 'No image UID provided', imageData: null };
      renderInpaintApp();
      return;
    }
    
    // Validate UID is a number
    const numericUID = parseInt(uid);
    if (isNaN(numericUID)) {
      console.error('Invalid UID format:', uid);
      showErrorToast('Invalid image UID format');
      
      // Update app state with error
      appState.value = { loading: false, error: 'Invalid image UID format', imageData: null };
      renderInpaintApp();
      return;
    }
    
    // Initialize pagination component before loading data
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
      paginationInstance = createPagination(
        paginationContainer,
        [], // Start with empty data - will be populated after image loads
        1,  // 1 item per page for individual image navigation
        updateInpaintDisplay // Callback function for data updates
      );
      console.log('Pagination component initialized');
    } else {
      console.error('Pagination container not found');
    }
    
    // Load workflows and image data in parallel
    await Promise.all([
      loadInpaintWorkflows(),
      loadImageDataByUID(numericUID)
    ]);
    
    // Verify that the initial image was properly added to history and pagination is updated
    if (inpaintHistory.length > 0 && currentImageData) {
      console.log('Inpaint history successfully initialized with initial UID:', numericUID);
      console.log('History contains:', inpaintHistory.length, 'item(s)');
      console.log('Current image UID:', currentImageData.uid);
      
      // Ensure pagination is showing the correct state
      if (paginationInstance) {
        const paginationState = paginationInstance.getState();
        console.log('Pagination state after initialization:', paginationState);
      }
    } else {
      console.warn('History initialization may have failed - no items in history or no current image data');
    }
    
    // Set initial random seed
    updateSeedIfNotLocked();
    
    // Add event listener for inpaint button
    const generateButton = document.getElementById('generate-btn');
    if (generateButton) {
      generateButton.addEventListener('click', handleInpaint);
    }
    
    // Add event listener for done button
    const doneButton = document.getElementById('done-btn');
    if (doneButton) {
      doneButton.addEventListener('click', handleDoneClick);
      // Only disable Done button if we don't have valid image data loaded
      if (!currentImageData || !currentImageData.uid) {
        doneButton.disabled = true;
      }
    } else {
      console.error('Done button not found');
    }
    
    console.log('Inpaint page initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize inpaint page:', error);
    showErrorToast('Failed to initialize inpaint page');
    
    // Update app state with error
    appState.value = { loading: false, error: 'Failed to initialize inpaint page', imageData: null };
    renderInpaintApp();
  }
}

// Document ready handler
document.addEventListener('DOMContentLoaded', initializeInpaintPage);