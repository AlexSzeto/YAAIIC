# Pagination Refactor
[x] Create a carousel-style pagination component in `public/js/custom-ui/pagination.js` with the following features:
1. Accept only three props: `dataList` (Array of any data), `itemsPerPage` (number), and `updateDisplay(displayDataList)` callback.
2. Manage all internal state including `currentPage`, `totalPages`, and data slicing logic within the component.
3. Automatically slice the `dataList` based on current page and `itemsPerPage`, then call `updateDisplay()` with the current page's data.
4. Use the existing carousel design pattern: previous button (caret-left icon), current/total index display, next button (caret-right icon).
5. Include proper disabled states for prev/next buttons when at first/last page.
6. Implement proper accessibility attributes (ARIA labels, roles) and keyboard navigation support.
7. Use consistent styling patterns with existing custom-ui components and match the current carousel appearance.
8. Support both single-item navigation (itemsPerPage=1 for carousel) and multi-item navigation (itemsPerPage>1 for gallery).

[x] Refactor `CarouselDisplay` in `carousel-setup.js` to use the new pagination component:
1. Remove the hardcoded carousel navigation elements from the constructor validation (`.carousel-prev`, `.carousel-next`, `.current-index`, `.total-count`).
2. Replace the inline navigation logic with an instance of the pagination component.
3. Pass the complete `dataList` to pagination and set `itemsPerPage` to 1 for item-by-item carousel navigation.
4. Use pagination's `updateDisplay()` callback to receive the current item and update the data display.
5. Preserve existing behavior including current item tracking by `name` and `timestamp` within the pagination callback.
6. Remove the manual `updateDisplay()` method since pagination component handles navigation state.

[x] Update `public/index.html` to remove hardcoded carousel navigation elements:
1. Remove the `.carousel-prev`, `.carousel-next`, `.current-index`, and `.total-count` elements from the carousel controls section.
2. Add a pagination container div with id `carouselPagination` within the carousel display area.
3. Ensure the carousel display container structure supports dynamic pagination component rendering.

[x] Enhance `GalleryDisplay` in `gallery.js` to use carousel-style pagination:
1. Remove server-side pagination logic and use the full `galleryData` array with the pagination component.
2. Pass the complete `galleryData` to the pagination component and set an appropriate `itemsPerPage` (e.g., 32).
3. Use pagination's `updateDisplay()` callback to receive the current page's items and update the gallery grid.
4. Integrate the pagination component below the gallery grid, using the same prev/next/index design for consistency.
5. When search functionality changes the data, pass the new filtered `galleryData` to the pagination component.
6. Remove any existing 32-item limits and let the pagination component handle data slicing.

[x] Add comprehensive styling for carousel-style pagination in `public/css/style.css`:
1. Create `.pagination-container` base class that matches the current carousel controls layout.
2. Implement responsive design that matches the existing carousel behavior on mobile devices.
3. Ensure proper spacing and alignment within both carousel and gallery contexts.

[x] Implement loading states and error handling for data fetching:
1. Implement error handling with retry mechanisms for failed data requests.
2. Add user-friendly error messages when data fetching fails.

[x] Create a factory function `createPagination(container, dataList, itemsPerPage, updateDisplay)` in the pagination component to maintain consistency with other custom-ui components' API patterns.