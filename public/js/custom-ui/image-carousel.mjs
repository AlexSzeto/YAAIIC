import { ItemNavigator } from './item-navigator.mjs';

/**
 * @deprecated ImageCarousel and ItemNavigator are both deprecated.
 * 
 * MIGRATION GUIDE:
 * Use useItemNavigation hook with PaginationControls instead:
 * 
 * OLD:
 *   import { ImageCarousel } from './image-carousel.mjs';
 *   <ImageCarousel items={images} selectedItem={current} onSelect={setImage} />
 * 
 * NEW:
 *   import { useItemNavigation } from './use-item-navigation.mjs';
 *   import { PaginationControls } from './pagination.mjs';
 *   
 *   const nav = useItemNavigation(images, current);
 *   useEffect(() => {
 *     if (nav.currentItem !== current) {
 *       setImage(nav.currentItem);
 *     }
 *   }, [nav.currentItem]);
 *   
 *   <PaginationControls
 *     currentPage={nav.currentIndex}
 *     totalPages={nav.totalItems}
 *     onNext={nav.selectNext}
 *     onPrev={nav.selectPrev}
 *     onFirst={nav.selectFirst}
 *     onLast={nav.selectLast}
 *     showFirstLast={true}
 *   />
 * 
 * This provides better separation of logic (hook) and UI (component).
 */

// Re-export ItemNavigator as ImageCarousel for backwards compatibility
export { ItemNavigator as ImageCarousel };

// Also export ItemNavigator for direct use
export { ItemNavigator };
