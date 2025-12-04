// Main application entry point
import { loadTags } from './tags.mjs';
import { getCurrentDescription } from './autocomplete-setup.mjs';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.mjs';
import { GeneratedImageDisplay } from './generated-image-display.mjs';
import { CarouselDisplay } from './carousel-setup.mjs';
import { createGallery } from './custom-ui/gallery.mjs';
import { createImageModal } from './custom-ui/modal.mjs';
import { createGalleryPreview } from './gallery-preview.mjs';
import { fetchJson, fetchWithRetry, FetchError } from './util.mjs';
import { sseManager } from './sse-manager.mjs';
import { createProgressBanner } from './custom-ui/progress-banner.mjs';

let workflows = [];
let autoCompleteInstance = null;
let generatedImageDisplay = null;
let carouselDisplay = null;
let galleryDisplay = null;

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
    
    // Filter workflows to only include txt2img type for index page
    const txt2imgWorkflows = workflows.filter(workflow => workflow.type === 'txt2img');
    
    const workflowSelect = document.getElementById('workflow');
    
    // Clear loading option
    workflowSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a workflow...';
    workflowSelect.appendChild(defaultOption);
    
    // Add workflow options (only txt2img workflows)
    txt2imgWorkflows.forEach(workflow => {
      const option = document.createElement('option');
      option.value = workflow.name;
      option.textContent = workflow.name;
      workflowSelect.appendChild(option);
    });
    
    // Add change event listener
    workflowSelect.addEventListener('change', handleWorkflowChange);
    
    console.log('Workflows loaded:', workflows);
    console.log('Filtered txt2img workflows:', txt2imgWorkflows);
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
  
  try {
    // Update seed for next generation unless locked
    updateSeedIfNotLocked();

    const requestBody = {
      prompt: descriptionText,
      workflow: workflowSelect.value,
      seed: parseInt(seedInput.value)
    };
    
    // Add name if provided
    if (nameInput.value.trim()) {
      requestBody.name = nameInput.value.trim();
    }
    
    // Send generation request and get immediate taskId response
    const response = await fetchWithRetry('/generate/txt2img', {
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

    const result = await response.json();
    
    if (!result.taskId) {
      throw new Error('Server did not return a taskId');
    }
    
    console.log('Generation started with taskId:', result.taskId);
    
    // Create progress banner with completion callback
    createProgressBanner(
      result.taskId,
      sseManager,
      (completionData) => {
        // Handle completion - add image to carousel
        if (completionData.result && completionData.result.imageUrl) {
          carouselDisplay.addData(completionData.result);
          showSuccessToast('Image generated successfully!');
        }
        
        // Re-enable UI
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        descriptionTextarea.disabled = false;
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
      generatedImageDisplay = new GeneratedImageDisplay(generatedImageDisplayElement, handleUseField, handleImageDeleted);
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
    
    // Set up generate button
    const generateButton = document.getElementById('generate-btn');
    if (generateButton) {
      generateButton.addEventListener('click', handleGenerate);
    }
    
    console.log('Main: Application initialized successfully');
  } catch (error) {
    console.error('Main: Failed to initialize application:', error);
  }
});
