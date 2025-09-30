// InpaintComponent - A reusable preact component for inpainting canvas
import { render, Component } from 'preact';
import { html } from 'htm/preact';

export class InpaintComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      imageLoaded: false,
      canvasSize: { width: 0, height: 0 }
    };
    
    // Bind methods
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    
    // Canvas reference
    this.canvas = null;
    this.currentImage = null;
  }
  
  componentDidMount() {
    this.loadImage();
  }
  
  componentDidUpdate(prevProps) {
    // Load image when imageUrl prop changes
    if (prevProps.imageUrl !== this.props.imageUrl) {
      this.loadImage();
    }
  }
  
  componentWillUnmount() {
    // Cleanup event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    // Cleanup image
    if (this.currentImage) {
      this.currentImage.onload = null;
      this.currentImage.onerror = null;
      this.currentImage = null;
    }
  }
  
  /**
   * Load image and resize canvas when imageUrl changes
   */
  loadImage() {
    const { imageUrl } = this.props;
    
    if (!imageUrl || !this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    
    // Cleanup previous image
    if (this.currentImage) {
      this.currentImage.onload = null;
      this.currentImage.onerror = null;
    }
    
    this.currentImage = new Image();

    this.currentImage.onload = () => {
      // Set canvas size to match image dimensions
      this.canvas.width = this.currentImage.naturalWidth;
      this.canvas.height = this.currentImage.naturalHeight;
      
      // Update state for styling
      this.setState({
        canvasSize: { 
          width: this.currentImage.naturalWidth, 
          height: this.currentImage.naturalHeight 
        },
        imageLoaded: true
      });
      
      // Draw the image onto the canvas
      ctx.drawImage(this.currentImage, 0, 0);
      
      console.log('Image loaded and drawn on canvas:', {
        width: this.currentImage.naturalWidth,
        height: this.currentImage.naturalHeight,
        url: imageUrl
      });
      
      // Set up canvas interactions after image loads
      this.setupCanvasInteractions();
    };

    this.currentImage.onerror = () => {
      console.error('Failed to load image:', imageUrl);
      this.setState({ imageLoaded: false });
    };

    // Start loading the image
    this.currentImage.src = imageUrl;
    this.setState({ imageLoaded: false });
  }
  
  /**
   * Set up canvas interaction event listeners for future inpainting functionality
   */
  setupCanvasInteractions() {
    if (!this.canvas || !this.state.imageLoaded) return;
    
    // Remove existing listeners to avoid duplicates
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    
    // Add event listeners
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
  }
  
  /**
   * Handle mouse down events on canvas
   */
  handleMouseDown(e) {
    console.log('Canvas mouse down at:', e.offsetX, e.offsetY);
    // Future: Start drawing/painting
  }
  
  /**
   * Handle mouse move events on canvas
   */
  handleMouseMove(e) {
    // Future: Continue drawing/painting if mouse is down
  }
  
  /**
   * Handle mouse up events on canvas
   */
  handleMouseUp(e) {
    console.log('Canvas mouse up at:', e.offsetX, e.offsetY);
    // Future: End drawing/painting
  }
  
  /**
   * Set canvas reference when element is created
   */
  setCanvasRef = (canvas) => {
    this.canvas = canvas;
    if (canvas && this.props.imageUrl) {
      // Load image when canvas ref is set and we have an imageUrl
      this.loadImage();
    }
  }

  render() {
    const { imageUrl } = this.props;
    const { imageLoaded, canvasSize } = this.state;
    
    return html`
      <div class="inpaint-canvas-container content-container">
        <h3>Inpaint Canvas</h3>
        ${!imageUrl && html`
          <div class="inpaint-placeholder">
            <p>No image loaded for inpainting</p>
          </div>
        `}
        ${imageUrl && !imageLoaded && html`
          <div class="inpaint-loading">
            <p>Loading image...</p>
          </div>
        `}
        <canvas 
          id="inpaint"
          ref=${this.setCanvasRef}
          class="inpaint-canvas ${imageLoaded ? 'loaded' : 'loading'}"
          style="display: ${imageUrl ? 'block' : 'none'}; max-width: 100%; height: auto;"
        />
        ${imageLoaded && html`
          <div class="inpaint-info">
            <p>Canvas size: ${canvasSize.width} x ${canvasSize.height}</p>
            <p>Click and drag to start painting (functionality coming soon)</p>
          </div>
        `}
      </div>
    `;
  }
}

// Helper function to render the component to a container
export function renderInpaintComponent(container, imageUrl) {
  render(html`<${InpaintComponent} imageUrl=${imageUrl} />`, container);
}