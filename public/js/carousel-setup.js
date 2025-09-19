// Carousel Setup Module
import { createPagination } from './custom-ui/pagination.js';

export class CarouselDisplay {
  constructor(baseElement, dataDisplay) {
    if (!baseElement) {
      throw new Error('BaseElement is required for CarouselDisplay');
    }
    
    if (!dataDisplay) {
      throw new Error('DataDisplay is required for CarouselDisplay');
    }
    
    this.baseElement = baseElement;
    this.dataDisplay = dataDisplay;
    
    // Find the carousel controls container
    const carouselControls = baseElement.querySelector('.carousel-controls');
    if (!carouselControls) {
      throw new Error('CarouselDisplay: .carousel-controls container not found in baseElement');
    }
    
    // Find or create pagination container
    let paginationContainer = carouselControls.querySelector('#carouselPagination');
    if (!paginationContainer) {
      // Create pagination container if it doesn't exist
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'carouselPagination';
      carouselControls.appendChild(paginationContainer);
    }
    
    // Internal state
    this.dataList = [];
    this.selectedName = null;
    this.selectedTimestamp = null;
    
    // Initialize pagination component
    this.pagination = createPagination(
      paginationContainer,
      this.dataList,
      1, // itemsPerPage = 1 for carousel behavior
      (currentPageData) => this.handlePaginationUpdate(currentPageData)
    );
    
    // Initial state - hide container when no data
    this.baseElement.style.display = 'none';
    
    console.log('CarouselDisplay initialized successfully');
  }
  
  /**
   * Handle pagination component updates
   * @param {Array} currentPageData - Current page data from pagination component
   */
  handlePaginationUpdate(currentPageData) {
    // For carousel (itemsPerPage = 1), currentPageData will have 0 or 1 item
    const currentItem = currentPageData.length > 0 ? currentPageData[0] : null;
    
    // Update selected item tracking
    if (currentItem) {
      this.selectedName = currentItem.name;
      this.selectedTimestamp = currentItem.timestamp;
    } else {
      this.selectedName = null;
      this.selectedTimestamp = null;
    }
    
    // Update data display
    this.dataDisplay.setData(currentItem);
    
    // Update container visibility based on data availability
    if (this.dataList.length === 0) {
      this.baseElement.style.display = 'none';
    } else {
      this.baseElement.style.display = 'block';
    }
    
    console.log('CarouselDisplay pagination updated:', {
      currentItem: currentItem ? currentItem.name : 'none',
      selectedName: this.selectedName,
      selectedTimestamp: this.selectedTimestamp,
      containerVisible: this.dataList.length > 0
    });
  }
  
  
  /**
   * Set the data list for the carousel
   * @param {Array} dataList - Array of data objects
   */
  setData(dataList) {
    this.dataList = Array.isArray(dataList) ? dataList : [];
    
    // If we have a currently selected item, try to find it in the new list
    let targetPageIndex = 0;
    if (this.selectedName && this.selectedTimestamp) {
      const foundIndex = this.dataList.findIndex(item => 
        item.name === this.selectedName && item.timestamp === this.selectedTimestamp
      );
      
      if (foundIndex !== -1) {
        targetPageIndex = foundIndex; // For carousel, page index = item index
      } else {
        this.selectedName = null;
        this.selectedTimestamp = null;
      }
    }
    
    // Update pagination component with new data
    this.pagination.setDataList(this.dataList);
    
    // Navigate to target page if needed
    if (targetPageIndex > 0 && targetPageIndex < this.dataList.length) {
      this.pagination.goToPage(targetPageIndex);
    }
    
    // Update container visibility based on data availability
    if (this.dataList.length === 0) {
      this.baseElement.style.display = 'none';
    } else {
      this.baseElement.style.display = 'block';
    }
    
    console.log('CarouselDisplay data set:', this.dataList.length, 'items, targetPage:', targetPageIndex);
  }
  
  /**
   * Add a single data item to the end of the list
   * @param {Object} data - Data object to add
   */
  addData(data) {
    if (!data) return;
    
    const newDataList = [...this.dataList, data];
    this.setData(newDataList);
    
    // Move to the newly added item (last item)
    const lastPageIndex = this.dataList.length - 1;
    this.pagination.goToPage(lastPageIndex);
    
    console.log('CarouselDisplay data added, moved to index:', lastPageIndex);
  }
  
  /**
   * Move to the previous item
   */
  moveToPrevious() {
    this.pagination.goToPreviousPage();
    console.log('CarouselDisplay moved to previous');
  }
  
  /**
   * Move to the next item
   */
  moveToNext() {
    this.pagination.goToNextPage();
    console.log('CarouselDisplay moved to next');
  }
  
  /**
   * Update the data display with the current item (for backward compatibility)
   */
  updateDataDisplay() {
    // The pagination component handles data display updates via handlePaginationUpdate
    // This method is kept for backward compatibility but doesn't need to do anything
  }
  
  /**
   * Update the carousel display (for backward compatibility)
   */
  updateDisplay() {
    // The pagination component handles display updates
    // This method is kept for backward compatibility but doesn't need to do anything
  }
  
  /**
   * Get the current data item
   * @returns {Object|null} Current data item or null if no items
   */
  getCurrentData() {
    const currentPageData = this.pagination.getCurrentPageData();
    return currentPageData.length > 0 ? currentPageData[0] : null;
  }
  
  /**
   * Get the current index
   * @returns {number} Current index
   */
  getCurrentIndex() {
    return this.pagination.getState().currentPage;
  }
  
  /**
   * Get the total count of items
   * @returns {number} Total count of items
   */
  getTotalCount() {
    return this.dataList.length;
  }
}
