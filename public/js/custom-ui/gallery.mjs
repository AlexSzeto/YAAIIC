import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createPagination } from './pagination.mjs'
import { fetchJson, FetchError } from '../util.mjs'
import { showDialog } from './dialog.mjs'

// Gallery Setup Module
export class GalleryDisplay extends Component {
  constructor(props) {
    super(props);
    
    if (!props.queryPath) {
      throw new Error('QueryPath is required for GalleryDisplay');
    }
    
    if (!props.previewFactory) {
      throw new Error('PreviewFactory is required for GalleryDisplay');
    }
    
    this.queryPath = props.queryPath;
    this.previewFactory = props.previewFactory;
    this.onLoad = props.onLoad;
    
    this.state = {
      isVisible: false,
      galleryData: [],
      searchQuery: '',
      currentPageData: [], // Store current page's items for display
      selectedItems: [], // Array of selected item UIDs
      shouldFocusSearch: false // Flag to control when search input should be focused
    };
    
    // Pagination component will be created when modal is shown
    this.pagination = null;
    
    console.log('GalleryDisplay initialized successfully');
  }
  
  componentDidMount() {
    // Set up escape key listener
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    // Clean up event listener
    document.removeEventListener('keydown', this.handleKeyDown);
    // Clear search timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    // Clean up pagination component
    if (this.pagination) {
      this.pagination.destroy();
      this.pagination = null;
    }
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape' && this.state.isVisible) {
      this.hideModal();
    }
  }

  handleSearchInput = (e) => {
    const searchQuery = e.target.value;
    this.setState({ searchQuery });
    this.debounceSearch();
  }

  handleLoadClick = () => {
    if (this.onLoad && typeof this.onLoad === 'function') {
      this.onLoad(this.state.galleryData);
    }
    this.hideModal();
  }

  handleCancelClick = () => {
    this.setState({ searchQuery: '' });
    this.hideModal();
  }

  handleModalClick = (e) => {
    if (e.target.classList.contains('gallery-modal')) {
      this.hideModal();
    }
  }
  
  /**
   * Handle item selection/deselection
   * @param {Object} data - The item data object
   * @param {boolean} isSelected - Whether the item is selected
   */
  handleItemSelect = (data, isSelected) => {
    if (!data || !data.uid) {
      console.warn('Cannot select item without UID:', data);
      return;
    }
    
    const { selectedItems } = this.state;
    let newSelectedItems;
    
    if (isSelected) {
      // Add UID to selected items if not already present
      if (!selectedItems.includes(data.uid)) {
        newSelectedItems = [...selectedItems, data.uid];
      } else {
        newSelectedItems = selectedItems; // No change needed
      }
    } else {
      // Remove UID from selected items
      newSelectedItems = selectedItems.filter(uid => uid !== data.uid);
    }
    
    this.setState({ selectedItems: newSelectedItems });
    console.log('Gallery item selection changed:', {
      itemName: data.name,
      uid: data.uid,
      isSelected,
      totalSelected: newSelectedItems.length
    });
  }
  
  /**
   * Delete all selected items with confirmation
   */
  deleteSelectedItems = async () => {
    const { selectedItems } = this.state;
    
    if (selectedItems.length === 0) {
      console.warn('No items selected for deletion');
      return;
    }
    
    // Show confirmation dialog
    const itemText = selectedItems.length === 1 ? 'item' : 'items';
    const result = await showDialog(
      `Are you sure you want to delete ${selectedItems.length} selected ${itemText}? This action cannot be undone.`,
      'Confirm Deletion',
      ['Delete', 'Cancel']
    );
    
    if (result !== 'Delete') {
      return;
    }
    
    try {
      console.log('Deleting selected items:', selectedItems);
      
      // Show loading feedback
      if (window.showToast) {
        window.showToast(`Deleting ${selectedItems.length} ${itemText}...`);
      }
      
      // Send DELETE request to the server
      const response = await fetchJson('/image-data/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uids: selectedItems })
      }, {
        maxRetries: 1,
        retryDelay: 1000,
        showUserFeedback: true,
        showSuccessFeedback: false // We'll show our own success message
      });
      
      console.log('Delete response:', response);
      
      // Clear selections
      this.setState({ selectedItems: [] });
      
      // Refresh gallery data
      await this.fetchGalleryData();
      
      // Show success feedback
      if (window.showToast) {
        const deletedText = response.deletedCount === 1 ? 'item' : 'items';
        window.showToast(`Successfully deleted ${response.deletedCount} ${deletedText}`);
      }
      
    } catch (error) {
      console.error('Error deleting selected items:', error);
      
      // Show error feedback
      if (window.showToast) {
        const errorMessage = error instanceof FetchError && error.data?.message 
          ? error.data.message 
          : `Failed to delete selected ${itemText}. Please try again.`;
        window.showToast(errorMessage);
      }
    }
  }
  
  /**
   * Handle pagination component updates
   * @param {Array} currentPageData - Current page data from pagination component
   */
  handlePaginationUpdate = (currentPageData) => {
    this.setState({ currentPageData });
    console.log('Gallery pagination updated:', currentPageData.length, 'items on current page');
  }
  
  /**
   * Debounce search input to avoid too many API calls
   */
  debounceSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.fetchGalleryData();
    }, 300);
  }
  
  /**
   * Show the modal
   */
  showModal() {
    this.setState({ 
      isVisible: true, 
      selectedItems: [], // Clear selections when modal opens
      shouldFocusSearch: true // Enable search focus for this render
    });
    this.fetchGalleryData();
    console.log('Gallery modal opened');
  }
  
  /**
   * Hide the modal
   */
  hideModal() {
    this.setState({ 
      isVisible: false, 
      currentPageData: [], 
      selectedItems: [], // Clear selections when modal closes
      shouldFocusSearch: false // Reset focus flag
    });
    
    // Clean up pagination component
    if (this.pagination) {
      this.pagination.destroy();
      this.pagination = null;
    }
    
    console.log('Gallery modal closed');
  }
  
  /**
   * Fetch gallery data from the server with enhanced error handling and retry
   */
  async fetchGalleryData() {
    try {
      const query = this.state.searchQuery.trim();
      const url = new URL(this.queryPath, window.location.origin);
      url.searchParams.set('query', query);
      // Remove server-side limit - get all matching data for client-side pagination
      url.searchParams.set('limit', '320');
      
      console.log('Fetching gallery data:', url.toString());
      
      // Use enhanced fetch with retry mechanism
      const galleryData = await fetchJson(url.toString(), {}, {
        maxRetries: 2, // Fewer retries for gallery since it's user-initiated
        retryDelay: 800,
        showUserFeedback: true,
        showSuccessFeedback: false // Don't show success toast for gallery loads
      });
      
      this.setState({ galleryData });
      
      // Update pagination with new data
      if (this.pagination) {
        this.pagination.setDataList(galleryData);
      }
      
      console.log('Gallery data loaded:', galleryData.length, 'items');
    } catch (error) {
      console.error('Error fetching gallery data:', error);
      
      // Set empty state
      this.setState({ galleryData: [], currentPageData: [] });
      
      // Update pagination with empty data
      if (this.pagination) {
        this.pagination.setDataList([]);
      }
      
      // Error feedback is already handled by fetchJson utility
    }
  }  /**
   * Render gallery items
   */
  renderGalleryItems() {
    const maxItems = 32; // Still maintain grid layout with 32 slots
    const itemsToShow = this.state.currentPageData; // Use pagination data instead of slicing
    
    // Create items using the previewFactory
    const items = [];
    
    itemsToShow.forEach((item, index) => {
      if (index < maxItems) { // Ensure we don't exceed grid layout
        // Check if this item is selected
        const isSelected = this.state.selectedItems.includes(item.uid);
        const preview = this.previewFactory(item, this.handleItemSelect, isSelected);
        if (preview) {
          // Create a wrapper div to hold the DOM element content
          items.push(
            html`<div 
              key=${`${item.imageUrl || item.name || 'item'}-${index}`} 
              class="gallery-item-wrapper"
              ref=${(ref) => {
                if (ref) {
                  // Always clear and re-add the preview to ensure it updates
                  ref.innerHTML = '';
                  ref.appendChild(preview);
                }
              }}
            ></div>`
          );
        }
      }
    });

    // Add empty placeholders to maintain grid layout
    const emptySlots = maxItems - Math.min(itemsToShow.length, maxItems);
    for (let i = 0; i < emptySlots; i++) {
      items.push(
        html`<div key=${`empty-${i}`} class="gallery-item" style=${{ opacity: '0.3' }}></div>`
      );
    }

    return items;
  }

  render() {
    if (!this.state.isVisible) {
      return null;
    }

    const { selectedItems } = this.state;
    const hasSelectedItems = selectedItems.length > 0;
    const selectedText = selectedItems.length === 1 ? 'item' : 'items';

    return html`
      <div 
        class="gallery-modal"
        onClick=${this.handleModalClick}
      >
        <div class="gallery-content">
          <div class="gallery-grid">
            ${this.renderGalleryItems()}
          </div>
          <div class="gallery-pagination-wrapper">
            <div class="gallery-bulk-delete">
              <button 
                class="gallery-bulk-delete-btn btn-with-icon"
                onClick=${this.deleteSelectedItems}
                disabled=${!hasSelectedItems}
                title=${hasSelectedItems ? `Delete ${selectedItems.length} selected ${selectedText}` : 'No items selected'}
                aria-disabled=${!hasSelectedItems}
              >
                <box-icon name="trash" color="#ffffff"></box-icon>
                Delete
              </button>
            </div>
            <div class="gallery-pagination-container" ref=${(ref) => this.setupPagination(ref)}></div>
          </div>
          <div class="gallery-controls">
            <div class="gallery-search">
              <input
                type="text"
                placeholder="Search images..."
                value=${this.state.searchQuery}
                onInput=${this.handleSearchInput}
                ref=${(input) => { 
                  if (input && this.state.shouldFocusSearch) {
                    input.focus();
                    // Clear the focus flag after focusing to prevent re-focus on subsequent renders
                    this.setState({ shouldFocusSearch: false });
                  }
                }}
              />
              <box-icon
                name="search"
                color="#999999"
                class="gallery-search-icon"
              ></box-icon>
            </div>
            <div class="gallery-btn-group">
              <button 
                class="gallery-load-btn btn-with-icon"
                onClick=${this.handleLoadClick}
              >
                <box-icon name="save" color="#ffffff"></box-icon>
                Load
              </button>
              <button 
                class="gallery-cancel-btn btn-with-icon"
                onClick=${this.handleCancelClick}
              >
                <box-icon name="x" color="#ffffff"></box-icon>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Set up pagination component when container is available
   * @param {HTMLElement} container - Pagination container element
   */
  setupPagination(container) {
    if (container && !this.pagination) {
      // Create pagination component with 32 items per page
      this.pagination = createPagination(
        container,
        this.state.galleryData,
        32, // itemsPerPage = 32 for gallery grid
        this.handlePaginationUpdate
      );
      
      console.log('Gallery pagination component initialized');
    }
  }
  
  /**
   * Set the onLoad callback function (for backward compatibility)
   * @param {Function} callback - Function to call when Load button is pressed
   */
  setOnLoad(callback) {
    this.onLoad = callback;
  }
}

// Factory function to create a gallery instance (for backward compatibility)
export function createGallery(queryPath, previewFactory, onLoad) {
  let galleryRef = null;
  let containerElement = null;

  // Create container and render gallery
  const init = () => {
    if (!containerElement) {
      containerElement = document.createElement('div');
      document.body.appendChild(containerElement);
      
      render(
        html`<${GalleryDisplay} 
          queryPath=${queryPath}
          previewFactory=${previewFactory}
          onLoad=${onLoad}
          ref=${(ref) => { galleryRef = ref; }}
        />`, 
        containerElement
      );
    }
  };

  // Return an object that matches the original API
  return {
    showModal() {
      init();
      if (galleryRef) {
        galleryRef.showModal();
      }
    },
    hideModal() {
      if (galleryRef) {
        galleryRef.hideModal();
      }
    },
    setOnLoad(callback) {
      if (galleryRef) {
        galleryRef.setOnLoad(callback);
      }
    }
  };
}
