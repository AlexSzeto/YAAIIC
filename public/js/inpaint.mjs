// Inpaint page script module
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { signal } from '@preact/signals';
import { InpaintComponent } from './inpaint-canvas.mjs';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.mjs';
import { fetchJson } from './util.mjs';

let workflows = [];
let currentImageData = null;

// Initialize inpaintArea as a preact signal
const inpaintArea = signal(null);

// Export inpaintArea for use in other modules
export { inpaintArea };

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

// Function to parse URL query parameters
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
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
    
    // Populate the name field if available
    const nameInput = document.getElementById('name');
    if (nameInput && currentImageData.name) {
      nameInput.value = currentImageData.name;
    }
    
    // Update app state with loaded image data
    appState.value = { loading: false, error: null, imageData: currentImageData };
    renderInpaintApp();
    
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
    
    // Update app state with error
    appState.value = { loading: false, error: 'Failed to initialize inpaint page', imageData: null };
    renderInpaintApp();
  }
}

// Document ready handler
document.addEventListener('DOMContentLoaded', initializeInpaintPage);