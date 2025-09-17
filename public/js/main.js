// Main application entry point
import { loadTags } from './tags.js';
import { getCurrentDescription } from './autocomplete-setup.js';
import { showToast, showSuccessToast, showErrorToast } from './custom-toast.js';
import { GeneratedImageDisplay } from './generated-image-display.js';
import { CarouselDisplay } from './carousel-setup.js';
import { GalleryDisplay } from './gallery-setup.js';
import { createImageModal } from './custom-modal.js';

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
    // Enable autocomplete if it's disabled
    if (descriptionTextarea.hasAttribute('data-autocomplete-disabled')) {
      descriptionTextarea.removeAttribute('data-autocomplete-disabled');
      console.log('Autocomplete enabled for workflow:', selectedWorkflowName);
    }
  } else {
    // Disable autocomplete
    descriptionTextarea.setAttribute('data-autocomplete-disabled', 'true');
    console.log('Autocomplete disabled for workflow:', selectedWorkflowName);
  }
}

// Function to populate workflow dropdown
async function loadWorkflows() {
  try {
    const response = await fetch('/generate/workflows');
    if (!response.ok) {
      throw new Error('Failed to fetch workflows');
    }
    
    workflows = await response.json();
    const workflowSelect = document.getElementById('workflow');
    
    // Clear loading option
    workflowSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a workflow...';
    workflowSelect.appendChild(defaultOption);
    
    // Add workflow options
    workflows.forEach(workflow => {
      const option = document.createElement('option');
      option.value = workflow.name;
      option.textContent = workflow.name;
      workflowSelect.appendChild(option);
    });
    
    // Add change event listener
    workflowSelect.addEventListener('change', handleWorkflowChange);
    
    console.log('Workflows loaded:', workflows);
  } catch (error) {
    console.error('Error loading workflows:', error);
    showErrorToast('Failed to load workflows');
  }
}

// Preview factory function for gallery items
function createGalleryPreview(item) {
  const preview = document.createElement('div');
  preview.className = 'gallery-item';
  
  // Create image element
  const img = document.createElement('img');
  img.className = 'gallery-item-image';
  img.src = item.imageUrl || '';
  img.alt = item.name || 'Generated image';
  
  // Handle image load/error
  img.onerror = function() {
    this.style.backgroundColor = '#333333';
    this.style.display = 'flex';
    this.style.alignItems = 'center';
    this.style.justifyContent = 'center';
    this.style.color = '#999999';
    this.style.fontSize = '10px';
    this.textContent = 'No image';
  };
  
  // Add click event to open image in modal (if image exists)
  img.addEventListener('click', function() {
    if (item.imageUrl && !this.textContent) { // Check if image loaded successfully
      createImageModal(item.imageUrl); // Use default autoScale=true
    }
  });
  
  // Make image cursor pointer when hoverable
  img.style.cursor = 'pointer';
  
  // Create info section
  const info = document.createElement('div');
  info.className = 'gallery-item-info';
  
  const nameDiv = document.createElement('div');
  nameDiv.className = 'gallery-item-name';
  nameDiv.textContent = item.name || 'Unnamed';
  
  const dateDiv = document.createElement('div');
  dateDiv.className = 'gallery-item-date';
  
  // Format timestamp as yyyy-mm-dd
  if (item.timestamp) {
    const date = new Date(item.timestamp);
    dateDiv.textContent = date.toISOString().split('T')[0];
  } else {
    dateDiv.textContent = 'No date';
  }
  
  info.appendChild(nameDiv);
  info.appendChild(dateDiv);
  
  // Assemble preview
  preview.appendChild(img);
  preview.appendChild(info);
  
  return preview;
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
  
  // Show processing toast
  showToast('Sending generation request to ComfyUI...');

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
    
    const response = await fetch('/generate/txt2img', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (response.ok) {
      showSuccessToast('Image generated successfully!');
      console.log('Generation result:', result);
      
      // Create and display the generated image with analysis
      if (result.data && result.data.imageUrl) {
        carouselDisplay.addData(result.data);
      }
    } else {
      throw new Error(result.error || 'Failed to generate image');
    }

  } catch (error) {
    console.error('Error generating image:', error);
    showErrorToast(`Generation failed: ${error.message}`);
  } finally {
    // Re-enable UI
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
    
    // Initialize GeneratedImageDisplay
    const generatedImageDisplayElement = document.getElementById('generatedImageDisplay');
    if (generatedImageDisplayElement) {
      generatedImageDisplay = new GeneratedImageDisplay(generatedImageDisplayElement, handleUseField);
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
    
    // Initialize GalleryDisplay
    galleryDisplay = new GalleryDisplay('/image-data', createGalleryPreview);
    
    // Set up gallery button
    const galleryButton = document.getElementById('gallery-btn');
    if (galleryButton && galleryDisplay) {
      galleryButton.addEventListener('click', () => {
        galleryDisplay.showModal();
      });
      
      // Set up gallery onLoad callback
      galleryDisplay.setOnLoad((dataList) => {
        if (carouselDisplay) {
          carouselDisplay.setData(dataList);
        }
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
