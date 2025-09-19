import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { CustomModal } from './modal.js'
import { createPagination } from './pagination.js'
import { fetchJson, FetchError } from '../util.js'

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
    this.onClose = props.onClose;
    
    this.state = {
      galleryData: [],
      searchQuery: '',
      currentPageData: [] // Store current page's items for display
    };
    
    // Pagination component will be created when modal is shown
    this.pagination = null;
    
    console.log('GalleryDisplay initialized successfully');
  }
  
  componentDidMount() {
    // Fetch data if visible on mount
    if (this.props.isVisible) {
      this.fetchGalleryData();
    }
  }

  componentDidUpdate(prevProps) {
    // Fetch data when modal becomes visible
    if (!prevProps.isVisible && this.props.isVisible) {
      this.fetchGalleryData();
      console.log('Gallery modal opened');
    }
    
    // Clean up when modal becomes hidden
    if (prevProps.isVisible && !this.props.isVisible) {
      this.setState({ currentPageData: [] });
      
      // Clean up pagination component
      if (this.pagination) {
        this.pagination.destroy();
        this.pagination = null;
      }
      
      console.log('Gallery modal closed');
    }
  }

  componentWillUnmount() {
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

  handleSearchInput = (e) => {
    const searchQuery = e.target.value;
    this.setState({ searchQuery });
    this.debounceSearch();
  }

  handleLoadClick = () => {
    if (this.onLoad && typeof this.onLoad === 'function') {
      this.onLoad(this.state.galleryData);
    }
    this.closeModal();
  }

  handleCancelClick = () => {
    this.setState({ searchQuery: '' });
    this.closeModal();
  }
  
  /**
   * Close the modal by calling the external onClose callback
   */
  closeModal() {
    if (this.onClose && typeof this.onClose === 'function') {
      this.onClose();
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
        const preview = this.previewFactory(item);
        if (preview) {
          // Create a wrapper div to hold the DOM element content
          items.push(
            html`<div 
              key=${index} 
              class="gallery-item-wrapper"
              ref=${(ref) => {
                if (ref && ref.children.length === 0) {
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
    return html`
      <${CustomModal}
        isVisible=${this.props.isVisible}
        onClose=${this.closeModal}
        size="large"
      >
        <div class="gallery-content">
          <div class="gallery-grid">
            ${this.renderGalleryItems()}
          </div>
          <div class="gallery-pagination-container" ref=${(ref) => this.setupPagination(ref)}></div>
          <div class="gallery-controls">
            <div class="gallery-search">
              <input
                type="text"
                placeholder="Search images..."
                value=${this.state.searchQuery}
                onInput=${this.handleSearchInput}
                ref=${(input) => { if (input) input.focus(); }}
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
      </${CustomModal}>
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
  
}
