// Carousel Container Component - Container for carousel display
import { Component } from 'preact';
import { html } from 'htm/preact';
import { CarouselDisplayComponent } from './carousel-display.js';

/**
 * CarouselContainerComponent - Wraps CarouselDisplayComponent with container structure
 */
export class CarouselContainerComponent extends Component {
  constructor(props) {
    super(props);
  }
  
  render() {
    const { 
      isVisible = false, 
      carouselData = [],
      dataDisplayComponent,
      onSelectionChange,
      ...otherProps 
    } = this.props;
    
    if (!isVisible || carouselData.length === 0) {
      return null;
    }
    
    return html`
      <div id="carouselDisplay" class="carousel-display" style="display: block;">
        <div class="carousel-controls">
          <${CarouselDisplayComponent}
            dataList=${carouselData}
            dataDisplayComponent=${dataDisplayComponent}
            onSelectionChange=${onSelectionChange}
            ...${otherProps}
          />
        </div>
      </div>
    `;
  }
}

export default CarouselContainerComponent;