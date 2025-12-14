import { html } from 'htm/preact';
import { Button } from './button.mjs';

/**
 * Image Carousel Component
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of image objects or strings
 * @param {any} props.selectedItem - Currently selected item
 * @param {Function} props.onSelect - (item) => void
 * @param {Function} [props.onDelete] - (item) => void
 * @param {string} [props.height='150px']
 */
export function ImageCarousel({ 
  items = [], 
  selectedItem, 
  onSelect, 
  onDelete, 
  height = '150px',
  className = ''
}) {
  if (items.length === 0) {
    return html`
      <div class="carousel-display" style="text-align: center; color: var(--dark-text-secondary); padding: 20px;">
        No history items
      </div>
    `;
  }

  // Find index of selected item for navigation logic
  const selectedIndex = items.findIndex(item => 
    // Handle both object comparison and string comparison (legacy support)
    item === selectedItem || (item.url && selectedItem.url && item.url === selectedItem.url)
  );
  
  // Safe default if not found
  const currentIndex = selectedIndex === -1 ? 0 : selectedIndex;
  
  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelect(items[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      onSelect(items[currentIndex + 1]);
    }
  };

  return html`
    <div class="carousel-display ${className}">
      <div class="carousel-controls">
        <div class="carousel-nav">
          <${Button} 
            variant="icon-nav" 
            icon="chevron-left" 
            onClick=${handlePrev} 
            disabled=${currentIndex <= 0}
            title="Previous"
          />
          
          <div class="carousel-index">
            <span class="current-index">${currentIndex + 1}</span> / <span class="total-count">${items.length}</span>
          </div>
          
          <${Button} 
            variant="icon-nav" 
            icon="chevron-right" 
            onClick=${handleNext} 
            disabled=${currentIndex >= items.length - 1}
            title="Next"
          />
        </div>
      </div>
      
      ${/* Optional: Horizontal strip of thumbnails could go here if requested, but for now matching existing behavior */ null}
    </div>
  `;
}
