// Carousel Setup Module
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
    
    // Get references to the control elements
    this.prevButton = baseElement.querySelector('.carousel-prev');
    this.nextButton = baseElement.querySelector('.carousel-next');
    this.currentIndexElement = baseElement.querySelector('.current-index');
    this.totalCountElement = baseElement.querySelector('.total-count');
    
    // Validate that all required elements exist
    if (!this.prevButton || !this.nextButton || !this.currentIndexElement || !this.totalCountElement) {
      throw new Error('CarouselDisplay: Required control elements not found in baseElement');
    }
    
    // Internal state
    this.dataList = [];
    this.currentIndex = 0;
    this.selectedName = null;
    this.selectedTimestamp = null;
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial update
    this.updateDisplay();
    
    console.log('CarouselDisplay initialized successfully');
  }
  
  /**
   * Set up event listeners for carousel controls
   */
  setupEventListeners() {
    this.prevButton.addEventListener('click', () => {
      this.moveToPrevious();
    });
    
    this.nextButton.addEventListener('click', () => {
      this.moveToNext();
    });
  }
  
  /**
   * Set the data list for the carousel
   * @param {Array} dataList - Array of data objects
   */
  setData(dataList) {
    this.dataList = Array.isArray(dataList) ? dataList : [];
    
    // If we have a currently selected item, try to find it in the new list
    if (this.selectedName && this.selectedTimestamp) {
      const foundIndex = this.dataList.findIndex(item => 
        item.name === this.selectedName && item.timestamp === this.selectedTimestamp
      );
      
      if (foundIndex !== -1) {
        this.currentIndex = foundIndex;
      } else {
        this.currentIndex = 0;
        this.selectedName = null;
        this.selectedTimestamp = null;
      }
    } else {
      this.currentIndex = 0;
    }
    
    // Ensure currentIndex is within bounds
    if (this.currentIndex >= this.dataList.length) {
      this.currentIndex = Math.max(0, this.dataList.length - 1);
    }
    
    this.updateDisplay();
    this.updateDataDisplay();
    
    console.log('CarouselDisplay data set:', this.dataList.length, 'items, currentIndex:', this.currentIndex);
  }
  
  /**
   * Add a single data item to the end of the list
   * @param {Object} data - Data object to add
   */
  addData(data) {
    if (!data) return;
    
    const newDataList = [...this.dataList, data];
    this.setData(newDataList);
    
    // Move to the newly added item
    this.currentIndex = this.dataList.length - 1;
    this.updateDisplay();
    this.updateDataDisplay();
    
    console.log('CarouselDisplay data added, moved to index:', this.currentIndex);
  }
  
  /**
   * Move to the previous item
   */
  moveToPrevious() {
    if (this.dataList.length === 0) return;
    
    this.currentIndex = (this.currentIndex - 1 + this.dataList.length) % this.dataList.length;
    this.updateDisplay();
    this.updateDataDisplay();
    
    console.log('CarouselDisplay moved to previous, index:', this.currentIndex);
  }
  
  /**
   * Move to the next item
   */
  moveToNext() {
    if (this.dataList.length === 0) return;
    
    this.currentIndex = (this.currentIndex + 1) % this.dataList.length;
    this.updateDisplay();
    this.updateDataDisplay();
    
    console.log('CarouselDisplay moved to next, index:', this.currentIndex);
  }
  
  /**
   * Update the carousel display (index, buttons)
   */
  updateDisplay() {
    // Update index display
    if (this.dataList.length === 0) {
      this.currentIndexElement.textContent = '0';
      this.totalCountElement.textContent = '0';
      this.baseElement.style.display = 'none';
    } else {
      this.currentIndexElement.textContent = (this.currentIndex + 1).toString();
      this.totalCountElement.textContent = this.dataList.length.toString();
      this.baseElement.style.display = 'block';
    }
    
    // Update button states
    const hasItems = this.dataList.length > 0;
    const hasMultipleItems = this.dataList.length > 1;
    
    this.prevButton.disabled = !hasMultipleItems;
    this.nextButton.disabled = !hasMultipleItems;
    
    // Update selected item tracking
    if (hasItems && this.currentIndex < this.dataList.length) {
      const currentItem = this.dataList[this.currentIndex];
      this.selectedName = currentItem.name;
      this.selectedTimestamp = currentItem.timestamp;
    } else {
      this.selectedName = null;
      this.selectedTimestamp = null;
    }
  }
  
  /**
   * Update the data display with the current item
   */
  updateDataDisplay() {
    if (this.dataList.length === 0 || this.currentIndex >= this.dataList.length) {
      this.dataDisplay.setData(null);
    } else {
      const currentItem = this.dataList[this.currentIndex];
      this.dataDisplay.setData(currentItem);
    }
  }
  
  /**
   * Get the current data item
   * @returns {Object|null} Current data item or null if no items
   */
  getCurrentData() {
    if (this.dataList.length === 0 || this.currentIndex >= this.dataList.length) {
      return null;
    }
    return this.dataList[this.currentIndex];
  }
  
  /**
   * Get the current index
   * @returns {number} Current index
   */
  getCurrentIndex() {
    return this.currentIndex;
  }
  
  /**
   * Get the total count of items
   * @returns {number} Total count of items
   */
  getTotalCount() {
    return this.dataList.length;
  }
}
