import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { NavigatorControl as PaginationControls } from '../custom-ui/nav/navigator.mjs';
import { usePagination } from '../custom-ui/nav/use-pagination.mjs';
import { fetchJson, FetchError } from '../util.mjs';
import { showDialog } from '../custom-ui/overlays/dialog.mjs';
import { createImageModal } from '../custom-ui/overlays/modal.mjs';
import { showFolderSelect } from './folder-select.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Icon } from '../custom-ui/layout/icon.mjs';
import { HorizontalLayout } from '../custom-ui/themed-base.mjs';

// Styled Components
const ModalOverlay = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${() => currentTheme.value.colors.overlay.backgroundStrong};
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;
ModalOverlay.className = 'modal-overlay';

const Content = styled('div')`
  background-color: ${() => currentTheme.value.colors.background.secondary};
  border: ${() => currentTheme.value.border.width} ${() => currentTheme.value.border.style} ${() => currentTheme.value.colors.border.secondary};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  padding: 20px;
  width: 90vw;
  max-width: 2000px;
  max-height: 90vh;
  overflow: auto;
  position: relative;
`;
Content.className = 'content';
Content.className = 'content';

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(8, minmax(100px, 1fr));
  grid-template-rows: repeat(3, minmax(100px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
  min-height: 400px;
  justify-content: center;
  margin-left: auto;
  margin-right: auto;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(6, minmax(100px, 1fr));
    max-width: 900px;
  }

  @media (max-width: 900px) {
    grid-template-columns: repeat(4, minmax(100px, 1fr));
    max-width: 600px;
  }

  @media (max-width: 600px) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
    max-width: 450px;
  }
`;
Grid.className = 'grid';

const ItemWrapper = styled('div')`
  aspect-ratio: 1;
  border: ${() => currentTheme.value.border.width} ${() => currentTheme.value.border.style} ${() => currentTheme.value.colors.border.focus};
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  overflow: hidden;
  cursor: pointer;
  transition: transform ${() => currentTheme.value.transitions.fast}, 
              border-color ${() => currentTheme.value.transitions.fast};
  background-color: ${() => currentTheme.value.colors.background.card};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  opacity: ${props => props.opacity || '1'};

  &:hover {
    transform: scale(1.05);
    border-color: ${() => currentTheme.value.colors.border.highlight};
  }

  ${props => props.disabled ? `
    opacity: 0.4;
    pointer-events: none;
  ` : ''}

  img, canvas {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    border-radius: 3px;
  }
`;
ItemWrapper.className = 'item-wrapper';

const ItemInfo = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  padding: 8px 10px;
  margin-right: 0;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.primary};
  display: flex;
  flex-direction: ${props => props.hasAudio ? 'row' : 'column'};
  gap: ${props => props.hasAudio ? '8px' : '2px'};
  pointer-events: none;
  max-width: calc(100% - 12px);
  box-sizing: border-box;
`;
ItemInfo.className = 'item-info';
ItemInfo.className = 'item-info';

const AudioButtonContainer = styled('div')`
  pointer-events: auto;
  flex-shrink: 0;
`;
AudioButtonContainer.className = 'audio-button-container';

const ItemTextContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;
ItemTextContent.className = 'item-text-content';

const ItemName = styled('div')`
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  font-size: 13px;
  color: ${() => currentTheme.value.colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
`;
ItemName.className = 'item-name';

const ItemDate = styled('div')`
  font-size: 11px;
  color: ${() => currentTheme.value.colors.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
`;
ItemDate.className = 'item-date';

const CheckboxContainer = styled('div')`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
`;
CheckboxContainer.className = 'checkbox-container';
CheckboxContainer.className = 'checkbox-container';
CheckboxContainer.className = 'checkbox-container';

const PaginationWrapper = styled('div')`
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
`;
PaginationWrapper.className = 'pagination-wrapper';

const PaginationContainer = styled('div')`
  flex-grow: 1;
  display: flex;
  justify-content: center;
`;
PaginationContainer.className = 'pagination-container';

const BulkActions = styled('div')`
  display: flex;
  align-items: center;
  position: absolute;
`;
BulkActions.className = 'bulk-actions';

const Controls = styled('div')`
  display: flex;
  align-items: center;
  gap: 15px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
  }
`;
Controls.className = 'controls';

const SearchContainer = styled('div')`
  flex: 1;
`;
SearchContainer.className = 'search-container';

const ButtonGroup = styled('div')`
  display: flex;
  gap: 10px;
`;
ButtonGroup.className = 'button-group';

/**
 * Gallery Component
 * 
 * Displays a full-screen modal with a grid of media items (images/videos/audio) with search,
 * pagination, and selection capabilities. Supports both selection mode (for picking items)
 * and viewing mode (for browsing and managing media).
 * 
 * Features:
 * - Search by text or comma-separated tags
 * - Pagination (24 items per page)
 * - Bulk selection with delete and move operations
 * - Click to view full-screen media
 * - Optional folder filtering
 * - Responsive grid layout (8/6/4/3 columns based on screen width)
 * - Keyboard support (Escape to close)
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility (required)
 * @param {Function} props.onClose - Callback when modal is closed (required)
 * @param {string} props.queryPath - API endpoint for fetching gallery data (required)
 * @param {Function} props.previewFactory - Function that creates preview DOM nodes for items (required)
 * @param {Function} [props.onLoad] - Callback for "View" button or single-item load in viewing mode
 * @param {Function} [props.onSelect] - Callback for selection mode when item is selected
 * @param {boolean} [props.selectionMode=false] - If true, enables selection mode (single-select)
 * @param {string|Array<string>|null} [props.fileTypeFilter=null] - Filter allowed types in selection mode
 * @param {Function} [props.onSelectAsInput=null] - Callback for "Use as Input" action from gallery preview
 * @param {string} [props.folder] - Optional folder UID to filter results
 * @returns {preact.VNode|null}
 * 
 * @example
 * // Viewing mode with search and bulk operations
 * <Gallery
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   queryPath="/media-data"
 *   previewFactory={createPreview}
 *   onLoad={(items) => console.log('Loading', items)}
 * />
 * 
 * @example
 * // Selection mode for picking a single image
 * <Gallery
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   queryPath="/media-data"
 *   previewFactory={createPreview}
 *   selectionMode={true}
 *   fileTypeFilter="image"
 *   onSelect={(item) => console.log('Selected', item)}
 * />
 */
export function Gallery({
  isOpen,
  onClose,
  queryPath,
  previewFactory,
  onLoad,      // Helper for legacy single-item load or "Load" button in bulk mode
  onSelect,    // Callback for selection mode (single item)
  selectionMode = false,
  fileTypeFilter = null, // Legacy: string like 'image' or array of allowed types like ['image', 'video']
  onSelectAsInput = null,  // Callback for "Use as Input" action from gallery preview
  folder = undefined  // Optional folder filter (uid)
}) {
  const [galleryData, setGalleryData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('description'); // 'description' or 'tag'
  const [selectedItems, setSelectedItems] = useState([]);
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
      
      // Tag search vs normal search based on mode
      if (searchMode === 'tag' && searchText) {
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
      
      // Add folder filter if provided
      if (folder !== undefined) {
        url.searchParams.set('folder', folder);
      }
      
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
  }, [queryPath, searchQuery, folder]);

  // -- Effects --

  // Load data when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
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

  // Handle search input focus
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
  }, [searchQuery, searchMode]); // fetchGalleryData is in dep array via debounce closure, but we want to trigger on searchQuery or searchMode change

  // -- Handlers --

  const handleSearchInput = (e) => {
    setSearchQuery(e.target.value);
  };

  const toggleSearchMode = () => {
    setSearchMode(prevMode => prevMode === 'description' ? 'tag' : 'description');
  };

  /**
   * Check if media should be disabled for selection based on allowed types
   * @param {Object} mediaEntry - The media data entry
   * @param {Array<string>|string|null} allowedTypes - Array of allowed types or legacy string
   * @returns {boolean} - True if should be disabled
   */
  const shouldDisableMediaForSelection = (mediaEntry, allowedTypes) => {
    if (!mediaEntry || !allowedTypes) return false;
    
    // Convert legacy string format to array
    const typesArray = typeof allowedTypes === 'string' ? [allowedTypes] : allowedTypes;
    
    // Get media type from entry (defaults to 'image' for backwards compatibility)
    const mediaType = mediaEntry.type || 'image';
    
    // Return true if media type is NOT in the allowed types array
    return !typesArray.includes(mediaType);
  };

  const handleItemClick = (item) => {
    if (!item || !item.imageUrl) return;

    // Create modal with select button - text changes based on mode
    const buttonText = selectionMode ? 'Select' : 'View';
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
    }, buttonText);
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

      const response = await fetchJson('/media-data/delete', {
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

  // -- Move Selected Items --
  const moveSelectedItems = async () => {
    if (!selectedItems || selectedItems.length === 0) return;

    showFolderSelect(async (selectedFolderId) => {
      try {
        // Prepare array of updated items with new folder
        const updates = selectedItems.map(uid => {
          const fullItem = galleryData.find(data => data.uid === uid);
          if (!fullItem) {
            console.error(`Could not find item with uid: ${uid}`);
            return null;
          }
          return {
            ...fullItem,
            folder: selectedFolderId
          };
        }).filter(item => item !== null); // Remove any null entries

        if (updates.length === 0) {
          if (window.showToast) {
            window.showToast('No valid items to move');
          }
          return;
        }

        console.log('Moving items:', updates.map(u => ({ uid: u.uid, folder: u.folder })));

        // Call edit endpoint with array
        const response = await fetchJson('/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (response.success) {
          const movedText = selectedItems.length === 1 ? 'item' : 'items';
          if (window.showToast) {
            window.showToast(`Successfully moved ${selectedItems.length} ${movedText}`);
          }
          
          // Clear selection
          setSelectedItems([]);
          
          // Refresh gallery data
          await fetchGalleryData();
        }
      } catch (error) {
        console.error('Failed to move items:', error);
        if (window.showToast) {
          const itemText = selectedItems.length === 1 ? 'item' : 'items';
          const msg = error instanceof FetchError && error.data?.message 
            ? error.data.message 
            : `Failed to move selected ${itemText}.`;
          window.showToast(msg);
        }
      }
    });
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
      const shouldDisable = selectionMode && shouldDisableMediaForSelection(item, fileTypeFilter);

      // previewFactory returns a DOM node
      const preview = previewFactory(item, onSelectCallback, isSelected, disableCheckbox, handleItemClick, shouldDisable, onSelectAsInput);
      
      if (preview) {
        items.push(html`
          <${ItemWrapper}
            key=${`${item.uid || index}`}
            disabled=${shouldDisable}
            ref=${(ref) => {
              if (ref) {
                // Goober styled components: access DOM element via .base property
                const element = ref.base || ref;
                if (element) {
                  element.innerHTML = '';
                  element.appendChild(preview);
                }
              }
            }}
          />
        `);
      }
    });

    // Fill empty slots
    const emptySlots = maxItems - itemsToShow.length;
    for (let i = 0; i < emptySlots; i++) {
      items.push(html`<${ItemWrapper} key=${`empty-${i}`} opacity="0.3" />`);
    }

    return items;
  };

  if (!isOpen) return null;

  const hasSelectedItems = selectedItems.length > 0;
  const selectedText = selectedItems.length === 1 ? 'item' : 'items';

  return html`
    <${ModalOverlay}
      onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <${Content}>
        <${Grid}>
          ${renderGalleryItems()}
        <//>
        <${PaginationWrapper}>
          <${HorizontalLayout}>
          ${!selectionMode && html`
              <${Button}
                variant="medium-icon-text"
                color=${hasSelectedItems ? 'danger' : 'secondary'}
                onClick=${deleteSelectedItems}
                disabled=${!hasSelectedItems}
                title=${hasSelectedItems ? `Delete ${selectedItems.length} selected ${selectedText}` : 'No items selected'}
                icon="trash"
              >
                Delete
              <//>
              <${Button}
                variant="medium-icon-text"
                color=${hasSelectedItems ? 'primary' : 'secondary'}
                onClick=${moveSelectedItems}
                disabled=${!hasSelectedItems}
                title=${hasSelectedItems ? `Move ${selectedItems.length} selected ${selectedText} to folder` : 'No items selected'}
                icon="folder"
              >
                Move
              <//>
          `}
            <${PaginationControls}
              currentPage=${pagination.currentPage}
              totalPages=${pagination.totalPages}
              hasMultiplePages=${pagination.hasMultiplePages}
              isFirstPage=${pagination.isFirstPage}
              isLastPage=${pagination.isLastPage}
              onNext=${pagination.goToNext}
              onPrev=${pagination.goToPrev}
              onFirst=${pagination.goToFirst}
              onLast=${pagination.goToLast}
              showFirstLast=${true}
            />
          </${HorizontalLayout}>
        <//>
        <${Controls}>
          <${SearchContainer}>
            <${HorizontalLayout} gap="small">
              <${Button}
                variant="large-icon"
                icon=${searchMode === 'tag' ? 'tags' : 'search'}
                title=${searchMode === 'tag' ? 'Switch to description search' : 'Switch to tag search'}
                onClick=${toggleSearchMode}
              />
              <${Input}
                type="text"
                placeholder=${searchMode === 'tag' ? 'Tag search (comma-separated)' : 'Search images...'}
                value=${searchQuery}
                onInput=${handleSearchInput}
                fullWidth=${true}
              />
            </${HorizontalLayout}>
          <//>
          <${ButtonGroup}>
            ${!selectionMode && html`
              <${Button}
                variant="medium-icon-text"
                color="secondary"
                onClick=${handleLoadClick}
                icon="show"
              >
                View
              <//>
            `}
            <${Button}
              variant="medium-icon-text"
              color="secondary"
              onClick=${onClose}
              icon="x"
            >
              Cancel
            <//>
          <//>
        <//>
      <//>
    <//>
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
