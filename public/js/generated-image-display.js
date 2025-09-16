// Generated Image Display Module
import { sendToClipboard } from './util.js';
import { createImageModal } from './custom-modal.js';

export class GeneratedImageDisplay {
  constructor(baseElement, onUseField = null) {
    if (!baseElement) {
      throw new Error('BaseElement is required for GeneratedImageDisplay');
    }
    
    this.baseElement = baseElement;
    this.onUseField = onUseField;
    
    // Get references to the inner elements
    this.imageElement = baseElement.querySelector('.generated-image');
    this.workflowInput = baseElement.querySelector('.info-workflow');
    this.nameInput = baseElement.querySelector('.info-name');
    this.tagsTextarea = baseElement.querySelector('.info-tags');
    this.descriptionTextarea = baseElement.querySelector('.info-description');
    this.seedInput = baseElement.querySelector('.info-seed');
    
    // Validate that all required elements exist
    if (!this.imageElement || !this.workflowInput || !this.nameInput || !this.tagsTextarea || 
        !this.descriptionTextarea || !this.seedInput) {
      throw new Error('GeneratedImageDisplay: Required inner elements not found in baseElement');
    }
    
    // Set up button event listeners
    this.setupButtonListeners();
    
    console.log('GeneratedImageDisplay initialized successfully');
  }
  
  /**
   * Set up event listeners for copy and use buttons
   */
  setupButtonListeners() {
    // Get all copy and use buttons
    const copyButtons = this.baseElement.querySelectorAll('.copy-btn');
    const useButtons = this.baseElement.querySelectorAll('.use-btn');
    
    // Set up copy button listeners
    copyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const field = e.target.closest('.copy-btn').getAttribute('data-field');
        this.copyFieldToClipboard(field);
      });
    });
    
    // Set up use button listeners
    useButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const field = e.target.closest('.use-btn').getAttribute('data-field');
        this.useFieldInForm(field);
      });
    });
  }
  
  /**
   * Copy field content to clipboard
   * @param {string} fieldName - The name of the field to copy
   */
  async copyFieldToClipboard(fieldName) {
    let value = '';
    
    switch(fieldName) {
      case 'workflow':
        value = this.workflowInput.value;
        break;
      case 'name':
        value = this.nameInput.value;
        break;
      case 'tags':
        value = this.tagsTextarea.value;
        break;
      case 'description':
        value = this.descriptionTextarea.value;
        break;
      case 'seed':
        value = this.seedInput.value;
        break;
      default:
        console.error('Unknown field for copy:', fieldName);
        return;
    }
    
    if (!value) {
      console.warn(`No content to copy for field: ${fieldName}`);
      return;
    }
    
    const successMessage = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} copied to clipboard`;
    await sendToClipboard(value, successMessage);
  }
  
  /**
   * Use field content in the form
   * @param {string} fieldName - The name of the field to use
   */
  useFieldInForm(fieldName) {
    let value = '';
    
    switch(fieldName) {
      case 'workflow':
        value = this.workflowInput.value;
        break;
      case 'name':
        value = this.nameInput.value;
        break;
      case 'tags':
        value = this.tagsTextarea.value;
        break;
      case 'description':
        value = this.descriptionTextarea.value;
        break;
      case 'seed':
        value = this.seedInput.value;
        break;
      default:
        console.error('Unknown field for use:', fieldName);
        return;
    }
    
    if (!value) {
      console.warn(`No content to use for field: ${fieldName}`);
      return;
    }
    
    // Call the callback function if provided
    if (this.onUseField) {
      this.onUseField(fieldName, value);
    } else {
      console.warn('No onUseField callback provided');
    }
  }
  
  /**
   * Update the display with new image data
   * @param {Object|null} data - Image data object with properties: imageUrl, workflow, name, tags, description, seed
   */
  setData(data) {
    if (!data) {
      // Gracefully blank out the display
      this.blankDisplay();
      return;
    }
    
    // Set image
    if (data.imageUrl) {
      this.imageElement.src = data.imageUrl;
      this.imageElement.alt = data.name || 'Generated image';
      
      // Handle image load/error
      this.imageElement.onload = () => {
        console.log('Image loaded successfully:', data.imageUrl);
        
        // Add click event to open image in modal with original size
        this.imageElement.style.cursor = 'pointer';
        this.imageElement.onclick = () => {
          createImageModal(data.imageUrl, false); // autoScale=false for original size
        };
      };
      
      this.imageElement.onerror = () => {
        console.error('Failed to load image:', data.imageUrl);
        this.imageElement.alt = 'Failed to load image';
        this.imageElement.style.backgroundColor = '#333333';
        this.imageElement.style.color = '#ff6b6b';
        this.imageElement.style.textAlign = 'center';
        this.imageElement.style.padding = '20px';
      };
    }
    
    // Set text fields
    this.workflowInput.value = data.workflow || '';
    this.nameInput.value = data.name || '';
    this.tagsTextarea.value = data.prompt || '';
    this.descriptionTextarea.value = data.description || 'No description available';
    this.seedInput.value = data.seed || 'Unknown';
    
    // Show the display
    this.baseElement.style.display = 'block';
    
    console.log('GeneratedImageDisplay data updated:', data);
  }
  
  /**
   * Blank out the display and hide it
   */
  blankDisplay() {
    // Clear image
    this.imageElement.src = '';
    this.imageElement.alt = '';
    this.imageElement.style.backgroundColor = '';
    this.imageElement.style.color = '';
    this.imageElement.style.textAlign = '';
    this.imageElement.style.padding = '';
    this.imageElement.style.cursor = '';
    this.imageElement.onclick = null;
    
    // Clear text fields
    this.workflowInput.value = '';
    this.nameInput.value = '';
    this.tagsTextarea.value = '';
    this.descriptionTextarea.value = '';
    this.seedInput.value = '';
    
    // Hide the display
    this.baseElement.style.display = 'none';
    
    console.log('GeneratedImageDisplay blanked');
  }
}
