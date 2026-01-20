import { ItemNavigator } from './item-navigator.mjs';

/**
 * @deprecated Use ItemNavigator instead. ImageCarousel is now a thin wrapper for backwards compatibility.
 * 
 * ImageCarousel - Carousel navigation for selecting items from a list
 * 
 * This component is deprecated. Use ItemNavigator for new code.
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of items (objects with url property, or strings)
 * @param {*} props.selectedItem - Currently selected item from the items array
 * @param {Function} props.onSelect - Callback when an item is selected, receives (item, index)
 * @param {string} [props.emptyMessage='No items'] - Message shown when items array is empty
 * @returns {preact.VNode}
 * 
 * @example
 * // Migration: Replace ImageCarousel with ItemNavigator
 * // Old:
 * <ImageCarousel items={images} selectedItem={current} onSelect={setImage} />
 * 
 * // New:
 * <ItemNavigator items={images} selectedItem={current} onSelect={setImage} />
 */
export { ItemNavigator as ImageCarousel };

// Also export ItemNavigator for direct use
export { ItemNavigator };
