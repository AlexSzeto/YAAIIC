import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { H2 } from '../custom-ui/typography.mjs';
import { getThemeValue } from '../custom-ui/theme.mjs';

// Styled components
const CanvasContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${getThemeValue('spacing.medium.gap')};
  width: 100%;
`;

const PlaceholderContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${getThemeValue('spacing.large.padding')};
  background: ${getThemeValue('colors.background.secondary')};
  border: ${getThemeValue('border.width')} ${getThemeValue('border.style')} ${getThemeValue('colors.border.primary')};
  border-radius: ${getThemeValue('spacing.medium.borderRadius')};
  color: ${getThemeValue('colors.text.secondary')};
`;

const LoadingContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${getThemeValue('spacing.large.padding')};
  background: ${getThemeValue('colors.background.secondary')};
  border: ${getThemeValue('border.width')} ${getThemeValue('border.style')} ${getThemeValue('colors.border.primary')};
  border-radius: ${getThemeValue('spacing.medium.borderRadius')};
  color: ${getThemeValue('colors.text.secondary')};
`;

const Canvas = styled('canvas')`
  max-width: 100%;
  height: auto;
  cursor: crosshair;
  border-radius: ${getThemeValue('spacing.small.borderRadius')};
`;

const InfoContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${getThemeValue('spacing.small.gap')};
  color: ${getThemeValue('colors.text.secondary')};
  font-size: ${getThemeValue('typography.fontSize.small')};

  p {
    margin: 0;
  }
`;

/**
 * InpaintCanvas Component
 * 
 * @param {Object} props
 * @param {string} props.imageUrl - URL of the image to display
 * @param {Object|null} props.inpaintArea - Current inpaint area { x1, y1, x2, y2 }
 * @param {Function} props.onChangeInpaintArea - Callback when inpaint area changes
 */
export function InpaintCanvas({ imageUrl, inpaintArea, onChangeInpaintArea }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const drawingStartRef = useRef(null);
  
  // Load image when imageUrl changes
  useEffect(() => {
    if (!imageUrl) {
      setImageLoaded(false);
      return;
    }
    
    console.log('InpaintCanvas: Loading image from', imageUrl);
    setImageLoaded(false);
    
    // Cleanup previous image
    if (imageRef.current) {
      imageRef.current.onload = null;
      imageRef.current.onerror = null;
    }
    
    const img = new Image();
    imageRef.current = img;
    
    img.onload = () => {
      console.log('InpaintCanvas: Image loaded', img.naturalWidth, 'x', img.naturalHeight);
      setCanvasSize({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
      setImageLoaded(true);
    };
    
    img.onerror = () => {
      console.error('InpaintCanvas: Failed to load image', imageUrl);
      setImageLoaded(false);
    };
    
    img.src = imageUrl;
    
    return () => {
      if (imageRef.current) {
        imageRef.current.onload = null;
        imageRef.current.onerror = null;
      }
    };
  }, [imageUrl]);
  
  // Setup canvas and draw when image loads or inpaintArea changes
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;
    
    // Goober styled components: access DOM element via .base property
    const canvas = canvasRef.current.base || canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    // Draw the image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);
    
    // Draw overlay if inpaint area is defined
    if (inpaintArea) {
      const { x1, y1, x2, y2 } = inpaintArea;
      
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
        ctx.fillRect(0, 0, canvas.width, top);
      }
      
      // Draw overlay on bottom area
      if (top + height < canvas.height) {
        ctx.fillRect(0, top + height, canvas.width, canvas.height - (top + height));
      }
      
      // Draw overlay on left area
      if (left > 0) {
        ctx.fillRect(0, top, left, height);
      }
      
      // Draw overlay on right area
      if (left + width < canvas.width) {
        ctx.fillRect(left + width, top, canvas.width - (left + width), height);
      }
      
      // Restore canvas state
      ctx.restore();
    }
  }, [imageLoaded, canvasSize, inpaintArea]);
  
  // Convert mouse coordinates to canvas coordinates
  const getCanvasCoordinates = useCallback((e) => {
    if (!canvasRef.current) return { x: 0, y: 0, isValid: false };
    
    // Goober styled components: access DOM element via .base property
    const canvas = canvasRef.current.base || canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Check if mouse is within canvas bounds
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const isValid = mouseX >= 0 && mouseY >= 0 && mouseX <= rect.width && mouseY <= rect.height;
    
    return {
      x: Math.max(0, Math.min(canvas.width, mouseX * scaleX)),
      y: Math.max(0, Math.min(canvas.height, mouseY * scaleY)),
      isValid
    };
  }, []);
  
  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    const coords = getCanvasCoordinates(e);
    if (!coords.isValid) return;
    
    console.log('InpaintCanvas: Mouse down at', coords.x, coords.y);
    
    // Start area selection
    const startPoint = {
      x1: Math.round(coords.x),
      y1: Math.round(coords.y),
      x2: Math.round(coords.x),
      y2: Math.round(coords.y)
    };
    
    drawingStartRef.current = startPoint;
    setIsDrawing(true);
    onChangeInpaintArea?.(startPoint);
    
    e.preventDefault();
  }, [getCanvasCoordinates, onChangeInpaintArea]);
  
  const handleMouseMove = useCallback((e) => {
    if (!isDrawing || !drawingStartRef.current) return;
    
    const coords = getCanvasCoordinates(e);
    
    // Update the inpaint area
    const newArea = {
      x1: drawingStartRef.current.x1,
      y1: drawingStartRef.current.y1,
      x2: Math.round(coords.x),
      y2: Math.round(coords.y)
    };
    
    onChangeInpaintArea?.(newArea);
  }, [isDrawing, getCanvasCoordinates, onChangeInpaintArea]);
  
  const handleMouseUp = useCallback((e) => {
    if (e.button !== 0 || !isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    console.log('InpaintCanvas: Mouse up at', coords.x, coords.y);
    
    // Check if the area has zero size
    if (inpaintArea && 
        (inpaintArea.x1 === inpaintArea.x2 || inpaintArea.y1 === inpaintArea.y2)) {
      console.log('InpaintCanvas: Inpaint area has zero size, clearing');
      onChangeInpaintArea?.(null);
    }
    
    setIsDrawing(false);
    drawingStartRef.current = null;
    e.preventDefault();
  }, [isDrawing, getCanvasCoordinates, inpaintArea, onChangeInpaintArea]);
  
  const handleRightClick = useCallback((e) => {
    e.preventDefault();
    console.log('InpaintCanvas: Right click - clearing inpaint area');
    
    onChangeInpaintArea?.(null);
    setIsDrawing(false);
    drawingStartRef.current = null;
  }, [onChangeInpaintArea]);
  
  // Global mouse event handlers for dragging outside canvas
  useEffect(() => {
    if (!isDrawing) return;
    
    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = (e) => handleMouseUp(e);
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDrawing, handleMouseMove, handleMouseUp]);
  
  // Format inpaint area for display
  const getInpaintAreaDisplay = () => {
    if (!inpaintArea) return null;
    const left = Math.min(inpaintArea.x1, inpaintArea.x2);
    const top = Math.min(inpaintArea.y1, inpaintArea.y2);
    const right = Math.max(inpaintArea.x1, inpaintArea.x2);
    const bottom = Math.max(inpaintArea.y1, inpaintArea.y2);
    return `(${left}, ${top}) to (${right}, ${bottom})`;
  };
  
  return html`
    <${CanvasContainer}>
      <${H2}>Inpaint Canvas</>
      ${!imageUrl && html`
        <${PlaceholderContainer}>
          <p>No image loaded for inpainting</p>
        <//>
      `}
      ${imageUrl && !imageLoaded && html`
        <${LoadingContainer}>
          <p>Loading image...</p>
        <//>
      `}
      ${imageLoaded && html`
        <${Canvas}
          id="inpaint"
          ref=${canvasRef}
          onMouseDown=${handleMouseDown}
          onContextMenu=${handleRightClick}
        />
      `}
      ${imageLoaded && html`
        <${InfoContainer}>
          <p>Canvas size: ${canvasSize.width} x ${canvasSize.height}</p>
          ${inpaintArea ? html`
            <p>Inpaint area: ${getInpaintAreaDisplay()}</p>
          ` : html`
            <p>Left click and drag to select inpaint area, right click to clear selection</p>
          `}
        <//>
      `}
    <//>
  `;
}
