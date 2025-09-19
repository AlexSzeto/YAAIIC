// Main application entry point
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { loadTags } from './tags.js';
import { showToast, showSuccessToast, showErrorToast } from './custom-ui/toast.js';
import { GeneratedImageDisplayComponent } from './custom-ui/generated-image-display.js';
import { CarouselDisplayComponent } from './custom-ui/carousel-display.js';
import { GalleryDisplay } from './custom-ui/gallery.js';
import { createImageModal } from './custom-ui/modal.js';
import { createGalleryPreview } from './gallery-preview.js';
import { fetchJson, fetchWithRetry, FetchError } from './util.js';

// Import new UI components
import { HeaderComponent } from './custom-ui/header.js';
import { WorkflowControlsComponent } from './custom-ui/workflow-controls.js';
import { GeneratedImageContainerComponent } from './custom-ui/generated-image-container.js';
import { CarouselContainerComponent } from './custom-ui/carousel-container.js';

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
      
      console.log('AppComponent: Application initialized successfully');
    } catch (error) {
      console.error('AppComponent: Failed to initialize application:', error);
      showErrorToast('Failed to initialize application');
    }
  }
  
  componentDidUpdate(prevProps, prevState) {
    // Update workflow dropdown when workflows load
    if (prevState.workflows.length === 0 && this.state.workflows.length > 0) {
      console.log('Workflows loaded:', this.state.workflows.length);
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
        console.log(`Workflow selected: ${selectedWorkflow}, autocomplete: ${workflow.autocomplete ? 'enabled' : 'disabled'}`);
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
    const descriptionText = this.state.formData.description || '';
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
   * Render the complete application UI using Preact components
   */
  render() {
    const { 
      workflows, 
      selectedWorkflow, 
      formData, 
      carouselData, 
      currentImageData, 
      isGenerating,
      isGalleryVisible 
    } = this.state;
    
    const showGeneratedImage = currentImageData !== null;
    const showCarousel = carouselData.length > 0;
    
    return html`
      <div class="app-container">
        <!-- Header -->
        <${HeaderComponent} />
        
        <!-- Workflow Controls -->
        <${WorkflowControlsComponent}
          workflows=${workflows}
          selectedWorkflow=${selectedWorkflow}
          formData=${formData}
          isGenerating=${isGenerating}
          onWorkflowChange=${this.handleWorkflowChange}
          onFormChange=${this.handleFormChange}
          onGenerate=${this.handleGenerate}
          onGalleryClick=${this.handleGalleryClick}
        />
        
        <!-- Generated Image Display -->
        ${showGeneratedImage ? html`
          <${GeneratedImageContainerComponent}
            isVisible=${showGeneratedImage}
            imageData=${currentImageData}
            onUseField=${this.handleUseField}
          />
        ` : null}
        
        <!-- Carousel Display -->
        ${showCarousel ? html`
          <${CarouselContainerComponent}
            isVisible=${showCarousel}
            carouselData=${carouselData}
            dataDisplayComponent=${GeneratedImageDisplayComponent}
            onSelectionChange=${this.handleCarouselChange}
          />
        ` : null}
        
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
}

// Initialize the application with Preact
document.addEventListener('DOMContentLoaded', function() {
  console.log('Main: Initializing Preact application...');
  
  // Get or create the root container for the Preact app
  let appRoot = document.getElementById('app-root');
  if (!appRoot) {
    // Fallback: create app-root if it doesn't exist
    appRoot = document.createElement('div');
    appRoot.id = 'app-root';
    document.body.appendChild(appRoot);
  }
  
  // Render the complete App component
  render(html`<${AppComponent} />`, appRoot);
  
  console.log('Main: Preact application initialized successfully');
});
