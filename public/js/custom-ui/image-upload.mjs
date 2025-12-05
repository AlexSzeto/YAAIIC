import { Component } from 'preact';
import { html } from 'htm/preact';

/**
 * ImageUpload Component
 * A reusable component that displays a blank square with a plus icon for image upload.
 * When an image is selected, it shows a preview of the image.
 */
export class ImageUpload extends Component {
  constructor(props) {
    super(props);
    // props:
    // - id: string/number (unique identifier)
    // - onImageChange: (file) => void
    // - onGalleryRequest: () => void
    this.state = {
      imagePreview: null,
      hasImage: false,
      imageFile: null
    };
    
    this.fileInputRef = null;
  }

  /**
   * Public method to set image externally (e.g. from gallery)
   * @param {Blob} blob - The image blob
   * @param {string} url - The image URL for preview
   */
  setImage(blob, url) {
    this.setState({
      imagePreview: url,
      hasImage: true,
      imageFile: blob
    });
    
    // Notify parent of the change
    if (this.props.onImageChange) {
      this.props.onImageChange(blob);
    }
  }

  /**
   * Clear the current image
   */
  clearImage() {
    this.setState({
      imagePreview: null,
      hasImage: false,
      imageFile: null
    });
    
    // Reset file input
    if (this.fileInputRef) {
      this.fileInputRef.value = '';
    }
    
    // Notify parent of the change
    if (this.props.onImageChange) {
      this.props.onImageChange(null);
    }
  }

  /**
   * Handle file input change
   */
  handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Selected file is not an image');
      return;
    }
    
    // Read file and update state
    const reader = new FileReader();
    reader.onload = (event) => {
      this.setState({
        imagePreview: event.target.result,
        hasImage: true,
        imageFile: file
      });
      
      // Notify parent of the change
      if (this.props.onImageChange) {
        this.props.onImageChange(file);
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Handle click on the upload area
   */
  handleUploadClick = () => {
    if (this.fileInputRef) {
      this.fileInputRef.click();
    }
  }

  /**
   * Handle gallery button click
   */
  handleGalleryClick = (e) => {
    e.stopPropagation();
    if (this.props.onGalleryRequest) {
      this.props.onGalleryRequest();
    }
  }

  /**
   * Handle clear button click
   */
  handleClearClick = (e) => {
    e.stopPropagation();
    this.clearImage();
  }

  /**
   * Get the image file/blob
   */
  getImageBlob() {
    return this.state.imageFile;
  }

  /**
   * Check if component has an image
   */
  hasImage() {
    return this.state.hasImage;
  }

  render() {
    const { id } = this.props;
    const { imagePreview, hasImage } = this.state;

    return html`
      <div class="image-upload-component">
        <input
          type="file"
          ref=${(el) => this.fileInputRef = el}
          accept="image/*"
          style="display: none;"
          onChange=${this.handleFileSelect}
        />
        
        <div 
          class="image-upload-area ${hasImage ? 'has-image' : ''}"
          onClick=${hasImage ? this.handleUploadClick : this.handleGalleryClick}
        >
          ${hasImage ? html`
            <!-- Image Preview -->
            <img 
              src=${imagePreview} 
              alt="Upload preview" 
              class="image-upload-preview"
            />
            
            <!-- Overlay Buttons -->
            <div class="image-upload-overlay">
              <button 
                class="image-upload-btn image-upload-clear-btn"
                onClick=${this.handleClearClick}
                title="Clear image"
              >
                <box-icon name='x' color='#ffffff' size='20px'></box-icon>
              </button>
              <button 
                class="image-upload-btn image-upload-gallery-btn"
                onClick=${this.handleGalleryClick}
                title="Select from gallery"
              >
                <box-icon name='image' color='#ffffff' size='20px'></box-icon>
              </button>
            </div>
          ` : html`
            <!-- Empty State -->
            <div class="image-upload-empty">
              <box-icon name='image' color='#888888' size='48px'></box-icon>
              <div class="image-upload-text">Select Image</div>
              <button 
                class="image-upload-btn image-upload-gallery-btn-empty"
                onClick=${this.handleUploadClick}
                title="Upload from device"
              >
                <box-icon name='upload' color='#ffffff' size='16px'></box-icon>
                Upload
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
