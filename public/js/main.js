// Main application entry point
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { loadTags } from './tags.js';
import { getCurrentDescription } from './autocomplete-setup.js';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.js';
import { GeneratedImageDisplayComponent, createGeneratedImageDisplay } from './custom-ui/generated-image-display.js';
import { CarouselDisplayComponent, createCarouselDisplay } from './custom-ui/carousel-display.js';
import { GalleryDisplay } from './custom-ui/gallery.js';
import { createImageModal } from './custom-ui/modal.js';
import { createGalleryPreview } from './gallery-preview.js';
import { fetchJson, fetchWithRetry, FetchError } from './util.js';

// Helper function to generate random seed
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295); // Max 32-bit unsigned integer
}

/**
 * Main Application Component
 * Manages global application state and coordinates between components
 */
class AppComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      workflows: [],
      selectedWorkflow: '',
      formData: {
        description: '',
        name: '',
        seed: generateRandomSeed(),
        lockSeed: false
      },
      carouselData: [],
      currentImageData: null,
      isGenerating: false,
      isGalleryVisible: false
    };
    
    console.log('AppComponent initialized');
  }
  
  async componentDidMount() {
    try {
      console.log('AppComponent: Initializing application...');
      await loadTags();
      await this.loadWorkflows();
      
      // Initialize components after state is ready
      this.initializeComponents();
      
      console.log('AppComponent: Application initialized successfully');
    } catch (error) {
      console.error('AppComponent: Failed to initialize application:', error);
      showErrorToast('Failed to initialize application');
    }
  }
  
  componentDidUpdate(prevProps, prevState) {
    // Update form fields when state changes
    this.updateFormFields();
    
    // Update workflow dropdown when workflows load
    if (prevState.workflows.length === 0 && this.state.workflows.length > 0) {
      this.updateWorkflowSelect();
    }
    
    // Update components when data changes
    if (prevState.currentImageData !== this.state.currentImageData && this.generatedImageDisplay) {
      if (this.state.currentImageData) {
        this.generatedImageDisplay.setImageData(this.state.currentImageData);
      }
    }
    
    if (prevState.carouselData !== this.state.carouselData && this.carouselDisplay) {
      this.carouselDisplay.setData(this.state.carouselData);
    }
  }
  
  /**
   * Load workflows from server
   */
  async loadWorkflows() {
    try {
      console.log('Loading workflows...');
      
      const workflows = await fetchJson('/generate/workflows', {}, {
        maxRetries: 3,
        retryDelay: 1000,
        showUserFeedback: true,
        showSuccessFeedback: false,
        successMessage: 'Workflows loaded successfully'
      });
      
      this.setState({ workflows });
      console.log('Workflows loaded:', workflows);
    } catch (error) {
      console.error('Error loading workflows:', error);
      showErrorToast('Failed to load workflows');
    }
  }
  
  /**
   * Handle workflow selection change
   */
  handleWorkflowChange = (e) => {
    const selectedWorkflow = e.target.value;
    this.setState({ selectedWorkflow });
    
    if (selectedWorkflow) {
      const workflow = this.state.workflows.find(w => w.name === selectedWorkflow);
      if (workflow) {
        // Update autocomplete setting for description textarea
        const descriptionTextarea = document.getElementById('description');
        if (descriptionTextarea) {
          if (workflow.autocomplete) {
            descriptionTextarea.removeAttribute('autocomplete');
            console.log('Autocomplete enabled for workflow:', selectedWorkflow);
          } else {
            descriptionTextarea.setAttribute('autocomplete', 'off');
            console.log('Autocomplete disabled for workflow:', selectedWorkflow);
          }
        }
      }
    }
  }
  
  /**
   * Handle form field changes
   */
  handleFormChange = (field, value) => {
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [field]: value
      }
    }));
  }
  
  /**
   * Update seed if not locked
   */
  updateSeedIfNotLocked = () => {
    if (!this.state.formData.lockSeed) {
      this.handleFormChange('seed', generateRandomSeed());
    }
  }
  
  /**
   * Handle field use from GeneratedImageDisplay
   */
  handleUseField = (fieldName, value) => {
    switch(fieldName) {
      case 'workflow':
        if (value && this.state.workflows.find(w => w.name === value)) {
          this.setState({ selectedWorkflow: value });
          showToast(`Workflow set to: ${value}`);
          // Update autocomplete settings
          const workflow = this.state.workflows.find(w => w.name === value);
          if (workflow) {
            const descriptionTextarea = document.getElementById('description');
            if (descriptionTextarea) {
              if (workflow.autocomplete) {
                descriptionTextarea.removeAttribute('autocomplete');
              } else {
                descriptionTextarea.setAttribute('autocomplete', 'off');
              }
            }
          }
        } else {
          showErrorToast(`Workflow "${value}" not found`);
        }
        break;
        
      case 'name':
        if (value) {
          this.handleFormChange('name', value);
          showToast(`Name set to: ${value}`);
        }
        break;
        
      case 'tags':
      case 'description':
        if (value) {
          this.handleFormChange('description', value);
          // Update the DOM textarea as well for autocomplete functionality
          const descriptionTextarea = document.getElementById('description');
          if (descriptionTextarea) {
            descriptionTextarea.value = value;
          }
          showToast(fieldName === 'tags' ? 'Description set from tags' : 'Description set');
        }
        break;
        
      case 'seed':
        if (value && !isNaN(value)) {
          this.handleFormChange('seed', parseInt(value));
          this.handleFormChange('lockSeed', true);
          showToast(`Seed set to: ${value} (locked)`);
        } else {
          showErrorToast(`Invalid seed value: ${value}`);
        }
        break;
        
      default:
        console.error('Unknown field for use:', fieldName);
        showErrorToast(`Unknown field: ${fieldName}`);
    }
  }
  
  /**
   * Handle gallery load
   */
  handleGalleryLoad = (dataList) => {
    this.setState({ carouselData: dataList });
  }
  
  /**
   * Handle carousel selection change
   */
  handleCarouselChange = (imageData) => {
    this.setState({ currentImageData: imageData });
  }
  
  /**
   * Handle gallery open
   */
  handleGalleryClick = () => {
    this.setState({ isGalleryVisible: true });
  }
  
  /**
   * Handle gallery close
   */
  handleGalleryClose = () => {
    this.setState({ isGalleryVisible: false });
  }
  
  /**
   * Handle image generation
   */
  handleGenerate = async () => {
    const descriptionText = getCurrentDescription();
    const { selectedWorkflow, formData } = this.state;
    
    if (!descriptionText.trim()) {
      showErrorToast('Please enter a description before generating an image.');
      return;
    }
    
    if (!selectedWorkflow) {
      showErrorToast('Please select a workflow before generating an image.');
      return;
    }
    
    if (!formData.seed) {
      showErrorToast('Please enter a seed value.');
      return;
    }

    this.setState({ isGenerating: true });
    showToast('Sending generation request to ComfyUI...');

    try {
      // Update seed for next generation unless locked
      this.updateSeedIfNotLocked();

      const requestBody = {
        prompt: descriptionText,
        workflow: selectedWorkflow,
        seed: parseInt(formData.seed)
      };
      
      // Add name if provided
      if (formData.name.trim()) {
        requestBody.name = formData.name.trim();
      }
      
      const response = await fetchWithRetry('/generate/txt2img', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }, {
        maxRetries: 1,
        retryDelay: 2000,
        timeout: 120000,
        showUserFeedback: false
      });

      const result = await response.json();
      
      showSuccessToast('Image generated successfully!');
      console.log('Generation result:', result);
      
      // Add to carousel data
      if (result.data && result.data.imageUrl) {
        this.setState(prevState => ({
          carouselData: [...prevState.carouselData, result.data],
          currentImageData: result.data
        }));
      }

    } catch (error) {
      console.error('Error generating image:', error);
      
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
    } finally {
      this.setState({ isGenerating: false });
    }
  }
  
  /**
   * Render the application components (simplified approach using factory functions + GalleryDisplay)
   */
  render() {
    const { isGalleryVisible } = this.state;
    
    return html`
      <div class="app-components">
        <!-- Gallery Display Component -->
        ${isGalleryVisible ? html`
          <${GalleryDisplay}
            queryPath="/image-data"
            previewFactory=${createGalleryPreview}
            onLoad=${this.handleGalleryLoad}
            onClose=${this.handleGalleryClose}
            isVisible=${isGalleryVisible}
          />
        ` : null}
      </div>
    `;
  }
  
  /**
   * Initialize components using factory functions after mount
   */
  initializeComponents() {
    // Initialize GeneratedImageDisplay using factory function
    const generatedImageDisplayElement = document.getElementById('generatedImageDisplay');
    if (generatedImageDisplayElement && !this.generatedImageDisplay) {
      this.generatedImageDisplay = createGeneratedImageDisplay(
        generatedImageDisplayElement, 
        this.handleUseField
      );
    }
    
    // Initialize CarouselDisplay using factory function
    const carouselDisplayElement = document.getElementById('carouselDisplay');
    if (carouselDisplayElement && this.generatedImageDisplay && !this.carouselDisplay) {
      this.carouselDisplay = createCarouselDisplay(
        carouselDisplayElement, 
        this.generatedImageDisplay.getComponent ? this.generatedImageDisplay.getComponent() : GeneratedImageDisplayComponent
      );
      
      // Set up carousel change handler
      if (this.carouselDisplay.setOnSelectionChange) {
        this.carouselDisplay.setOnSelectionChange(this.handleCarouselChange);
      }
    }
  }
  
  /**
   * Update the existing workflow select element
   */
  updateWorkflowSelect() {
    const workflowSelect = document.getElementById('workflow');
    if (workflowSelect && this.state.workflows.length > 0) {
      // Clear existing options
      workflowSelect.innerHTML = '';
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a workflow...';
      workflowSelect.appendChild(defaultOption);
      
      // Add workflow options
      this.state.workflows.forEach(workflow => {
        const option = document.createElement('option');
        option.value = workflow.name;
        option.textContent = workflow.name;
        if (workflow.name === this.state.selectedWorkflow) {
          option.selected = true;
        }
        workflowSelect.appendChild(option);
      });
      
      // Add event listener if not already added
      if (!workflowSelect.hasAttribute('data-handler-added')) {
        workflowSelect.addEventListener('change', this.handleWorkflowChange);
        workflowSelect.setAttribute('data-handler-added', 'true');
      }
    }
  }
  
  /**
   * Update form fields to match component state
   */
  updateFormFields() {
    const nameInput = document.getElementById('name');
    const seedInput = document.getElementById('seed');
    const lockSeedCheckbox = document.getElementById('lock-seed');
    const descriptionTextarea = document.getElementById('description');
    const generateButton = document.getElementById('generate-btn');
    
    if (nameInput && nameInput.value !== this.state.formData.name) {
      nameInput.value = this.state.formData.name;
    }
    
    if (seedInput && parseInt(seedInput.value) !== this.state.formData.seed) {
      seedInput.value = this.state.formData.seed;
    }
    
    if (lockSeedCheckbox && lockSeedCheckbox.checked !== this.state.formData.lockSeed) {
      lockSeedCheckbox.checked = this.state.formData.lockSeed;
    }
    
    if (generateButton) {
      generateButton.disabled = this.state.isGenerating;
      generateButton.textContent = this.state.isGenerating ? 'Generating...' : 'Generate';
    }
    
    if (descriptionTextarea) {
      descriptionTextarea.disabled = this.state.isGenerating;
    }
  }
}

// Initialize the application with Preact
document.addEventListener('DOMContentLoaded', function() {
  console.log('Main: Initializing Preact application...');
  
  // Create a container for the Preact app
  let appContainer = document.getElementById('app-container');
  if (!appContainer) {
    appContainer = document.createElement('div');
    appContainer.id = 'app-container';
    appContainer.style.display = 'none'; // Hidden container for component management
    document.body.appendChild(appContainer);
  }
  
  // Create app instance
  let appInstance = null;
  
  // Render the App component
  render(
    html`<${AppComponent} ref=${(ref) => { appInstance = ref; }} />`,
    appContainer
  );
  
  // Set up event listeners for existing DOM elements
  setTimeout(() => {
    // Set up form field change listeners
    const nameInput = document.getElementById('name');
    const seedInput = document.getElementById('seed');
    const lockSeedCheckbox = document.getElementById('lock-seed');
    const descriptionTextarea = document.getElementById('description');
    
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        if (appInstance) {
          appInstance.handleFormChange('name', e.target.value);
        }
      });
    }
    
    if (seedInput) {
      seedInput.addEventListener('input', (e) => {
        if (appInstance) {
          appInstance.handleFormChange('seed', e.target.value);
        }
      });
    }
    
    if (lockSeedCheckbox) {
      lockSeedCheckbox.addEventListener('change', (e) => {
        if (appInstance) {
          appInstance.handleFormChange('lockSeed', e.target.checked);
        }
      });
    }
    
    if (descriptionTextarea) {
      descriptionTextarea.addEventListener('input', (e) => {
        if (appInstance) {
          appInstance.handleFormChange('description', e.target.value);
        }
      });
    }
    
    // Set up generate button
    const generateButton = document.getElementById('generate-btn');
    if (generateButton) {
      generateButton.addEventListener('click', () => {
        if (appInstance) {
          appInstance.handleGenerate();
        }
      });
    }
    
    // Set up gallery button
    const galleryButton = document.getElementById('gallery-btn');
    if (galleryButton) {
      galleryButton.addEventListener('click', () => {
        if (appInstance) {
          appInstance.handleGalleryClick();
        }
      });
    }
    
    console.log('Main: Event listeners set up successfully');
  }, 100);
  
  console.log('Main: Preact application initialized successfully');
});
