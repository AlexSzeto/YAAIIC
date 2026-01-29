import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
/**
 * MIGRATION NOTE:
 * This file was renamed from pagination.mjs to navigator.mjs
 * Component renames:
 * - PaginationControls → NavigatorControl
 * - PaginationComponent → NavigatorComponent  
 * - createPagination → createNavigator
 * 
 * For backward compatibility during migration, consider importing:
 * import { NavigatorControl as PaginationControls } from './navigator.mjs';
 */


// =========================================================================
// Styled Components
// =========================================================================

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  display: ${props => props.display};
`;

const Nav = styled('div')`
  display: flex;
  align-items: center;
  gap: ${props => props.gap};
`;

const PageIndex = styled('div')`
  min-width: 60px;
  text-align: center;
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
  color: ${props => props.color};
`;

const EmptyMessage = styled('div')`
  text-align: center;
  padding: 20px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-style: italic;
`;

/**
 * Stateless Pagination Controls Component (for use with usePagination hook)
 * 
 * Pure UI component that renders prev/next navigation buttons with themed styling.
 * Optionally displays first/last jump buttons and handles empty state.
 * 
 * @param {Object} props
 * @param {number} props.currentPage - Current zero-based page index
 * @param {number} props.totalPages - Total number of pages
 * @param {Function} [props.onNext] - Handler for next page
 * @param {Function} [props.onPrev] - Handler for previous page
 * @param {Function} [props.onFirst] - Handler for first page (required if showFirstLast is true)
 * @param {Function} [props.onLast] - Handler for last page (required if showFirstLast is true)
 * @param {boolean} [props.showFirstLast=false] - Show first/last jump buttons
 * @param {string} [props.emptyMessage='No items'] - Message to display when totalPages is 0
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic usage
 * <NavigatorControl 
 *   currentPage={0} 
 *   totalPages={5} 
 *   onNext={handleNext} 
 *   onPrev={handlePrev} 
 * />
 * 
 * @example
 * // With first/last buttons
 * <NavigatorControl 
 *   currentPage={2} 
 *   totalPages={10} 
 *   onNext={handleNext} 
 *   onPrev={handlePrev}
 *   onFirst={handleFirst}
 *   onLast={handleLast}
 *   showFirstLast={true}
 * />
 */
export class NavigatorControl extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value
    };
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const {
      currentPage,
      totalPages,
      onNext,
      onPrev,
      onFirst,
      onLast,
      showFirstLast = false,
      emptyMessage = 'No items',
    } = this.props;
    const { theme } = this.state;

    // Show empty message if no pages
    if (totalPages === 0) {
      return html`
        <${EmptyMessage} 
          color=${theme.colors.text.secondary}
          fontSize=${theme.typography.fontSize.medium}
        >${emptyMessage}</>
      `;
    }

    // Compute navigation state from currentPage and totalPages
    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage >= totalPages - 1;
    const hasMultiplePages = totalPages > 1;
    const canGoPrev = hasMultiplePages && !isFirstPage;
    const canGoNext = hasMultiplePages && !isLastPage;
    const canGoFirst = hasMultiplePages && !isFirstPage;
    const canGoLast = hasMultiplePages && !isLastPage;

    return html`
      <${Container}
        role="navigation"
        aria-label="Pagination navigation"
      >
        <${Nav} gap=${theme.spacing.small.gap}>
          ${showFirstLast ? html`
            <${Button}
              variant="medium-icon"
              color="secondary"
              icon="chevrons-left"
              title="First page"
              aria-label="Go to first page"
              disabled=${!canGoFirst}
              onClick=${onFirst}
            />
          ` : ''}
          
          <${Button}
            variant="medium-icon"
            color="secondary"
            icon="chevron-left"
            title="Previous page"
            aria-label="Go to previous page"
            disabled=${!canGoPrev}
            onClick=${onPrev}
          />
          <${PageIndex} 
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
            color=${theme.colors.text.primary}
            aria-live="polite"
          >
            <span>${currentPage + 1}</span> / <span>${totalPages}</span>
          <//>
          <${Button}
            variant="medium-icon"
            color="secondary"
            icon="chevron-right"
            title="Next page"
            aria-label="Go to next page"
            disabled=${!canGoNext}
            onClick=${onNext}
          />
          
          ${showFirstLast ? html`
            <${Button}
              variant="medium-icon"
              color="secondary"
              icon="chevrons-right"
              title="Last page"
              aria-label="Go to last page"
              disabled=${!canGoLast}
              onClick=${onLast}
            />
          ` : ''}
        <//>
      <//>
    `;
  }
}


/**
 * Navigator Component using Preact
 * 
 * Provides carousel-style pagination with prev/next buttons and current/total index display.
 * Manages its own data list and page state.
 * 
 * @param {Object} props
 * @param {Array} [props.dataList=[]] - Array of data to paginate
 * @param {number} [props.itemsPerPage=1] - Number of items per page
 * @param {Function} [props.updateDisplay] - Callback function called with current page data
 * @returns {preact.VNode}
 * 
 * @example
 * <NavigatorComponent 
 *   dataList={items}
 *   itemsPerPage={10}
 *   updateDisplay={(pageData) => renderItems(pageData)}
 * />
 */
export class NavigatorComponent extends Component {
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
      totalPages: Math.max(1, Math.ceil((props.dataList || []).length / (props.itemsPerPage || 1))),
      theme: currentTheme.value
    };
    
    this.updateDisplay = props.updateDisplay;
    
    console.log('NavigatorComponent initialized:', {
      dataLength: this.state.dataList.length,
      itemsPerPage: this.state.itemsPerPage,
      totalPages: this.state.totalPages
    });
  }
  
  componentDidMount() {
    // Subscribe to theme changes
    this.unsubscribeTheme = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });

    // Set up keyboard navigation on the container
    if (this.containerRef) {
      this.containerRef.addEventListener('keydown', this.handleKeyDown);
      this.containerRef.setAttribute('tabindex', '0');
    }
    
    // Initial update display
    this.triggerUpdateDisplay();
  }

  componentWillUnmount() {
    // Clean up theme subscription
    if (this.unsubscribeTheme) {
      this.unsubscribeTheme();
    }

    // Clean up event listener
    if (this.containerRef) {
      this.containerRef.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Sync props.dataList to state if it changed
    if (prevProps.dataList !== this.props.dataList) {
      const newDataList = this.props.dataList || [];
      const totalPages = Math.max(1, Math.ceil(newDataList.length / this.state.itemsPerPage));
      const currentPage = Math.min(this.state.currentPage, Math.max(0, totalPages - 1));
      
      this.setState({
        dataList: [...newDataList],
        totalPages,
        currentPage
      });
      console.log('NavigatorComponent props.dataList changed, synced to state:', {
        dataLength: newDataList.length,
        totalPages,
        currentPage
      });
      return; // State update will trigger another componentDidUpdate
    }

    // Trigger update display when current page changes or dataList changes
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
   * @param {Function} callback - Optional callback function to execute after state update is complete
   */
  setDataList(newDataList, callback) {
    if (!Array.isArray(newDataList)) {
      throw new Error('newDataList must be an array');
    }
    
    if (callback && typeof callback !== 'function') {
      throw new Error('callback must be a function');
    }
    
    const totalPages = Math.max(1, Math.ceil(newDataList.length / this.state.itemsPerPage));
    const currentPage = Math.min(this.state.currentPage, Math.max(0, totalPages - 1));
    
    this.setState({ 
      dataList: [...newDataList], 
      totalPages,
      currentPage
    }, () => {
      console.log('NavigatorComponent data updated:', {
        dataLength: newDataList.length,
        totalPages,
        currentPage
      });
      
      // Execute callback after state update is complete
      if (callback) {
        callback();
      }
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
    const { currentPage, totalPages, dataList, theme } = this.state;
    const hasItems = dataList.length > 0;
    const hasMultiplePages = totalPages > 1;
    const isFirstPage = currentPage === 0;
    const isLastPage = currentPage === totalPages - 1;
    
    // Hide component if no items
    if (!hasItems) {
      return html`<${Container} display="none"><//>`;
    }

    return html`
      <${Container}
        role="navigation"
        aria-label="Pagination navigation"
        ref=${(ref) => { this.containerRef = ref; }}
      >
        <${Nav} gap=${theme.spacing.small.gap}>
          <${Button}
            variant="medium-icon"
            color="secondary"
            icon="chevron-left"
            title="Previous page"
            aria-label="Go to previous page"
            disabled=${!hasMultiplePages || isFirstPage}
            onClick=${this.goToPreviousPage}
          />
          <${PageIndex} 
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
            color=${theme.colors.text.primary}
            aria-live="polite"
          >
            <span>${currentPage + 1}</span> / <span>${totalPages}</span>
          <//>
          <${Button}
            variant="medium-icon"
            color="secondary"
            icon="chevron-right"
            title="Next page"
            aria-label="Go to next page"
            disabled=${!hasMultiplePages || isLastPage}
            onClick=${this.goToNextPage}
          />
        <//>
      <//>
    `;
  }
}

/**
 * Factory function to create a navigator component
 * 
 * @param {HTMLElement} container - Container element to append pagination to
 * @param {Array} [dataList=[]] - Array of data to paginate
 * @param {number} [itemsPerPage=1] - Number of items per page
 * @param {Function} [updateDisplay=null] - Callback function for data updates
 * @returns {Object} Object with methods to control the navigator component
 * 
 * @example
 * const pagination = createNavigator(
 *   document.getElementById('pagination'),
 *   items,
 *   10,
 *   (pageData) => renderItems(pageData)
 * );
 * pagination.goToPage(2);
 */
export function createNavigator(container, dataList = [], itemsPerPage = 1, updateDisplay = null) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('container must be a valid HTML element');
  }
  
  let navigatorRef = null;
  
  // Render the Preact component
  render(
    html`<${NavigatorComponent} 
      dataList=${dataList}
      itemsPerPage=${itemsPerPage}
      updateDisplay=${updateDisplay}
      ref=${(ref) => { navigatorRef = ref; }}
    />`, 
    container
  );
  
  // Return an object that provides access to the component methods
  return {
    setDataList(newDataList, callback) {
      if (navigatorRef) {
        navigatorRef.setDataList(newDataList, callback);
      }
    },
    setItemsPerPage(newItemsPerPage) {
      if (navigatorRef) {
        navigatorRef.setItemsPerPage(newItemsPerPage);
      }
    },
    setUpdateDisplay(callback) {
      if (navigatorRef) {
        navigatorRef.setUpdateDisplay(callback);
      }
    },
    goToPage(pageIndex) {
      if (navigatorRef) {
        navigatorRef.goToPage(pageIndex);
      }
    },
    goToPreviousPage() {
      if (navigatorRef) {
        navigatorRef.goToPreviousPage();
      }
    },
    goToNextPage() {
      if (navigatorRef) {
        navigatorRef.goToNextPage();
      }
    },
    goToFirstPage() {
      if (navigatorRef) {
        navigatorRef.goToFirstPage();
      }
    },
    goToLastPage() {
      if (navigatorRef) {
        navigatorRef.goToLastPage();
      }
    },
    getCurrentPageData() {
      return navigatorRef ? navigatorRef.getCurrentPageData() : [];
    },
    getState() {
      return navigatorRef ? navigatorRef.getState() : null;
    },
    destroy() {
      // Clean up by removing from DOM
      if (container && container.firstChild) {
        render(null, container);
      }
      navigatorRef = null;
      console.log('NavigatorComponent destroyed');
    }
  };
}