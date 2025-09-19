/**
 * Carousel-style Pagination Component
 * Provides carousel-style pagination with prev/next buttons and current/total index display
 */
export class PaginationComponent {
  constructor(dataList = [], itemsPerPage = 1, updateDisplay = null) {
    // Validate parameters
    if (!Array.isArray(dataList)) {
      throw new Error('dataList must be an array');
    }
    
    if (typeof itemsPerPage !== 'number' || itemsPerPage < 1) {
      throw new Error('itemsPerPage must be a positive number');
    }
    
    if (updateDisplay && typeof updateDisplay !== 'function') {
      throw new Error('updateDisplay must be a function or null');
    }
    
    // Initialize properties
    this.dataList = [...dataList];
    this.itemsPerPage = itemsPerPage;
    this.updateDisplay = updateDisplay;
    
    // Internal state
    this.currentPage = 0;
    this.totalPages = Math.max(1, Math.ceil(this.dataList.length / this.itemsPerPage));
    
    // Create DOM elements
    this.container = this.createContainer();
    this.prevButton = this.container.querySelector('.pagination-prev');
    this.nextButton = this.container.querySelector('.pagination-next');
    this.currentPageElement = this.container.querySelector('.current-page');
    this.totalPagesElement = this.container.querySelector('.total-pages');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initial update
    this.updateUI();
    this.triggerUpdateDisplay();
    
    console.log('PaginationComponent initialized:', {
      dataLength: this.dataList.length,
      itemsPerPage: this.itemsPerPage,
      totalPages: this.totalPages
    });
  }
  
  /**
   * Create the pagination container DOM structure
   * @returns {HTMLElement} The pagination container element
   */
  createContainer() {
    const container = document.createElement('div');
    container.className = 'pagination-container';
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Pagination navigation');
    
    container.innerHTML = `
      <div class="carousel-nav">
        <button class="carousel-btn pagination-prev" title="Previous page" aria-label="Go to previous page">
          <box-icon name='caret-left' color='#ffffff'></box-icon>
        </button>
        <div class="carousel-index pagination-index" aria-live="polite">
          <span class="current-page">1</span> / <span class="total-pages">1</span>
        </div>
        <button class="carousel-btn pagination-next" title="Next page" aria-label="Go to next page">
          <box-icon name='caret-right' color='#ffffff'></box-icon>
        </button>
      </div>
    `;
    
    return container;
  }
  
  /**
   * Set up event listeners for pagination controls
   */
  setupEventListeners() {
    // Previous button click
    this.prevButton.addEventListener('click', () => {
      this.goToPreviousPage();
    });
    
    // Next button click
    this.nextButton.addEventListener('click', () => {
      this.goToNextPage();
    });
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.goToPreviousPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.goToNextPage();
          break;
        case 'Home':
          e.preventDefault();
          this.goToFirstPage();
          break;
        case 'End':
          e.preventDefault();
          this.goToLastPage();
          break;
      }
    });
    
    // Make container focusable for keyboard navigation
    this.container.setAttribute('tabindex', '0');
  }
  
  /**
   * Update the data list and recalculate pagination
   * @param {Array} newDataList - New array of data
   */
  setDataList(newDataList) {
    if (!Array.isArray(newDataList)) {
      throw new Error('newDataList must be an array');
    }
    
    this.dataList = [...newDataList];
    this.totalPages = Math.max(1, Math.ceil(this.dataList.length / this.itemsPerPage));
    
    // Reset to first page if current page is beyond new total
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }
    
    this.updateUI();
    this.triggerUpdateDisplay();
    
    console.log('PaginationComponent data updated:', {
      dataLength: this.dataList.length,
      totalPages: this.totalPages,
      currentPage: this.currentPage
    });
  }
  
  /**
   * Set items per page and recalculate pagination
   * @param {number} newItemsPerPage - Number of items per page
   */
  setItemsPerPage(newItemsPerPage) {
    if (typeof newItemsPerPage !== 'number' || newItemsPerPage < 1) {
      throw new Error('newItemsPerPage must be a positive number');
    }
    
    this.itemsPerPage = newItemsPerPage;
    this.totalPages = Math.max(1, Math.ceil(this.dataList.length / this.itemsPerPage));
    
    // Reset to first page if current page is beyond new total
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }
    
    this.updateUI();
    this.triggerUpdateDisplay();
  }
  
  /**
   * Set the update display callback function
   * @param {Function} callback - Function to call with current page data
   */
  setUpdateDisplay(callback) {
    if (callback && typeof callback !== 'function') {
      throw new Error('callback must be a function or null');
    }
    
    this.updateDisplay = callback;
    this.triggerUpdateDisplay();
  }
  
  /**
   * Go to the previous page
   */
  goToPreviousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updateUI();
      this.triggerUpdateDisplay();
    }
  }
  
  /**
   * Go to the next page
   */
  goToNextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updateUI();
      this.triggerUpdateDisplay();
    }
  }
  
  /**
   * Go to the first page
   */
  goToFirstPage() {
    if (this.currentPage !== 0) {
      this.currentPage = 0;
      this.updateUI();
      this.triggerUpdateDisplay();
    }
  }
  
  /**
   * Go to the last page
   */
  goToLastPage() {
    const lastPage = this.totalPages - 1;
    if (this.currentPage !== lastPage) {
      this.currentPage = lastPage;
      this.updateUI();
      this.triggerUpdateDisplay();
    }
  }
  
  /**
   * Go to a specific page
   * @param {number} pageIndex - Zero-based page index
   */
  goToPage(pageIndex) {
    if (typeof pageIndex !== 'number' || pageIndex < 0 || pageIndex >= this.totalPages) {
      throw new Error(`pageIndex must be between 0 and ${this.totalPages - 1}`);
    }
    
    if (this.currentPage !== pageIndex) {
      this.currentPage = pageIndex;
      this.updateUI();
      this.triggerUpdateDisplay();
    }
  }
  
  /**
   * Update the UI elements to reflect current state
   */
  updateUI() {
    // Update page index display
    if (this.dataList.length === 0) {
      this.currentPageElement.textContent = '0';
      this.totalPagesElement.textContent = '0';
      this.container.style.display = 'none';
    } else {
      this.currentPageElement.textContent = (this.currentPage + 1).toString();
      this.totalPagesElement.textContent = this.totalPages.toString();
      this.container.style.display = 'block';
    }
    
    // Update button states
    const hasItems = this.dataList.length > 0;
    const hasMultiplePages = this.totalPages > 1;
    const isFirstPage = this.currentPage === 0;
    const isLastPage = this.currentPage === this.totalPages - 1;
    
    this.prevButton.disabled = !hasMultiplePages || isFirstPage;
    this.nextButton.disabled = !hasMultiplePages || isLastPage;
    
    // Update ARIA attributes
    this.prevButton.setAttribute('aria-disabled', this.prevButton.disabled.toString());
    this.nextButton.setAttribute('aria-disabled', this.nextButton.disabled.toString());
  }
  
  /**
   * Get the current page's data slice
   * @returns {Array} Current page's data
   */
  getCurrentPageData() {
    if (this.dataList.length === 0) {
      return [];
    }
    
    const startIndex = this.currentPage * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.dataList.slice(startIndex, endIndex);
  }
  
  /**
   * Trigger the updateDisplay callback with current page data
   */
  triggerUpdateDisplay() {
    if (this.updateDisplay && typeof this.updateDisplay === 'function') {
      const currentPageData = this.getCurrentPageData();
      this.updateDisplay(currentPageData);
    }
  }
  
  /**
   * Get the pagination container element
   * @returns {HTMLElement} The pagination container
   */
  getContainer() {
    return this.container;
  }
  
  /**
   * Get current pagination state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.dataList.length,
      hasMultiplePages: this.totalPages > 1,
      isFirstPage: this.currentPage === 0,
      isLastPage: this.currentPage === this.totalPages - 1
    };
  }
  
  /**
   * Destroy the pagination component and clean up
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Clear references
    this.dataList = [];
    this.updateDisplay = null;
    this.container = null;
    this.prevButton = null;
    this.nextButton = null;
    this.currentPageElement = null;
    this.totalPagesElement = null;
    
    console.log('PaginationComponent destroyed');
  }
}

/**
 * Factory function to create a pagination component
 * @param {HTMLElement} container - Container element to append pagination to
 * @param {Array} dataList - Array of data to paginate
 * @param {number} itemsPerPage - Number of items per page
 * @param {Function} updateDisplay - Callback function for data updates
 * @returns {PaginationComponent} Pagination component instance
 */
export function createPagination(container, dataList = [], itemsPerPage = 1, updateDisplay = null) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('container must be a valid HTML element');
  }
  
  // Create pagination component
  const pagination = new PaginationComponent(dataList, itemsPerPage, updateDisplay);
  
  // Append to container
  container.appendChild(pagination.getContainer());
  
  return pagination;
}