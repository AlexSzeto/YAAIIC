import { render, Component } from 'preact'
import { html } from 'htm/preact'

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
      searchQuery: ''
    };
    
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
    this.setState({ isVisible: true });
    this.fetchGalleryData();
    console.log('Gallery modal opened');
  }
  
  /**
   * Hide the modal
   */
  hideModal() {
    this.setState({ isVisible: false });
    console.log('Gallery modal closed');
  }
  
  /**
   * Fetch gallery data from the server
   */
  async fetchGalleryData() {
    try {
      const query = this.state.searchQuery.trim();
      const url = new URL(this.queryPath, window.location.origin);
      url.searchParams.set('query', query);
      url.searchParams.set('limit', '32');
      
      console.log('Fetching gallery data:', url.toString());
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch gallery data: ${response.status}`);
      }
      
      const galleryData = await response.json();
      this.setState({ galleryData });
      
      console.log('Gallery data loaded:', galleryData.length, 'items');
    } catch (error) {
      console.error('Error fetching gallery data:', error);
      this.setState({ galleryData: [] });
    }
  }
  
  /**
   * Render gallery items
   */
  renderGalleryItems() {
    const maxItems = 32;
    const itemsToShow = this.state.galleryData.slice(0, maxItems);
    
    // Create items using the previewFactory
    const items = [];
    
    itemsToShow.forEach((item, index) => {
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
    });

    // Add empty placeholders
    const emptySlots = maxItems - itemsToShow.length;
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

    return html`
      <div 
        class="gallery-modal"
        onClick=${this.handleModalClick}
      >
        <div class="gallery-content">
          <div class="gallery-grid">
            ${this.renderGalleryItems()}
          </div>
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
      </div>
    `;
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
