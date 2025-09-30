// Inpaint page script module
import { renderInpaintComponent } from './inpaint-canvas.mjs';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.mjs';
import { fetchJson } from './util.mjs';

let workflows = [];
let currentImageData = null;

// Function to parse URL query parameters
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
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
      }
      
      workflowSelect.disabled = false;
    }
    
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
    
    currentImageData = await fetchJson(`/image-data/${uid}`, {}, {
      maxRetries: 2,
      retryDelay: 1000,
      showUserFeedback: true,
      showSuccessFeedback: false
    });
    
    console.log('Image data loaded:', currentImageData);
    
    // Populate the name field if available
    const nameInput = document.getElementById('name');
    if (nameInput && currentImageData.name) {
      nameInput.value = currentImageData.name;
    }
    
    // Initialize the InpaintComponent with the image URL
    const inpaintContainer = document.getElementById('inpaintContainer');
    if (inpaintContainer && currentImageData.imageUrl) {
      renderInpaintComponent(inpaintContainer, currentImageData.imageUrl);
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
    
    // Show error state in inpaint container
    const inpaintContainer = document.getElementById('inpaintContainer');
    if (inpaintContainer) {
      inpaintContainer.innerHTML = `
        <div class="content-container">
          <div class="inpaint-error">
            <h3>Error Loading Image</h3>
            <p>${errorMessage}</p>
            <p><a href="/">Return to main page</a></p>
          </div>
        </div>
      `;
    }
  }
}

// Function to generate random seed
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295); // Max 32-bit unsigned integer
}

// Function to set initial random seed
function updateSeedIfNotLocked() {
  const lockSeedCheckbox = document.getElementById('lock-seed');
  const seedInput = document.getElementById('seed');
  
  if (!lockSeedCheckbox.checked) {
    seedInput.value = generateRandomSeed();
  }
}

// Initialize the inpaint page
async function initializeInpaintPage() {
  try {
    console.log('Initializing inpaint page...');
    
    // Parse UID from query parameters
    const uid = getQueryParam('uid');
    
    if (!uid) {
      console.error('No UID provided in query parameters');
      showErrorToast('No image UID provided');
      
      // Show error state
      const inpaintContainer = document.getElementById('inpaintContainer');
      if (inpaintContainer) {
        inpaintContainer.innerHTML = `
          <div class="content-container">
            <div class="inpaint-error">
              <h3>No Image Selected</h3>
              <p>Please select an image to inpaint from the main page.</p>
              <p><a href="/">Return to main page</a></p>
            </div>
          </div>
        `;
      }
      return;
    }
    
    // Validate UID is a number
    const numericUID = parseInt(uid);
    if (isNaN(numericUID)) {
      console.error('Invalid UID format:', uid);
      showErrorToast('Invalid image UID format');
      return;
    }
    
    // Load workflows and image data in parallel
    await Promise.all([
      loadInpaintWorkflows(),
      loadImageDataByUID(numericUID)
    ]);
    
    // Set initial random seed
    updateSeedIfNotLocked();
    
    console.log('Inpaint page initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize inpaint page:', error);
    showErrorToast('Failed to initialize inpaint page');
  }
}

// Document ready handler
document.addEventListener('DOMContentLoaded', initializeInpaintPage);