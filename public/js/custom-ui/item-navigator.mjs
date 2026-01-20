import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { Button } from './button.mjs';

/**
 * ItemNavigator - Unified navigation for selecting items from a list
 * 
 * Combines features from ImageCarousel and PaginationControls into a single
 * component with item-centric API and optional enhanced navigation features.
 * 
 * Can operate in two modes:
 * 1. Item mode (default): Navigate through actual items with selectedItem
 * 2. Page mode: Navigate through pages with currentPage/totalPages (stateless, like PaginationControls)
 * 
 * @param {Object} props
 * 
 * --- Item Mode Props (default) ---
 * @param {Array} [props.items] - Array of items to navigate
 * @param {*} [props.selectedItem] - Currently selected item from the items array
 * @param {Function} [props.onSelect] - Callback when an item is selected: (item, index) => void
 * @param {Function} [props.compareItems] - Custom equality function: (a, b) => boolean. Default compares by reference or url property
 * 
 * --- Page Mode Props (alternative to item mode) ---
 * @param {number} [props.currentPage] - Current zero-based page index (for page mode)
 * @param {number} [props.totalPages] - Total number of pages (for page mode)
 * @param {Function} [props.onNext] - Handler for next page (for page mode)
 * @param {Function} [props.onPrev] - Handler for previous page (for page mode)
 * @param {Function} [props.onFirst] - Handler for first page (for page mode, optional)
 * @param {Function} [props.onLast] - Handler for last page (for page mode, optional)
 * 
 * --- Common Props ---
 * @param {string} [props.emptyMessage='No items'] - Message shown when items array is empty or totalPages is 0
 * @param {boolean} [props.showFirstLast=false] - Show first/last jump buttons
 * @param {boolean} [props.enableKeyboard=false] - Enable keyboard navigation (Arrow keys, Home/End)
 * @returns {preact.VNode}
 * 
 * @example
 * // Item mode - Basic usage
 * <ItemNavigator 
 *   items={images}
 *   selectedItem={currentImage}
 *   onSelect={(item) => setCurrentImage(item)}
 * />
 * 
 * @example
 * // Item mode - With enhanced features
 * <ItemNavigator 
 *   items={images}
 *   selectedItem={currentImage}
 *   onSelect={(item, index) => setCurrentImage(item)}
 *   showFirstLast={true}
 *   enableKeyboard={true}
 *   compareItems={(a, b) => a.id === b.id}
 * />
 * 
 * @example
 * // Page mode - Drop-in replacement for PaginationControls
 * <ItemNavigator 
 *   currentPage={pagination.currentPage}
 *   totalPages={pagination.totalPages}
 *   onNext={pagination.goToNext}
 *   onPrev={pagination.goToPrev}
 * />
 * 
 * @example
 * // Page mode - With first/last buttons
 * <ItemNavigator 
 *   currentPage={pagination.currentPage}
 *   totalPages={pagination.totalPages}
 *   onNext={pagination.goToNext}
 *   onPrev={pagination.goToPrev}
 *   onFirst={pagination.goToFirst}
 *   onLast={pagination.goToLast}
 *   showFirstLast={true}
 * />
 */
export class ItemNavigator extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value
    };
    this.containerRef = null;
  }

  /**
   * Detect if component is in page mode or item mode
   * Page mode: has currentPage/totalPages props
   * Item mode: has items/selectedItem props
   */
  isPageMode() {
    const { currentPage, totalPages } = this.props;
    return currentPage !== undefined && totalPages !== undefined;
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
    
    // Set up keyboard navigation if enabled
    if (this.props.enableKeyboard && this.containerRef) {
      this.containerRef.addEventListener('keydown', this.handleKeyDown);
      this.containerRef.setAttribute('tabindex', '0');
    }
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.containerRef) {
      this.containerRef.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  componentDidUpdate(prevProps) {
    // Handle keyboard listener setup/teardown when enableKeyboard changes
    if (prevProps.enableKeyboard !== this.props.enableKeyboard) {
      if (this.props.enableKeyboard && this.containerRef) {
        this.containerRef.addEventListener('keydown', this.handleKeyDown);
        this.containerRef.setAttribute('tabindex', '0');
      } else if (this.containerRef) {
        this.containerRef.removeEventListener('keydown', this.handleKeyDown);
        this.containerRef.removeAttribute('tabindex');
      }
    }
  }

  handleKeyDown = (e) => {
    if (this.isPageMode()) {
      // Page mode keyboard navigation
      const { currentPage, totalPages, onPrev, onNext, onFirst, onLast } = this.props;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentPage > 0 && onPrev) {
            onPrev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentPage < totalPages - 1 && onNext) {
            onNext();
          }
          break;
        case 'Home':
          e.preventDefault();
          if (currentPage !== 0 && onFirst) {
            onFirst();
          }
          break;
        case 'End':
          e.preventDefault();
          if (currentPage !== totalPages - 1 && onLast) {
            onLast();
          }
          break;
      }
    } else {
      // Item mode keyboard navigation
      const { items, onSelect } = this.props;
      const currentIndex = this.getCurrentIndex();
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            onSelect(items[currentIndex - 1], currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            onSelect(items[currentIndex + 1], currentIndex + 1);
          }
          break;
        case 'Home':
          e.preventDefault();
          if (currentIndex !== 0) {
            onSelect(items[0], 0);
          }
          break;
        case 'End':
          e.preventDefault();
          if (currentIndex !== items.length - 1) {
            onSelect(items[items.length - 1], items.length - 1);
          }
          break;
      }
    }
  }

  /**
   * Default item comparison: by reference or by url property (for legacy support)
   */
  defaultCompareItems = (a, b) => {
    return a === b || (a?.url && b?.url && a.url === b.url);
  }

  getCurrentIndex() {
    const { items = [], selectedItem, compareItems } = this.props;
    const compare = compareItems || this.defaultCompareItems;
    const index = items.findIndex(item => compare(item, selectedItem));
    return index === -1 ? 0 : index;
  }

  handlePrev = () => {
    if (this.isPageMode()) {
      const { onPrev } = this.props;
      if (onPrev) onPrev();
    } else {
      const { items, onSelect } = this.props;
      const currentIndex = this.getCurrentIndex();
      if (currentIndex > 0) {
        onSelect(items[currentIndex - 1], currentIndex - 1);
      }
    }
  }

  handleNext = () => {
    if (this.isPageMode()) {
      const { onNext } = this.props;
      if (onNext) onNext();
    } else {
      const { items, onSelect } = this.props;
      const currentIndex = this.getCurrentIndex();
      if (currentIndex < items.length - 1) {
        onSelect(items[currentIndex + 1], currentIndex + 1);
      }
    }
  }

  handleFirst = () => {
    if (this.isPageMode()) {
      const { onFirst } = this.props;
      if (onFirst) onFirst();
    } else {
      const { items, onSelect } = this.props;
      const currentIndex = this.getCurrentIndex();
      if (currentIndex !== 0 && items.length > 0) {
        onSelect(items[0], 0);
      }
    }
  }

  handleLast = () => {
    if (this.isPageMode()) {
      const { onLast } = this.props;
      if (onLast) onLast();
    } else {
      const { items, onSelect } = this.props;
      const currentIndex = this.getCurrentIndex();
      const lastIndex = items.length - 1;
      if (currentIndex !== lastIndex && items.length > 0) {
        onSelect(items[lastIndex], lastIndex);
      }
    }
  }

  render() {
    const { 
      emptyMessage = 'No items',
      showFirstLast = false,
      enableKeyboard = false
    } = this.props;
    const { theme } = this.state;

    const Container = styled('div')`
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    const Nav = styled('div')`
      display: flex;
      align-items: center;
      gap: ${theme.spacing.small.gap};
    `;

    const PageIndex = styled('div')`
      font-size: ${theme.typography.fontSize.medium};
      font-weight: ${theme.typography.fontWeight.medium};
      color: ${theme.colors.text.primary};
      min-width: 60px;
      text-align: center;
    `;

    const EmptyMessage = styled('div')`
      text-align: center;
      color: ${theme.colors.text.secondary};
      padding: 20px;
    `;

    // Determine mode and get navigation state
    let currentIndex, totalItems, isFirstItem, isLastItem;
    
    if (this.isPageMode()) {
      // Page mode
      const { currentPage = 0, totalPages = 0 } = this.props;
      currentIndex = currentPage;
      totalItems = totalPages;
      isFirstItem = currentPage === 0;
      isLastItem = currentPage >= totalPages - 1;
      
      if (totalPages === 0) {
        return html`<${EmptyMessage}>${emptyMessage}<//>`;
      }
    } else {
      // Item mode
      const { items = [] } = this.props;
      
      if (items.length === 0) {
        return html`<${EmptyMessage}>${emptyMessage}<//>`;
      }
      
      currentIndex = this.getCurrentIndex();
      totalItems = items.length;
      isFirstItem = currentIndex === 0;
      isLastItem = currentIndex >= totalItems - 1;
    }

    return html`
      <${Container}
        role="navigation"
        aria-label=${this.isPageMode() ? "Page navigation" : "Item navigation"}
        ref=${(ref) => { this.containerRef = ref; }}
      >
        <${Nav}>
          ${showFirstLast ? html`
            <${Button} 
              variant="medium-icon" 
              color="secondary"
              icon="chevrons-left" 
              onClick=${this.handleFirst} 
              disabled=${isFirstItem}
              title=${this.isPageMode() ? "First page" : "First item"}
              aria-label=${this.isPageMode() ? "Go to first page" : "Go to first item"}
            />
          ` : ''}
          
          <${Button} 
            variant="medium-icon" 
            color="secondary"
            icon="chevron-left" 
            onClick=${this.handlePrev} 
            disabled=${isFirstItem}
            title=${this.isPageMode() ? "Previous page" : "Previous item"}
            aria-label=${this.isPageMode() ? "Go to previous page" : "Go to previous item"}
          />
          
          <${PageIndex} aria-live="polite">
            <span>${currentIndex + 1}</span> / <span>${totalItems}</span>
          <//>
          
          <${Button} 
            variant="medium-icon" 
            color="secondary"
            icon="chevron-right" 
            onClick=${this.handleNext} 
            disabled=${isLastItem}
            title=${this.isPageMode() ? "Next page" : "Next item"}
            aria-label=${this.isPageMode() ? "Go to next page" : "Go to next item"}
          />
          
          ${showFirstLast ? html`
            <${Button} 
              variant="medium-icon" 
              color="secondary"
              icon="chevrons-right" 
              onClick=${this.handleLast} 
              disabled=${isLastItem}
              title=${this.isPageMode() ? "Last page" : "Last item"}
              aria-label=${this.isPageMode() ? "Go to last page" : "Go to last item"}
            />
          ` : ''}
        <//>
      <//>
    `;
  }
}
