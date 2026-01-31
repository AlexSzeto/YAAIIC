import { useState, useMemo, useCallback } from 'preact/hooks';

/**
 * Custom hook for item-centric navigation logic.
 * Manages selected item state and provides navigation through items array.
 * 
 * @param {Array} items - Array of items to navigate
 * @param {*} [initialItem] - Initial selected item (optional, defaults to first item)
 * @param {Function} [compareItems] - Custom equality function (a, b) => boolean. Default compares by reference or url property
 * @returns {Object} Item navigation state and controls
 * @returns {*} returns.currentItem - Currently selected item
 * @returns {number} returns.currentIndex - Zero-based index of current item
 * @returns {number} returns.totalItems - Total number of items
 * @returns {boolean} returns.hasMultipleItems - True if more than one item
 * @returns {boolean} returns.isFirstItem - True if on first item
 * @returns {boolean} returns.isLastItem - True if on last item
 * @returns {function(): void} returns.selectNext - Navigate to next item
 * @returns {function(): void} returns.selectPrev - Navigate to previous item
 * @returns {function(): void} returns.selectFirst - Navigate to first item
 * @returns {function(): void} returns.selectLast - Navigate to last item
 * @returns {function(*): void} returns.selectItem - Select specific item by reference
 * @returns {function(number): void} returns.selectByIndex - Select item by index
 * 
 * @example
 * // Basic usage
 * const nav = useItemNavigation(images, currentImage);
 * // nav.currentItem is the selected image
 * // nav.selectNext() moves to next image
 * 
 * @example
 * // With custom comparison
 * const nav = useItemNavigation(users, currentUser, (a, b) => a.id === b.id);
 * 
 * @example
 * // Migration from ItemNavigator (item mode):
 * // BEFORE:
 * // <ItemNavigator 
 * //   items={images} 
 * //   selectedItem={current}
 * //   onSelect={(item) => setCurrent(item)}
 * //   showFirstLast={true}
 * // />
 * //
 * // AFTER:
 * // const nav = useItemNavigation(images, current);
 * // useEffect(() => {
 * //   if (nav.currentItem !== current) {
 * //     setCurrent(nav.currentItem);
 * //   }
 * // }, [nav.currentItem]);
 * // 
 * // <Navigator
 * //   currentIndex={nav.currentIndex}
 * //   totalItems={nav.totalItems}
 * //   onNext={nav.selectNext}
 * //   onPrev={nav.selectPrev}
 * //   onFirst={nav.selectFirst}
 * //   onLast={nav.selectLast}
 * //   showFirstLast={true}
 * // />
 */
export function useItemNavigation(items = [], initialItem, compareItems) {
  // Default comparison: by reference or by url property (for legacy support)
  const defaultCompare = useCallback((a, b) => {
    return a === b || (a?.url && b?.url && a.url === b.url);
  }, []);
  
  const compare = compareItems || defaultCompare;
  
  // Find initial index
  const getInitialIndex = () => {
    if (!items.length) return 0;
    if (!initialItem) return 0;
    const index = items.findIndex(item => compare(item, initialItem));
    return index === -1 ? 0 : index;
  };
  
  const [currentIndex, setCurrentIndex] = useState(getInitialIndex);
  
  // Auto-adjust index if items array changes
  const safeIndex = Math.min(currentIndex, Math.max(0, items.length - 1));
  
  // Sync internal index if it was clamped
  if (safeIndex !== currentIndex && items.length > 0) {
    setCurrentIndex(safeIndex);
  }
  
  // Derive current item
  const currentItem = items.length > 0 ? items[safeIndex] : null;
  
  // Navigation functions
  const selectNext = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, items.length - 1));
  }, [items.length]);
  
  const selectPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }, []);
  
  const selectFirst = useCallback(() => {
    setCurrentIndex(0);
  }, []);
  
  const selectLast = useCallback(() => {
    setCurrentIndex(items.length - 1);
  }, [items.length]);
  
  const selectItem = useCallback((item) => {
    const index = items.findIndex(i => compare(i, item));
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [items, compare]);
  
  const selectByIndex = useCallback((index) => {
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    setCurrentIndex(clamped);
  }, [items.length]);
  
  return {
    currentItem,
    currentIndex: safeIndex,
    totalItems: items.length,
    hasMultipleItems: items.length > 1,
    isFirstItem: safeIndex === 0,
    isLastItem: safeIndex >= items.length - 1,
    selectNext,
    selectPrev,
    selectFirst,
    selectLast,
    selectItem,
    selectByIndex,
  };
}
