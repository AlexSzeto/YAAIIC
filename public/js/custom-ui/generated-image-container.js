// Generated Image Container Component - Container for generated image display
import { Component } from 'preact';
import { html } from 'htm/preact';
import { GeneratedImageDisplayComponent } from './generated-image-display.js';
import { sendToClipboard } from '../util.js';

/**
 * GeneratedImageContainerComponent - Wraps GeneratedImageDisplayComponent with container structure
 */
export class GeneratedImageContainerComponent extends Component {
  constructor(props) {
    super(props);
  }
  
  render() {
    const { 
      isVisible = false, 
      imageData = null,
      onUseField,
      ...otherProps 
    } = this.props;
    
    if (!isVisible || !imageData) {
      return null;
    }
    
    return html`
      <div id="generatedImageDisplay" class="generated-image-display" style="display: block;">
        <h3 class="generated-image-title">Generated Image</h3>
        <div class="generated-image-content">
          <div class="generated-image-left">
            <img class="generated-image" src=${imageData.imageUrl || ''} alt="Generated image" />
          </div>
          <div class="generated-image-right">
            <div class="info-section">
              <div class="info-header">
                <label class="info-label">Workflow:</label>
                <div class="info-buttons">
                  <button 
                    class="info-btn copy-btn" 
                    title="Copy to clipboard" 
                    data-field="workflow"
                    onClick=${() => this.handleCopy('workflow', imageData.workflow)}
                  >
                    <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
                  </button>
                  <button 
                    class="info-btn use-btn" 
                    title="Use in form" 
                    data-field="workflow"
                    onClick=${() => onUseField && onUseField('workflow', imageData.workflow)}
                  >
                    <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
                  </button>
                </div>
              </div>
              <input type="text" class="info-workflow" readonly value=${imageData.workflow || ''} />
            </div>
            
            <div class="info-section">
              <div class="info-header">
                <label class="info-label">Name:</label>
                <div class="info-buttons">
                  <button 
                    class="info-btn copy-btn" 
                    title="Copy to clipboard" 
                    data-field="name"
                    onClick=${() => this.handleCopy('name', imageData.name)}
                  >
                    <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
                  </button>
                  <button 
                    class="info-btn use-btn" 
                    title="Use in form" 
                    data-field="name"
                    onClick=${() => onUseField && onUseField('name', imageData.name)}
                  >
                    <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
                  </button>
                </div>
              </div>
              <input type="text" class="info-name" readonly value=${imageData.name || ''} />
            </div>
            
            <div class="info-section">
              <div class="info-header">
                <label class="info-label">Prompt:</label>
                <div class="info-buttons">
                  <button 
                    class="info-btn copy-btn" 
                    title="Copy to clipboard" 
                    data-field="tags"
                    onClick=${() => this.handleCopy('tags', imageData.tags)}
                  >
                    <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
                  </button>
                  <button 
                    class="info-btn use-btn" 
                    title="Use in form" 
                    data-field="tags"
                    onClick=${() => onUseField && onUseField('tags', imageData.tags)}
                  >
                    <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
                  </button>
                </div>
              </div>
              <textarea class="info-tags" readonly>${imageData.tags || ''}</textarea>
            </div>
            
            <div class="info-section">
              <div class="info-header">
                <label class="info-label">Description:</label>
                <div class="info-buttons">
                  <button 
                    class="info-btn copy-btn" 
                    title="Copy to clipboard" 
                    data-field="description"
                    onClick=${() => this.handleCopy('description', imageData.description)}
                  >
                    <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
                  </button>
                  <button 
                    class="info-btn use-btn" 
                    title="Use in form" 
                    data-field="description"
                    onClick=${() => onUseField && onUseField('description', imageData.description)}
                  >
                    <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
                  </button>
                </div>
              </div>
              <textarea class="info-description" readonly>${imageData.description || ''}</textarea>
            </div>
            
            <div class="info-section">
              <div class="info-header">
                <label class="info-label">Seed:</label>
                <div class="info-buttons">
                  <button 
                    class="info-btn copy-btn" 
                    title="Copy to clipboard" 
                    data-field="seed"
                    onClick=${() => this.handleCopy('seed', imageData.seed)}
                  >
                    <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
                  </button>
                  <button 
                    class="info-btn use-btn" 
                    title="Use in form and lock seed" 
                    data-field="seed"
                    onClick=${() => onUseField && onUseField('seed', imageData.seed)}
                  >
                    <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
                  </button>
                </div>
              </div>
              <input type="text" class="info-seed" readonly value=${imageData.seed || ''} />
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  handleCopy = async (fieldName, value) => {
    if (!value) return;
    
    const successMessage = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} copied to clipboard`;
    await sendToClipboard(value.toString(), successMessage);
  }
}

export default GeneratedImageContainerComponent;