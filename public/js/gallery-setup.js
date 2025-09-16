// Gallery Setup Module
export class GalleryDisplay {
  constructor(queryPath, previewFactory) {
    if (!queryPath) {
      throw new Error('QueryPath is required for GalleryDisplay');
    }
    
    if (!previewFactory) {
      throw new Error('PreviewFactory is required for GalleryDisplay');
    }
    
    this.queryPath = queryPath;
    this.previewFactory = previewFactory;
    this.galleryData = [];
    this.onLoad = null;
    
    // Create the modal structure
    this.createModal();
    
    console.log('GalleryDisplay initialized successfully');
  }
  
  /**
   * Create the modal HTML structure
   */
  createModal() {
    // Create modal overlay
    this.modal = document.createElement('div');
    this.modal.className = 'gallery-modal hidden';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'gallery-content';
    
    // Create gallery grid
    this.galleryGrid = document.createElement('div');
    this.galleryGrid.className = 'gallery-grid';
    
    // Create gallery controls
    const galleryControls = document.createElement('div');
    galleryControls.className = 'gallery-controls';
    
    // Create search section
    const searchSection = document.createElement('div');
    searchSection.className = 'gallery-search';
    
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search images...';
    
    const searchIcon = document.createElement('box-icon');
    searchIcon.setAttribute('name', 'search');
    searchIcon.setAttribute('color', '#999999');
    searchIcon.className = 'gallery-search-icon';
    
    searchSection.appendChild(this.searchInput);
    searchSection.appendChild(searchIcon);
    
    // Create button group
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'gallery-btn-group';
    
    // Create Load button
    this.loadButton = document.createElement('button');
    this.loadButton.className = 'gallery-load-btn btn-with-icon';
    this.loadButton.innerHTML = '<box-icon name="save" color="#ffffff"></box-icon>Load';
    
    // Create Cancel button
    this.cancelButton = document.createElement('button');
    this.cancelButton.className = 'gallery-cancel-btn btn-with-icon';
    this.cancelButton.innerHTML = '<box-icon name="x" color="#ffffff"></box-icon>Cancel';
    
    buttonGroup.appendChild(this.loadButton);
    buttonGroup.appendChild(this.cancelButton);
    
    // Assemble controls
    galleryControls.appendChild(searchSection);
    galleryControls.appendChild(buttonGroup);
    
    // Assemble modal content
    modalContent.appendChild(this.galleryGrid);
    modalContent.appendChild(galleryControls);
    
    // Assemble modal
    this.modal.appendChild(modalContent);
    
    // Add to document body
    document.body.appendChild(this.modal);
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Search input change
    this.searchInput.addEventListener('input', () => {
      this.debounceSearch();
    });
    
    // Load button click
    this.loadButton.addEventListener('click', () => {
      if (this.onLoad && typeof this.onLoad === 'function') {
        this.onLoad(this.galleryData);
      }
      this.hideModal();
    });
    
    // Cancel button click
    this.cancelButton.addEventListener('click', () => {
      this.searchInput.value = '';
      this.hideModal();
    });
    
    // Close modal when clicking outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal();
      }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.hideModal();
      }
    });
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
    this.modal.classList.remove('hidden');
    this.searchInput.focus();
    this.fetchGalleryData();
    console.log('Gallery modal opened');
  }
  
  /**
   * Hide the modal
   */
  hideModal() {
    this.modal.classList.add('hidden');
    console.log('Gallery modal closed');
  }
  
  /**
   * Fetch gallery data from the server
   */
  async fetchGalleryData() {
    try {
      const query = this.searchInput.value.trim();
      const url = new URL(this.queryPath, window.location.origin);
      url.searchParams.set('query', query);
      url.searchParams.set('limit', '32');
      
      console.log('Fetching gallery data:', url.toString());
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch gallery data: ${response.status}`);
      }
      
      this.galleryData = await response.json();
      this.updateGalleryGrid();
      
      console.log('Gallery data loaded:', this.galleryData.length, 'items');
    } catch (error) {
      console.error('Error fetching gallery data:', error);
      this.galleryData = [];
      this.updateGalleryGrid();
    }
  }
  
  /**
   * Update the gallery grid with current data
   */
  updateGalleryGrid() {
    // Clear existing grid
    this.galleryGrid.innerHTML = '';
    
    // Add items to grid (up to 32 items for 8x4 grid)
    const maxItems = 32;
    const itemsToShow = this.galleryData.slice(0, maxItems);
    
    itemsToShow.forEach((item, index) => {
      const preview = this.previewFactory(item);
      if (preview) {
        this.galleryGrid.appendChild(preview);
      }
    });
    
    // Fill remaining slots with empty placeholders if needed
    const emptySlots = maxItems - itemsToShow.length;
    for (let i = 0; i < emptySlots; i++) {
      const placeholder = document.createElement('div');
      placeholder.className = 'gallery-item';
      placeholder.style.opacity = '0.3';
      this.galleryGrid.appendChild(placeholder);
    }
  }
  
  /**
   * Set the onLoad callback function
   * @param {Function} callback - Function to call when Load button is pressed
   */
  setOnLoad(callback) {
    this.onLoad = callback;
  }
}
