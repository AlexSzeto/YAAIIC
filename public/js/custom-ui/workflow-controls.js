// Workflow Controls Component - All form controls and inputs
import { Component } from 'preact';
import { html } from 'htm/preact';

/**
 * WorkflowControlsComponent - Renders all form controls for workflow configuration
 */
export class WorkflowControlsComponent extends Component {
  constructor(props) {
    super(props);
    
    // Ref for textarea to handle autocomplete integration
    this.descriptionTextareaRef = null;
  }
  
  componentDidMount() {
    // Set up autocomplete on the description textarea if needed
    this.updateAutocompleteSettings();
    this.initializeAutocomplete();
  }
  
  componentDidUpdate(prevProps) {
    // Update autocomplete settings when workflow changes
    if (prevProps.selectedWorkflow !== this.props.selectedWorkflow) {
      this.updateAutocompleteSettings();
    }
  }
  
  initializeAutocomplete() {
    // Import and set up autocomplete for the textarea
    if (this.descriptionTextareaRef && typeof window.initAutoComplete === 'function') {
      // Call the global autocomplete initialization if available
      window.initAutoComplete();
    } else {
      // Fallback: try to trigger autocomplete setup after a short delay
      setTimeout(() => {
        if (this.descriptionTextareaRef && typeof window.initAutoComplete === 'function') {
          window.initAutoComplete();
        }
      }, 100);
    }
  }
  
  updateAutocompleteSettings() {
    const { selectedWorkflow, workflows } = this.props;
    
    if (this.descriptionTextareaRef && selectedWorkflow && workflows) {
      const workflow = workflows.find(w => w.name === selectedWorkflow);
      if (workflow) {
        if (workflow.autocomplete) {
          this.descriptionTextareaRef.removeAttribute('autocomplete');
          console.log('Autocomplete enabled for workflow:', selectedWorkflow);
        } else {
          this.descriptionTextareaRef.setAttribute('autocomplete', 'off');
          console.log('Autocomplete disabled for workflow:', selectedWorkflow);
        }
      }
    }
  }
  
  handleWorkflowChange = (e) => {
    const { onWorkflowChange } = this.props;
    if (onWorkflowChange) {
      onWorkflowChange(e);
    }
  }
  
  handleNameChange = (e) => {
    const { onFormChange } = this.props;
    if (onFormChange) {
      onFormChange('name', e.target.value);
    }
  }
  
  handleSeedChange = (e) => {
    const { onFormChange } = this.props;
    if (onFormChange) {
      onFormChange('seed', e.target.value);
    }
  }
  
  handleLockSeedChange = (e) => {
    const { onFormChange } = this.props;
    if (onFormChange) {
      onFormChange('lockSeed', e.target.checked);
    }
  }
  
  handleDescriptionChange = (e) => {
    const { onFormChange } = this.props;
    if (onFormChange) {
      onFormChange('description', e.target.value);
    }
  }
  
  handleGenerateClick = (e) => {
    const { onGenerate } = this.props;
    if (onGenerate) {
      onGenerate(e);
    }
  }
  
  handleGalleryClick = (e) => {
    const { onGalleryClick } = this.props;
    if (onGalleryClick) {
      onGalleryClick(e);
    }
  }
  
  render() {
    const {
      workflows = [],
      selectedWorkflow = '',
      formData = {},
      isGenerating = false
    } = this.props;
    
    const {
      name = '',
      seed = '',
      lockSeed = false,
      description = ''
    } = formData;
    
    return html`
      <!-- Workflow Configuration Row -->
      <div class="workflow-controls">
        <div class="form-group">
          <label for="workflow">Workflow:</label>
          <select 
            id="workflow" 
            name="workflow" 
            value=${selectedWorkflow}
            onChange=${this.handleWorkflowChange}
          >
            ${workflows.length === 0 ? html`
              <option value="">Loading workflows...</option>
            ` : html`
              <option value="">Select a workflow...</option>
              ${workflows.map(workflow => html`
                <option value=${workflow.name} key=${workflow.name}>
                  ${workflow.name}
                </option>
              `)}
            `}
          </select>
        </div>

        <div class="form-group">
          <label for="name">Name:</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            placeholder="Enter name"
            value=${name}
            onChange=${this.handleNameChange}
            disabled=${isGenerating}
          />
        </div>

        <div class="form-group">
          <label for="seed">Seed:</label>
          <input 
            type="number" 
            id="seed" 
            name="seed" 
            min="0" 
            max="4294967295"
            value=${seed}
            onChange=${this.handleSeedChange}
            disabled=${isGenerating}
          />
        </div>

        <div class="form-group">
          <label for="lock-seed">
            <input 
              type="checkbox" 
              id="lock-seed" 
              name="lock-seed"
              checked=${lockSeed}
              onChange=${this.handleLockSeedChange}
              disabled=${isGenerating}
            />
            Lock seed
          </label>
        </div>

        <div class="form-group full-width">
          <label for="description">Description:</label>
          <textarea 
            id="description" 
            placeholder="Enter your text here..."
            value=${description}
            onChange=${this.handleDescriptionChange}
            disabled=${isGenerating}
            ref=${(ref) => { this.descriptionTextareaRef = ref; }}
          ></textarea>
        </div>

        <!-- Button Row Container -->
        <div class="button-row">
          <button 
            id="generate-btn" 
            class="generate-button btn-with-icon"
            onClick=${this.handleGenerateClick}
            disabled=${isGenerating}
          >
            <box-icon name='play' color='#ffffff'></box-icon>
            ${isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <button 
            id="gallery-btn" 
            class="gallery-btn btn-with-icon" 
            title="Gallery"
            onClick=${this.handleGalleryClick}
            disabled=${isGenerating}
          >
            <box-icon name='image' color='#ffffff'></box-icon>
            Gallery
          </button>
        </div>
      </div>
    `;
  }
}

export default WorkflowControlsComponent;