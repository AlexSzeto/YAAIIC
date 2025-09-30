// InpaintComponent - A reusable preact component for inpainting canvas
import { render, Component } from 'preact';
import { html } from 'htm/preact';

export class InpaintComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      imageLoaded: false,
      canvasSize: { width: 0, height: 0 },
      inpaintArea: null,
      isDrawing: false
    };
    
    // Bind methods
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleRightClick = this.handleRightClick.bind(this);
    this.redrawCanvas = this.redrawCanvas.bind(this);
    
    // Canvas reference
    this.canvas = null;
    this.currentImage = null;
  }
  
  componentDidMount() {
    console.log('InpaintComponent mounted, imageUrl:', this.props.imageUrl);
    this.loadImage();
    
    // Add global mouse event handlers for dragging outside canvas
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }
  
  componentDidUpdate(prevProps) {
    // Load image when imageUrl prop changes
    if (prevProps.imageUrl !== this.props.imageUrl) {
      this.loadImage();
    }
  }
  
  componentWillUnmount() {
    // Cleanup global event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
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
    
    console.log('loadImage called with imageUrl:', imageUrl);
    
    if (!imageUrl) {
      console.log('No imageUrl provided, returning early');
      return;
    }
    
    // Cleanup previous image
    if (this.currentImage) {
      this.currentImage.onload = null;
      this.currentImage.onerror = null;
    }
    
    this.currentImage = new Image();

    this.currentImage.onload = () => {
      console.log('Image onload fired, setting imageLoaded to true');
      // Update state first to trigger re-render and show canvas
      this.setState({
        canvasSize: { 
          width: this.currentImage.naturalWidth, 
          height: this.currentImage.naturalHeight 
        },
        imageLoaded: true
      });
      
      console.log('Image loaded:', {
        width: this.currentImage.naturalWidth,
        height: this.currentImage.naturalHeight,
        url: imageUrl
      });
    };

    this.currentImage.onerror = () => {
      console.error('Failed to load image:', imageUrl);
      this.setState({ imageLoaded: false });
    };

    // Start loading the image
    console.log('Starting to load image from:', imageUrl);
    this.currentImage.src = imageUrl;
    this.setState({ imageLoaded: false });
  }
  
  /**
   * Set up canvas after image loads and canvas is rendered
   */
  setupCanvas() {
    const ctx = this.canvas.getContext('2d');
    
    // Set canvas size to match image dimensions
    this.canvas.width = this.currentImage.naturalWidth;
    this.canvas.height = this.currentImage.naturalHeight;
    
    // Draw the image onto the canvas
    ctx.drawImage(this.currentImage, 0, 0);
    
    // Initial redraw to set up the canvas
    this.redrawCanvas();
    
    console.log('Canvas set up and image drawn');
  }
  
  /**
   * Convert mouse coordinates to canvas coordinates
   */
  getCanvasCoordinates(e) {
    if (!this.canvas) return { x: 0, y: 0, isValid: false };
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    // Check if mouse is within canvas bounds
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const isValid = mouseX >= 0 && mouseY >= 0 && mouseX <= rect.width && mouseY <= rect.height;
    
    return {
      x: Math.max(0, Math.min(this.canvas.width, mouseX * scaleX)),
      y: Math.max(0, Math.min(this.canvas.height, mouseY * scaleY)),
      isValid
    };
  }
  
  /**
   * Redraw the canvas with image and inpaint area overlay
   */
  redrawCanvas() {
    if (!this.canvas || !this.currentImage || !this.state.imageLoaded) return;
    
    const ctx = this.canvas.getContext('2d');
    
    // Clear and draw the original image
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.currentImage, 0, 0);
    
    // Apply overlay if inpaint area is active
    if (this.state.inpaintArea) {
      const { x1, y1, x2, y2 } = this.state.inpaintArea;
      
      // Calculate rectangle bounds
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      
      // Save current canvas state
      ctx.save();
      
      // Create overlay everywhere except the inpaint area
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'black';
      
      // Draw overlay on top area
      if (top > 0) {
        ctx.fillRect(0, 0, this.canvas.width, top);
      }
      
      // Draw overlay on bottom area
      if (top + height < this.canvas.height) {
        ctx.fillRect(0, top + height, this.canvas.width, this.canvas.height - (top + height));
      }
      
      // Draw overlay on left area
      if (left > 0) {
        ctx.fillRect(0, top, left, height);
      }
      
      // Draw overlay on right area
      if (left + width < this.canvas.width) {
        ctx.fillRect(left + width, top, this.canvas.width - (left + width), height);
      }
      
      // Restore canvas state
      ctx.restore();
    }
  }
  
  /**
   * Handle mouse down events on canvas
   */
  handleMouseDown(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    const coords = this.getCanvasCoordinates(e);
    
    // Only start drawing if mouse is within canvas bounds
    if (!coords.isValid) return;
    
    console.log('Canvas mouse down at:', coords.x, coords.y);
    
    // Start area selection or restart if area already exists
    // Round coordinates to nearest pixel
    this.setState({
      inpaintArea: { 
        x1: Math.round(coords.x), 
        y1: Math.round(coords.y), 
        x2: Math.round(coords.x), 
        y2: Math.round(coords.y) 
      },
      isDrawing: true
    });
    
    // Prevent default to avoid any unwanted behaviors
    e.preventDefault();
  }
  
  /**
   * Handle mouse move events on canvas
   */
  handleMouseMove(e) {
    // Only continue if we're actively drawing
    if (!this.state.isDrawing || !this.state.inpaintArea) return;
    
    const coords = this.getCanvasCoordinates(e);
    
    // Update the second point of the inpaint area regardless of canvas bounds
    // This allows for selection extending outside canvas (coordinates will be clamped)
    // Round coordinates to nearest pixel
    this.setState(prevState => ({
      inpaintArea: {
        ...prevState.inpaintArea,
        x2: Math.round(coords.x),
        y2: Math.round(coords.y)
      }
    }), () => {
      // Redraw canvas with updated selection
      this.redrawCanvas();
    });
  }
  
  /**
   * Handle mouse up events on canvas
   */
  handleMouseUp(e) {
    // Only handle left mouse button and only if we're currently drawing
    if (e.button !== 0 || !this.state.isDrawing) return;
    
    const coords = this.getCanvasCoordinates(e);
    console.log('Canvas mouse up at:', coords.x, coords.y);
    
    // Stop area selection
    this.setState({ isDrawing: false });
    
    // Prevent default to avoid any unwanted behaviors
    e.preventDefault();
  }
  
  /**
   * Handle right click events on canvas
   */
  handleRightClick(e) {
    e.preventDefault(); // Prevent context menu
    
    console.log('Canvas right click - clearing inpaint area');
    
    // Reset inpaint area and redraw canvas
    this.setState({
      inpaintArea: null,
      isDrawing: false
    }, () => {
      this.redrawCanvas();
    });
  }
  
  /**
   * Set canvas reference when element is created
   */
  setCanvasRef = (canvas) => {
    console.log('setCanvasRef called, canvas:', !!canvas, 'imageLoaded:', this.state.imageLoaded);
    this.canvas = canvas;
    if (canvas && this.currentImage && this.state.imageLoaded) {
      console.log('setCanvasRef: calling setupCanvas');
      // Set up canvas if we have both canvas and loaded image
      this.setupCanvas();
    }
  }

  render() {
    const { imageUrl } = this.props;
    const { imageLoaded, canvasSize, inpaintArea } = this.state;
    
    console.log('InpaintComponent render - imageUrl:', imageUrl, 'imageLoaded:', imageLoaded);
    
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
        ${imageLoaded && html`
          <canvas 
            id="inpaint"
            ref=${this.setCanvasRef}
            class="inpaint-canvas loaded"
            style="max-width: 100%; height: auto; cursor: crosshair;"
            onMouseDown=${this.handleMouseDown}
            onMouseMove=${this.handleMouseMove}
            onMouseUp=${this.handleMouseUp}
            onContextMenu=${this.handleRightClick}
          />
        `}
        ${imageLoaded && html`
          <div class="inpaint-info">
            <p>Canvas size: ${canvasSize.width} x ${canvasSize.height}</p>
            ${inpaintArea ? html`
              <p>Inpaint area: (${Math.min(inpaintArea.x1, inpaintArea.x2)}, ${Math.min(inpaintArea.y1, inpaintArea.y2)}) to (${Math.max(inpaintArea.x1, inpaintArea.x2)}, ${Math.max(inpaintArea.y1, inpaintArea.y2)})</p>
            ` : html`
              <p>Left click and drag to select inpaint area, right click to clear selection</p>
            `}
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