import { render, Component } from 'preact'
import { html } from 'htm/preact'

/**
 * Carousel-style Pagination Component using Preact
 * Provides carousel-style pagination with prev/next buttons and current/total index display
 */
export class PaginationComponent extends Component {
  constructor(props) {
    super(props);
    
    // Validate parameters
    if (!Array.isArray(props.dataList || [])) {
      throw new Error('dataList must be an array');
    }
    
    if (typeof (props.itemsPerPage || 1) !== 'number' || (props.itemsPerPage || 1) < 1) {
      throw new Error('itemsPerPage must be a positive number');
    }
    
    if (props.updateDisplay && typeof props.updateDisplay !== 'function') {
      throw new Error('updateDisplay must be a function or null');
    }
    
    // Initialize state
    this.state = {
      dataList: [...(props.dataList || [])],
      itemsPerPage: props.itemsPerPage || 1,
      currentPage: 0,
      totalPages: Math.max(1, Math.ceil((props.dataList || []).length / (props.itemsPerPage || 1)))
    };
    
    this.updateDisplay = props.updateDisplay;
    
    console.log('PaginationComponent initialized:', {
      dataLength: this.state.dataList.length,
      itemsPerPage: this.state.itemsPerPage,
      totalPages: this.state.totalPages
    });
  }
  
  componentDidMount() {
    // Set up keyboard navigation on the container
    if (this.containerRef) {
      this.containerRef.addEventListener('keydown', this.handleKeyDown);
      this.containerRef.setAttribute('tabindex', '0');
    }
    
    // Initial update display
    this.triggerUpdateDisplay();
  }

  componentWillUnmount() {
    // Clean up event listener
    if (this.containerRef) {
      this.containerRef.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Trigger update display when current page changes
    if (prevState.currentPage !== this.state.currentPage || 
        prevState.dataList !== this.state.dataList) {
      this.triggerUpdateDisplay();
    }
  }

  handleKeyDown = (e) => {
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
  }
  
  /**
   * Update the data list and recalculate pagination
   * @param {Array} newDataList - New array of data
   */
  setDataList(newDataList) {
    if (!Array.isArray(newDataList)) {
      throw new Error('newDataList must be an array');
    }
    
    const totalPages = Math.max(1, Math.ceil(newDataList.length / this.state.itemsPerPage));
    const currentPage = Math.min(this.state.currentPage, Math.max(0, totalPages - 1));
    
    this.setState({ 
      dataList: [...newDataList], 
      totalPages,
      currentPage
    });
    
    console.log('PaginationComponent data updated:', {
      dataLength: newDataList.length,
      totalPages,
      currentPage
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
    
    const totalPages = Math.max(1, Math.ceil(this.state.dataList.length / newItemsPerPage));
    const currentPage = Math.min(this.state.currentPage, Math.max(0, totalPages - 1));
    
    this.setState({ 
      itemsPerPage: newItemsPerPage, 
      totalPages,
      currentPage
    });
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
  goToPreviousPage = () => {
    if (this.state.currentPage > 0) {
      this.setState({ currentPage: this.state.currentPage - 1 });
    }
  }
  
  /**
   * Go to the next page
   */
  goToNextPage = () => {
    if (this.state.currentPage < this.state.totalPages - 1) {
      this.setState({ currentPage: this.state.currentPage + 1 });
    }
  }
  
  /**
   * Go to the first page
   */
  goToFirstPage() {
    if (this.state.currentPage !== 0) {
      this.setState({ currentPage: 0 });
    }
  }
  
  /**
   * Go to the last page
   */
  goToLastPage() {
    const lastPage = this.state.totalPages - 1;
    if (this.state.currentPage !== lastPage) {
      this.setState({ currentPage: lastPage });
    }
  }
  
  /**
   * Go to a specific page
   * @param {number} pageIndex - Zero-based page index
   */
  goToPage(pageIndex) {
    if (typeof pageIndex !== 'number') {
      throw new Error(`pageIndex must be a number, received: ${typeof pageIndex}`);
    }
    
    if (pageIndex < 0) {
      throw new Error(`pageIndex must be >= 0, received: ${pageIndex}`);
    }
    
    if (pageIndex >= this.state.totalPages) {
      throw new Error(`pageIndex must be < ${this.state.totalPages} (total pages), received: ${pageIndex}. Current data length: ${this.state.dataList.length}`);
    }
    
    if (this.state.currentPage !== pageIndex) {
      this.setState({ currentPage: pageIndex });
    }
  }
  
  /**
   * Get the current page's data slice
   * @returns {Array} Current page's data
   */
  getCurrentPageData() {
    if (this.state.dataList.length === 0) {
      return [];
    }
    
    const startIndex = this.state.currentPage * this.state.itemsPerPage;
    const endIndex = startIndex + this.state.itemsPerPage;
    return this.state.dataList.slice(startIndex, endIndex);
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
   * Get current pagination state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      currentPage: this.state.currentPage,
      totalPages: this.state.totalPages,
      itemsPerPage: this.state.itemsPerPage,
      totalItems: this.state.dataList.length,
      hasMultiplePages: this.state.totalPages > 1,
      isFirstPage: this.state.currentPage === 0,
      isLastPage: this.state.currentPage === this.state.totalPages - 1
    };
  }

  render() {
    const { currentPage, totalPages, dataList } = this.state;
    const hasItems = dataList.length > 0;
    const hasMultiplePages = totalPages > 1;
    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage === totalPages - 1;
    
    // Hide component if no items
    if (!hasItems) {
      return html`<div class="pagination-container" style=${{ display: 'none' }}></div>`;
    }

    return html`
      <div 
        class="pagination-container"
        role="navigation"
        aria-label="Pagination navigation"
        ref=${(ref) => { this.containerRef = ref; }}
      >
        <div class="pagination-nav">
          <button 
            class="pagination-btn pagination-prev"
            title="Previous page"
            aria-label="Go to previous page"
            disabled=${!hasMultiplePages || isFirstPage}
            aria-disabled=${!hasMultiplePages || isFirstPage}
            onClick=${this.goToPreviousPage}
          >
            <box-icon name='caret-left' color='#ffffff'></box-icon>
          </button>
          <div class="pagination-index" aria-live="polite">
            <span class="pagination-current">${currentPage + 1}</span> / <span class="total-pages">${totalPages}</span>
          </div>
          <button 
            class="pagination-btn pagination-next"
            title="Next page"
            aria-label="Go to next page"
            disabled=${!hasMultiplePages || isLastPage}
            aria-disabled=${!hasMultiplePages || isLastPage}
            onClick=${this.goToNextPage}
          >
            <box-icon name='caret-right' color='#ffffff'></box-icon>
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * Factory function to create a pagination component
 * @param {HTMLElement} container - Container element to append pagination to
 * @param {Array} dataList - Array of data to paginate
 * @param {number} itemsPerPage - Number of items per page
 * @param {Function} updateDisplay - Callback function for data updates
 * @returns {Object} Object with methods to control the pagination component
 */
export function createPagination(container, dataList = [], itemsPerPage = 1, updateDisplay = null) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('container must be a valid HTML element');
  }
  
  let paginationRef = null;
  
  // Render the Preact component
  render(
    html`<${PaginationComponent} 
      dataList=${dataList}
      itemsPerPage=${itemsPerPage}
      updateDisplay=${updateDisplay}
      ref=${(ref) => { paginationRef = ref; }}
    />`, 
    container
  );
  
  // Return an object that provides access to the component methods
  return {
    setDataList(newDataList) {
      if (paginationRef) {
        paginationRef.setDataList(newDataList);
      }
    },
    setItemsPerPage(newItemsPerPage) {
      if (paginationRef) {
        paginationRef.setItemsPerPage(newItemsPerPage);
      }
    },
    setUpdateDisplay(callback) {
      if (paginationRef) {
        paginationRef.setUpdateDisplay(callback);
      }
    },
    goToPage(pageIndex) {
      if (paginationRef) {
        paginationRef.goToPage(pageIndex);
      }
    },
    goToPreviousPage() {
      if (paginationRef) {
        paginationRef.goToPreviousPage();
      }
    },
    goToNextPage() {
      if (paginationRef) {
        paginationRef.goToNextPage();
      }
    },
    goToFirstPage() {
      if (paginationRef) {
        paginationRef.goToFirstPage();
      }
    },
    goToLastPage() {
      if (paginationRef) {
        paginationRef.goToLastPage();
      }
    },
    getCurrentPageData() {
      return paginationRef ? paginationRef.getCurrentPageData() : [];
    },
    getState() {
      return paginationRef ? paginationRef.getState() : null;
    },
    destroy() {
      // Clean up by removing from DOM
      if (container && container.firstChild) {
        render(null, container);
      }
      paginationRef = null;
      console.log('PaginationComponent destroyed');
    }
  };
}