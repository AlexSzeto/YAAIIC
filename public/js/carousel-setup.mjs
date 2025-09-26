// Carousel Setup Module
import { createPagination } from './custom-ui/pagination.mjs';

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
      // Use setTimeout to ensure pagination component has updated its state
      setTimeout(() => {
        try {
          this.pagination.goToPage(targetPageIndex);
        } catch (error) {
          console.warn('Failed to navigate to target page:', targetPageIndex, error.message);
          // Reset selected item tracking if navigation fails
          this.selectedName = null;
          this.selectedTimestamp = null;
        }
      }, 0);
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
    this.dataList = newDataList;
    
    // Update pagination component with new data
    this.pagination.setDataList(this.dataList);
    
    // Move to the newly added item (last item) with validation
    const lastPageIndex = this.dataList.length - 1;
    if (lastPageIndex >= 0 && this.dataList.length > 0) {
      // Use setTimeout to ensure pagination component has updated its state
      setTimeout(() => {
        try {
          this.pagination.goToPage(lastPageIndex);
        } catch (error) {
          console.warn('Failed to navigate to last page:', error.message);
          // Fallback: try to go to last available page
          try {
            this.pagination.goToLastPage();
          } catch (fallbackError) {
            console.error('Failed to navigate to last page even with fallback:', fallbackError.message);
          }
        }
      }, 0);
    }
    
    // Update container visibility based on data availability
    if (this.dataList.length === 0) {
      this.baseElement.style.display = 'none';
    } else {
      this.baseElement.style.display = 'block';
    }
    
    console.log('CarouselDisplay data added, moved to index:', lastPageIndex);
  }
  
  /**
   * Remove an item from the list by its UID
   * @param {number} uid - The UID of the item to remove
   */
  removeItemByUid(uid) {
    if (!uid) return;
    
    // Find the item index by UID
    const itemIndex = this.dataList.findIndex(item => item.uid === uid);
    if (itemIndex === -1) {
      console.warn('CarouselDisplay: Item with UID not found for removal:', uid);
      return;
    }
    
    // Get current page before removing item
    const currentPageIndex = this.pagination.getState().currentPage;
    const isCurrentItem = (itemIndex === currentPageIndex);
    
    // Remove the item from the data list
    this.dataList = this.dataList.filter(item => item.uid !== uid);
    
    // Update pagination component with new data
    this.pagination.setDataList(this.dataList);
    
    // Handle navigation after removal
    if (this.dataList.length === 0) {
      // No items left - clear display
      this.selectedName = null;
      this.selectedTimestamp = null;
      this.dataDisplay.setData(null);
      this.baseElement.style.display = 'none';
    } else if (isCurrentItem) {
      // The current item was removed, navigate to appropriate item
      let targetPageIndex;
      
      if (itemIndex >= this.dataList.length) {
        // Removed item was the last one, move to the new last item
        targetPageIndex = this.dataList.length - 1;
      } else {
        // Move to the item that took the removed item's position
        targetPageIndex = itemIndex;
      }
      
      // Use setTimeout to ensure pagination component has updated its state
      setTimeout(() => {
        try {
          this.pagination.goToPage(targetPageIndex);
        } catch (error) {
          console.warn('Failed to navigate after removal:', error.message);
          // Fallback: go to first page
          try {
            this.pagination.goToPage(0);
          } catch (fallbackError) {
            console.error('Failed to navigate to first page after removal:', fallbackError.message);
          }
        }
      }, 0);
    }
    // If the removed item wasn't the current one, stay on current page
    // (pagination component will handle index adjustments automatically)
    
    console.log('CarouselDisplay item removed by UID:', uid, 'remaining items:', this.dataList.length);
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
