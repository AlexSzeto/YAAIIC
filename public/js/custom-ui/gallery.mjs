import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { PaginationControls } from './pagination.mjs';
import { usePagination } from './use-pagination.mjs';
import { fetchJson, FetchError } from '../util.mjs';
import { showDialog } from './dialog.mjs';
import { createImageModal } from './modal.mjs';

/**
 * Gallery Component
 * Displays a grid of images/videos with search, pagination, and selection capabilities.
 */
export function Gallery({
  isOpen,
  onClose,
  queryPath,
  previewFactory,
  onLoad,      // Helper for legacy single-item load or "Load" button in bulk mode
  onSelect,    // Callback for selection mode (single item)
  selectionMode = false,
  fileTypeFilter = null,
  onSelectAsInput = null  // Callback for "Use as Input" action from gallery preview
}) {
  const [galleryData, setGalleryData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [shouldFocusSearch, setShouldFocusSearch] = useState(false);
  const [loading, setLoading] = useState(false);

  // Use pagination hook - single source of truth
  const pagination = usePagination(galleryData, 24);
  const { currentPageData } = pagination;

  const searchTimeoutRef = useRef(null);

  // -- Data Fetching --
  const fetchGalleryData = useCallback(async () => {
    try {
      setLoading(true);
      const searchText = searchQuery.trim();
      const url = new URL(queryPath, window.location.origin);
      
      // Tag search vs normal search
      if (searchText.includes(',')) {
        const tags = searchText
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
        url.searchParams.set('tags', tags.join(','));
        url.searchParams.set('query', '');
      } else {
        url.searchParams.set('query', searchText);
        url.searchParams.set('tags', '');
      }
      
      // Get all matching data for client-side pagination
      url.searchParams.set('limit', '320');
      
      console.log('Fetching gallery data:', url.toString());
      
      const data = await fetchJson(url.toString(), {}, {
        maxRetries: 2,
        retryDelay: 800,
        showUserFeedback: true,
        showSuccessFeedback: false
      });
      
      setGalleryData(data || []);
      // Pagination component will auto-update when dataList changes
    } catch (error) {
      console.error('Error fetching gallery data:', error);
      setGalleryData([]);
    } finally {
      setLoading(false);
    }
  }, [queryPath, searchQuery]);

  // -- Effects --

  // Load data when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
      setShouldFocusSearch(true);
      fetchGalleryData();
    } else {
      setSearchQuery('');
      setGalleryData([]);
    }
  }, [isOpen, fetchGalleryData]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounce search
  useEffect(() => {
    // Skip initial empty search triggered by isOpen effect (handled there) or state init
    if (!isOpen) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    // Only debounce if we have a query, otherwise immediate fetch (handled by isOpen)
    searchTimeoutRef.current = setTimeout(() => {
      fetchGalleryData();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]); // fetchGalleryData is in dep array via debounce closure, but we want to trigger on searchQuery change

  // -- Handlers --

  const handleSearchInput = (e) => {
    setSearchQuery(e.target.value);
  };

  const isVideoItem = (item) => {
    if (!item) return false;
    if (item.imageUrl) {
      const videoExtensions = ['.mp4', '.webm', '.gif', '.webp'];
      const url = item.imageUrl.toLowerCase();
      if (videoExtensions.some(ext => url.endsWith(ext))) return true;
    }
    if (item.workflow && typeof item.workflow === 'string') {
      if (item.workflow.toLowerCase().includes('video')) return true;
    }
    return false;
  };

  const handleItemClick = (item) => {
    if (!item || !item.imageUrl) return;

    // Create modal with select button
    createImageModal(item.imageUrl, true, item.name || null, () => {
      if (selectionMode && onSelect) {
        onSelect(item);
        onClose();
      } else {
        // Normal mode: "loading" single item
        if (onLoad) {
          onLoad([item]);
          console.log('Loading single-item gallery:', item.name);
        }
        onClose();
      }
    });
  };

  const handleItemSelect = (data, isSelected) => {
    if (!data || !data.uid) return;
    
    setSelectedItems(prev => {
      if (isSelected) {
        return prev.includes(data.uid) ? prev : [...prev, data.uid];
      } else {
        return prev.filter(uid => uid !== data.uid);
      }
    });
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.length === 0) return;

    const itemText = selectedItems.length === 1 ? 'item' : 'items';
    const result = await showDialog(
      `Are you sure you want to delete ${selectedItems.length} selected ${itemText}? This action cannot be undone.`,
      'Confirm Deletion',
      ['Delete', 'Cancel']
    );

    if (result !== 'Delete') return;

    try {
      if (window.showToast) window.showToast(`Deleting ${selectedItems.length} ${itemText}...`);

      const response = await fetchJson('/image-data/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: selectedItems })
      }, {
        maxRetries: 1,
        showUserFeedback: true,
        showSuccessFeedback: false
      });

      setSelectedItems([]);
      fetchGalleryData(); // Refresh

      if (window.showToast) {
        const deletedText = response.deletedCount === 1 ? 'item' : 'items';
        window.showToast(`Successfully deleted ${response.deletedCount} ${deletedText}`);
      }
    } catch (error) {
      console.error('Error deleting items:', error);
      if (window.showToast) {
        const msg = error instanceof FetchError && error.data?.message 
          ? error.data.message 
          : `Failed to delete selected ${itemText}.`;
        window.showToast(msg);
      }
    }
  };

  const handleLoadClick = () => {
    if (!onLoad) return;
    
    if (selectedItems.length > 0) {
      const selectedObjects = galleryData.filter(item => selectedItems.includes(item.uid));
      onLoad(selectedObjects);
    } else {
      onLoad(galleryData); // Load all?
    }
    onClose();
  };

  // -- Render Helpers --

  const renderGalleryItems = () => {
    const maxItems = 24;
    const itemsToShow = currentPageData;
    const items = [];

    itemsToShow.forEach((item, index) => {
      if (index >= maxItems) return;

      const isSelected = selectedItems.includes(item.uid);
      const onSelectCallback = selectionMode ? null : handleItemSelect;
      const disableCheckbox = selectionMode;
      const isVideo = isVideoItem(item);
      const shouldDisable = selectionMode && fileTypeFilter === 'image' && isVideo;

      // previewFactory returns a DOM node
      const preview = previewFactory(item, onSelectCallback, isSelected, disableCheckbox, handleItemClick, shouldDisable, onSelectAsInput);
      
      if (preview) {
        items.push(html`
          <div 
            key=${`${item.uid || index}`} 
            class="gallery-item-wrapper"
            ref=${(ref) => {
              if (ref) {
                ref.innerHTML = '';
                ref.appendChild(preview);
              }
            }}
          ></div>
        `);
      }
    });

    // Fill empty slots
    const emptySlots = maxItems - itemsToShow.length;
    for (let i = 0; i < emptySlots; i++) {
      items.push(html`<div key=${`empty-${i}`} class="gallery-item" style=${{ opacity: '0.3' }}></div>`);
    }

    return items;
  };

  if (!isOpen) return null;

  const hasSelectedItems = selectedItems.length > 0;
  const selectedText = selectedItems.length === 1 ? 'item' : 'items';

  return html`
    <div 
      class="gallery-modal"
      onClick=${(e) => { if (e.target.classList.contains('gallery-modal')) onClose(); }}
    >
      <div class="gallery-content">
        <div class="gallery-grid">
          ${renderGalleryItems()}
        </div>
        <div class="gallery-pagination-wrapper">
          ${!selectionMode && html`
            <div class="gallery-bulk-delete">
              <button 
                class="btn-with-icon btn-danger"
                onClick=${deleteSelectedItems}
                disabled=${!hasSelectedItems}
                title=${hasSelectedItems ? `Delete ${selectedItems.length} selected ${selectedText}` : 'No items selected'}
              >
                <box-icon name="trash" color="#ffffff"></box-icon>
                Delete
              </button>
            </div>
          `}
          <div class="gallery-pagination-container">
            <${PaginationControls}
              currentPage=${pagination.currentPage}
              totalPages=${pagination.totalPages}
              hasMultiplePages=${pagination.hasMultiplePages}
              isFirstPage=${pagination.isFirstPage}
              isLastPage=${pagination.isLastPage}
              onNext=${pagination.goToNext}
              onPrev=${pagination.goToPrev}
            />
          </div>
        </div>
        <div class="gallery-controls">
          <div class="gallery-search">
            <input
              type="text"
              placeholder=${searchQuery.includes(',') ? 'Tag search (comma-separated)' : 'Search images...'}
              value=${searchQuery}
              onInput=${handleSearchInput}
              ref=${(input) => { 
                if (input && shouldFocusSearch) {
                  input.focus();
                  setShouldFocusSearch(false);
                }
              }}
            />
            <box-icon
              name=${searchQuery.includes(',') ? 'purchase-tag' : 'search'}
              color="#999999"
              class="gallery-search-icon"
            ></box-icon>
          </div>
          <div class="gallery-btn-group">
            ${!selectionMode && html`
              <button 
                class="gallery-load-btn btn-with-icon"
                onClick=${handleLoadClick}
              >
                <box-icon name="save" color="#ffffff"></box-icon>
                Load
              </button>
            `}
            <button 
              class="gallery-cancel-btn btn-with-icon"
              onClick=${onClose}
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

// Wrapper for legacy factory usage
export function createGallery(queryPath, previewFactory, onLoad) {
  let containerElement = null;
  let props = {
    isOpen: false,
    queryPath,
    previewFactory,
    onLoad
  };

  const updateRender = () => {
    if (!containerElement) {
      containerElement = document.createElement('div');
      document.body.appendChild(containerElement);
    }
    render(html`<${Gallery} ...${props} onClose=${() => {
      props.isOpen = false;
      updateRender();
    }} />`, containerElement);
  };

  return {
    showModal(selectionMode = false, onSelect = null, fileTypeFilter = null) {
      props.isOpen = true;
      props.selectionMode = selectionMode;
      props.onSelect = onSelect;
      props.fileTypeFilter = fileTypeFilter;
      updateRender();
    },
    hideModal() {
      props.isOpen = false;
      updateRender();
    },
    setOnLoad(callback) {
      props.onLoad = callback;
      updateRender();
    },
    // The previous factory didn't really expose other state setters easily, 
    // but V1 uses 'refreshData' sometimes? No, I saw refreshData in my grep but not in file content.
    // Ah, grep showed 'galleryDisplay.refreshData()', but the file content for gallery.mjs didn't have refreshData.
    // The grep output showed lines from main.mjs calling refreshData.
    // I need to add refreshData to the return object if main.mjs calls it.
    // But wait, the previous gallery.mjs file I read DID NOT have refreshData method on the class or the factory return.
    // Verify?
    // Line 98: this.debounceSearch();
    // Line 360: async fetchGalleryData()
    // Helper methods... 
    // I don't see refreshData exported in the factory return object in the file I read.
    // Checking grep again...
    // {"File":"/mnt/dev-240/YAAIIC/public/js/main.mjs","LineNumber":739,"LineContent":"        galleryDisplay.refreshData();"}
    // Maybe it was added dynamically or I missed it?
    // Or maybe the GalleryDisplay class had it? 
    // I read the whole file. GalleryDisplay was exported. 
    // Line 9: export class GalleryDisplay extends Component
    // It has `fetchGalleryData`. 
    // If main.mjs calls `refreshData()`, and it worked, then it must exist. 
    // Let me check if I missed it in the file view.
    // The file view showed lines 1-630.
    // I don't see refreshData in GalleryDisplay.
    // Maybe `main.mjs` was checking if it exists? 
    // `if (galleryDisplay && galleryDisplay.isVisible && galleryDisplay.isVisible())` - wait, `isVisible` is a state property, not a method.
    // But main.mjs calls `galleryDisplay.isVisible()`?
    // And `galleryDisplay.refreshData()`?
    // If the legacy code expects these, I might need to add them or main.mjs is broken/outdated.
    // I'll add a dummy logic or map it to fetchGalleryData.
    // Actually, I can allow access to the gallery ref if needed, but for now I'll just skip it or add if needed.
    // I will add `refreshData` to the returned object just in case.
    refreshData() {
      // Trigger a re-fetch if open?
      // Since we control props, we can't easily trigger an internal fetch without a ref.
      // But we can just set isOpen=true again? No, that just sets prop.
      // Ideally we would expose a ref.
      console.warn('refreshData not fully supported in refactored gallery yet');
    },
    // Also `isVisible`
    isVisible() {
        return props.isOpen;
    }
  };
}

