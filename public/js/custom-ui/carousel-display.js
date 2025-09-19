import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createPagination } from './pagination.js'

/**
 * Pure Preact component for carousel display functionality
 * Replaces the imperative CarouselDisplay class
 */
export class CarouselDisplayComponent extends Component {
  constructor(props) {
    super(props);
    
    // Validate props
    if (props.dataList && !Array.isArray(props.dataList)) {
      throw new Error('dataList must be an array');
    }
    
    if (!props.dataDisplayComponent) {
      throw new Error('dataDisplayComponent is required');
    }
    
    if (props.onSelectionChange && typeof props.onSelectionChange !== 'function') {
      throw new Error('onSelectionChange must be a function');
    }
    
    // Initialize state
    this.state = {
      dataList: props.dataList || [],
      currentIndex: 0,
      selectedItem: null,
      isVisible: false
    };
    
    // Pagination component reference
    this.pagination = null;
    
    console.log('CarouselDisplayComponent initialized');
  }
  
  componentDidMount() {
    // Set up initial state
    this.updateSelectedItem();
    console.log('CarouselDisplayComponent mounted');
  }
  
  componentDidUpdate(prevProps, prevState) {
    // Handle dataList prop changes
    if (prevProps.dataList !== this.props.dataList) {
      const newDataList = this.props.dataList || [];
      let targetIndex = 0;
      
      // If we have a currently selected item, try to find it in the new list
      if (this.state.selectedItem) {
        const foundIndex = newDataList.findIndex(item => 
          item.name === this.state.selectedItem.name && 
          item.timestamp === this.state.selectedItem.timestamp
        );
        
        if (foundIndex !== -1) {
          targetIndex = foundIndex;
        }
      }
      
      this.setState({
        dataList: newDataList,
        currentIndex: Math.min(targetIndex, Math.max(0, newDataList.length - 1)),
        isVisible: newDataList.length > 0
      });
      
      // Update pagination component with new data
      if (this.pagination) {
        this.pagination.setDataList(newDataList);
        if (targetIndex > 0 && targetIndex < newDataList.length) {
          this.pagination.goToPage(targetIndex);
        }
      }
    }
    
    // Handle currentIndex state changes
    if (prevState.currentIndex !== this.state.currentIndex || 
        prevState.dataList !== this.state.dataList) {
      this.updateSelectedItem();
    }
  }
  
  componentWillUnmount() {
    // Clean up pagination component
    if (this.pagination) {
      this.pagination.destroy();
      this.pagination = null;
    }
    console.log('CarouselDisplayComponent unmounted');
  }
  
  /**
   * Update the selected item based on current index
   */
  updateSelectedItem() {
    const { dataList, currentIndex } = this.state;
    const selectedItem = dataList.length > 0 && currentIndex >= 0 && currentIndex < dataList.length
      ? dataList[currentIndex]
      : null;
    
    this.setState({ selectedItem });
    
    // Notify parent of selection change
    if (this.props.onSelectionChange) {
      this.props.onSelectionChange(selectedItem, currentIndex);
    }
    
    console.log('CarouselDisplay selection updated:', {
      currentIndex,
      selectedItem: selectedItem ? selectedItem.name : 'none'
    });
  }
  
  /**
   * Handle pagination component updates
   */
  handlePaginationUpdate = (currentPageData) => {
    // For carousel (itemsPerPage = 1), currentPageData will have 0 or 1 item
    const paginationState = this.pagination ? this.pagination.getState() : { currentPage: 0 };
    const newIndex = paginationState.currentPage;
    
    if (newIndex !== this.state.currentIndex) {
      this.setState({ currentIndex: newIndex });
    }
  }
  
  /**
   * Set up pagination component when container is available
   */
  setupPagination = (container) => {
    if (container && !this.pagination) {
      // Create pagination component with 1 item per page for carousel behavior
      this.pagination = createPagination(
        container,
        this.state.dataList,
        1, // itemsPerPage = 1 for carousel
        this.handlePaginationUpdate
      );
      
      console.log('CarouselDisplay pagination component initialized');
    }
  }
  
  /**
   * Add a single data item to the end of the list (for compatibility)
   */
  addDataItem(data) {
    if (!data) return;
    
    const newDataList = [...this.state.dataList, data];
    const newIndex = newDataList.length - 1;
    
    this.setState({
      dataList: newDataList,
      currentIndex: newIndex,
      isVisible: true
    });
    
    // Update pagination component
    if (this.pagination) {
      this.pagination.setDataList(newDataList);
      this.pagination.goToPage(newIndex);
    }
    
    console.log('CarouselDisplay data item added, moved to index:', newIndex);
  }
  
  /**
   * Move to the previous item
   */
  moveToPrevious() {
    if (this.pagination) {
      this.pagination.goToPreviousPage();
    }
  }
  
  /**
   * Move to the next item
   */
  moveToNext() {
    if (this.pagination) {
      this.pagination.goToNextPage();
    }
  }
  
  /**
   * Get the current data item
   */
  getCurrentData() {
    return this.state.selectedItem;
  }
  
  /**
   * Get the current index
   */
  getCurrentIndex() {
    return this.state.currentIndex;
  }
  
  /**
   * Get the total count of items
   */
  getTotalCount() {
    return this.state.dataList.length;
  }
  
  render() {
    const { dataDisplayComponent: DataDisplayComponent } = this.props;
    const { selectedItem, isVisible } = this.state;
    
    return html`
      <div 
        class="carousel-display"
        style=${{ display: isVisible ? 'block' : 'none' }}
      >
        <div class="carousel-content">
          <${DataDisplayComponent} 
            imageData=${selectedItem}
            onUseField=${this.props.onUseField}
          />
        </div>
        <div class="carousel-controls">
          <div 
            id="carouselPagination"
            ref=${this.setupPagination}
          ></div>
        </div>
      </div>
    `;
  }
}

/**
 * Factory function for backward compatibility
 * Creates and renders a CarouselDisplayComponent
 * @param {HTMLElement} container - Container element to render into
 * @param {Component|Object} dataDisplayComponent - Preact component or component instance for data display
 * @param {Function} onSelectionChange - Event handler for selection changes
 * @returns {Object} API object with methods to control the component
 */
export function createCarouselDisplay(container, dataDisplayComponent, onSelectionChange = null) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('container must be a valid HTML element');
  }
  
  if (!dataDisplayComponent) {
    throw new Error('dataDisplayComponent is required');
  }
  
  let componentRef = null;
  let currentDataList = [];
  
  // If dataDisplayComponent is a class instance, we need to create a wrapper component
  let DataDisplayComponent;
  if (typeof dataDisplayComponent === 'object' && dataDisplayComponent.setData) {
    // Legacy instance - create a wrapper component
    DataDisplayComponent = ({ imageData, onUseField }) => {
      // Update the legacy instance
      if (dataDisplayComponent.setData) {
        dataDisplayComponent.setData(imageData);
      }
      
      // Return empty div since the legacy instance manages its own DOM
      return html`<div></div>`;
    };
  } else if (typeof dataDisplayComponent === 'function') {
    // Pure function or Preact component
    DataDisplayComponent = dataDisplayComponent;
  } else {
    throw new Error('dataDisplayComponent must be a Preact component or legacy instance');
  }
  
  // Initial render
  const renderComponent = (dataList = []) => {
    render(
      html`<${CarouselDisplayComponent} 
        dataList=${dataList}
        dataDisplayComponent=${DataDisplayComponent}
        onSelectionChange=${onSelectionChange}
        onUseField=${container.onUseField}
        ref=${(ref) => { componentRef = ref; }}
      />`, 
      container
    );
  };
  
  // Initial render with empty data
  renderComponent([]);
  
  // Return API object that mimics the original CarouselDisplay class
  return {
    /**
     * Set the data list for the carousel
     * @param {Array} dataList - Array of data objects
     */
    setData(dataList) {
      currentDataList = Array.isArray(dataList) ? dataList : [];
      renderComponent(currentDataList);
    },
    
    /**
     * Add a single data item to the end of the list
     * @param {Object} data - Data object to add
     */
    addData(data) {
      if (!data) return;
      
      currentDataList = [...currentDataList, data];
      renderComponent(currentDataList);
      
      // Directly call the component method to move to the new item
      if (componentRef && componentRef.addDataItem) {
        componentRef.addDataItem(data);
      }
    },
    
    /**
     * Move to the previous item
     */
    moveToPrevious() {
      if (componentRef && componentRef.moveToPrevious) {
        componentRef.moveToPrevious();
      }
    },
    
    /**
     * Move to the next item
     */
    moveToNext() {
      if (componentRef && componentRef.moveToNext) {
        componentRef.moveToNext();
      }
    },
    
    /**
     * Get the current data item
     */
    getCurrentData() {
      return componentRef && componentRef.getCurrentData ? componentRef.getCurrentData() : null;
    },
    
    /**
     * Get the current index
     */
    getCurrentIndex() {
      return componentRef && componentRef.getCurrentIndex ? componentRef.getCurrentIndex() : 0;
    },
    
    /**
     * Get the total count of items
     */
    getTotalCount() {
      return componentRef && componentRef.getTotalCount ? componentRef.getTotalCount() : 0;
    },
    
    /**
     * Update the data display (for backward compatibility)
     */
    updateDataDisplay() {
      // No-op - Preact handles updates automatically
    },
    
    /**
     * Update the carousel display (for backward compatibility)
     */
    updateDisplay() {
      // No-op - Preact handles updates automatically
    },
    
    /**
     * Destroy the component and clean up
     */
    destroy() {
      if (container && container.firstChild) {
        render(null, container);
      }
      componentRef = null;
      currentDataList = [];
      console.log('CarouselDisplayComponent destroyed');
    }
  };
}