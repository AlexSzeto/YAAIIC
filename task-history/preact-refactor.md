# Refactor Components to Pure Preact

## Overview
Refactor all existing components to remove factory functions, rely on Preact component properties and state management. This will modernize the component architecture and improve maintainability.

## Implementation Plan

### Phase 1: Audit and Analyze Current Components
[x] Review all existing JavaScript components and identify those using factory functions and imperative APIs:
1. Survey all files in `public/js/` and `public/js/custom-ui/` to identify components that need refactoring.
2. Analyze the current API patterns used by `CarouselDisplay`, `GeneratedImageDisplay`, and other components that still use factory functions.
3. Document the props, callbacks, and state management requirements for each component.
4. Identify shared patterns and create a consistent Preact component interface specification.
5. Note any cross-component dependencies and communication patterns that need to be preserved.

### Phase 2: Refactor GeneratedImageDisplay to Pure Preact
[x] Convert `GeneratedImageDisplay` class to a pure Preact component in `public/js/custom-ui/generated-image-display.js`:
1. Create a new `GeneratedImageDisplayComponent` class extending Preact's `Component`.
2. Accept image data as props (`imageData`) and handle null/empty states gracefully.
3. Implement proper state management for any internal UI state (loading, error states, etc.).
4. Use Preact's lifecycle methods (`componentDidMount`, `componentDidUpdate`) to handle data changes.
5. Render all UI elements using JSX-like `html` template literals, removing dependency on external HTML structure.
6. Implement click handlers using Preact event handling patterns (e.g., for image modal opening).
7. Add proper prop validation and error handling for invalid data formats.
8. Maintain backward compatibility by creating a factory function `createGeneratedImageDisplay(container, initialData)`.

### Phase 3: Refactor CarouselDisplay to Pure Preact  
[x] Convert `CarouselDisplay` class to a pure Preact component in `public/js/custom-ui/carousel-display.js`:
1. Create a new `CarouselDisplayComponent` class extending Preact's `Component`.
2. Accept props: `dataList` (array), `dataDisplayComponent` (Preact component), `onSelectionChange` (event handler).
3. Integrate the existing `PaginationComponent` as a child component, passing appropriate props.
4. Manage internal state: `currentIndex`, `selectedItem`, handling the item tracking by `name` and `timestamp`.
5. Use Preact's composition pattern to render the data display component with current item data.
6. Handle data updates through props changes using `componentDidUpdate` lifecycle method.
7. Implement `addData()` functionality through props updates and event handler notifications.
8. Maintain API compatibility by creating a factory function `createCarouselDisplay(container, dataDisplayComponent)`.

### Phase 4: Create Shared CustomModal Component Foundation
[x] Create a reusable `CustomModal` component in `public/js/custom-ui/modal.js`:
1. Export a new `CustomModal` class using preact/htm with proper imports from 'preact' and 'htm/preact'.
2. Accept props: `isVisible`, `lock` (boolean, default: false), `onClose`, `children`, and `size` configurations.
3. Initialize state variables and create modal DOM structure (wrapper, container, close button) using preact/htm render patterns.
4. Apply existing CSS classes from image-modal styles for consistency with current modal appearance.
5. Use `props.children` to handle content that gets placed inside the modal container.
6. Ensure proper DOM structure matches existing image-modal-overlay/wrapper/container hierarchy.

[x] Implement modal interaction and lifecycle management:
1. Create `closeModal()` method that handles proper cleanup and calls the `onClose` event handler.
2. Connect close button click, overlay click, and ESC key press listeners to `closeModal()` method.
3. Implement `setModalLock(lock)` method that disables/enables all close mechanisms based on lock state.
4. Use Preact lifecycle methods for proper event listener setup and cleanup.
5. Implement proper portal rendering to attach modals to document body while maintaining Preact's component tree.

### Phase 5: Refactor Modal-Based Components to Use CustomModal
[x] Refactor `createImageModal` function to use `CustomModal`:
1. Rewrite `createImageModal` in `public/js/custom-ui/modal.js` to instantiate `CustomModal` component.
2. Move image element creation and configuration logic to use the CustomModal container via children props.
3. Preserve existing autoScale and original sizing functionality within the image content component.
4. Maintain image loading, error handling, and scaling calculation logic.
5. Create an `ImageModalComponent` that renders image content and passes it to `CustomModal` as children.
6. Ensure backward compatibility with existing `createImageModal(url, autoScale)` function signature.

[x] Create and refactor dialog modal functionality:
1. Create `createDialogModal(text, title)` function in `public/js/custom-ui/modal.js` using `CustomModal` class.
2. Port dialog content creation logic from the existing `showDialog()` function in `custom-dialog.js`.
3. Create `DialogModalComponent` that renders title, content, and handles empty text with "No description text provided." fallback.
4. Apply consistent styling using existing modal CSS classes rather than dialog-specific classes.
5. Update all references to `showDialog()` from `custom-dialog.js` to use the new `createDialogModal()` function.
6. Test dialog functionality and delete `public/js/custom-ui/dialog.js` once all functionality is ported.

[x] Refactor `GalleryDisplay` to use `CustomModal`:
1. Update the `GalleryDisplay` component in `public/js/custom-ui/gallery.js` to use `CustomModal` for modal structure.
2. Replace the current modal DOM creation in render() method with `CustomModal` component integration.
3. Move gallery content (grid, pagination, controls) into the CustomModal container using children composition.
4. Maintain existing gallery functionality including search, pagination, and load/cancel actions.
5. Ensure proper integration with existing preact/htm structure and preserve modal close behavior.
6. Update the factory function to work with the new CustomModal-based implementation.

### Phase 6: Refactor Main Application Entry Points
[x] Update `main.js` to use Preact components instead of factory functions:
1. Replace manual DOM manipulation and factory function calls with Preact component rendering.
2. Create a main `AppComponent` that manages global application state and renders child components.
3. Use Preact's component communication patterns (props, event handlers) instead of direct method calls.
4. Implement proper component mounting to existing DOM elements using `render()`.
5. Establish a centralized state management pattern for shared data (workflows, image data, etc.).
6. Update event handlers to use Preact's event system and component callbacks.

### Phase 7: Refactor Gallery Components
[x] Update `GalleryDisplay` to pure Preact patterns in `public/js/custom-ui/gallery.js`:
1. Remove the factory function approach and rely purely on the existing `GalleryDisplay` Preact component.
2. Simplify the component API to accept all configuration through props: `queryPath`, `previewFactory`, `onLoad`, `isVisible`.
3. Remove the external factory wrapper and update consuming code to use direct Preact rendering.
4. Ensure the `previewFactory` function works seamlessly with Preact's rendering system.
5. Update the pagination integration to use pure prop-based communication.

### Phase 8: Update Utility Functions and Integration Points
[x] Refactor utility functions in `public/js/util.js` to support Preact patterns:
1. Update any DOM manipulation utilities to work with Preact refs and component patterns.
2. Create helper functions for common Preact patterns used across components.
3. Implement standardized prop validation and error handling utilities.
4. Add utilities for managing component lifecycle and cleanup operations.

[x] Update component integration in consuming files:
1. Modify `carousel-setup.js`, `generated-image-display.js`, and other integration files to use Preact rendering.
2. Replace class instantiation patterns with Preact component rendering using `render()`.
3. Update cross-component communication to use props and event handlers instead of direct method calls.
4. Ensure proper cleanup and unmounting of Preact components when needed.

### Phase 9: Move DOM Creation to Pure Preact Architecture
[x] **Sub-phase 9.1: Create Preact Components for Static UI Elements**
1. Create `HeaderComponent` in `public/js/custom-ui/header.js`:
   - Render the main title "YAAIIG (Yet Another AI Image Generator)"
   - Accept title as a prop for future customization
   - Use semantic HTML structure with proper heading tags

2. Create `WorkflowControlsComponent` in `public/js/custom-ui/workflow-controls.js`:
   - Render all form controls: workflow dropdown, name input, seed input, lock-seed checkbox
   - Accept props: `workflows`, `selectedWorkflow`, `formData`, and event handlers
   - Implement controlled components pattern with proper value/onChange bindings
   - Include the description textarea with autocomplete functionality
   - Render button row with generate and gallery buttons

3. Create `GeneratedImageContainerComponent` in `public/js/custom-ui/generated-image-container.js`:
   - Replace the static `generatedImageDisplay` div with a Preact component
   - Integrate with existing `GeneratedImageDisplayComponent` logic
   - Handle visibility state through props (`isVisible`, `imageData`)
   - Maintain existing CSS class structure for styling compatibility

4. Create `CarouselContainerComponent` in `public/js/custom-ui/carousel-container.js`:
   - Replace the static `carouselDisplay` div with a Preact component
   - Integrate with existing `CarouselDisplayComponent` logic
   - Handle visibility and data through props (`isVisible`, `carouselData`)
   - Maintain pagination container structure

[x] **Sub-phase 9.2: Update AppComponent to Render Full UI**
1. Modify `AppComponent` in `main.js` to render complete application UI:
   - Import all new UI components (`HeaderComponent`, `WorkflowControlsComponent`, etc.)
   - Update render method to include all UI elements instead of just gallery
   - Pass appropriate props and event handlers to each component
   - Remove dependencies on external DOM elements by ID

2. Remove factory function initialization from `initializeComponents()`:
   - Replace `createGeneratedImageDisplay()` calls with direct Preact component rendering
   - Replace `createCarouselDisplay()` calls with direct Preact component rendering  
   - Update component communication to use props/callbacks instead of instance methods

3. Update event handling to use pure Preact patterns:
   - Remove manual DOM event listener setup in `DOMContentLoaded`
   - Pass event handlers as props to child components
   - Use Preact's built-in event system for all user interactions

[x] **Sub-phase 9.3: Simplify index.html to Minimal Structure**
1. Reduce `index.html` to essential elements only:
   - Keep `<head>` section with meta tags, title, and script imports
   - Keep CSS and external library imports (Preact, autoComplete.js, boxicons)
   - Remove all `<body>` content except for a single root div (`<div id="app-root"></div>`)
   - Remove all static form elements, containers, and pre-created DOM structure

2. Update main.js initialization:
   - Change render target from hidden `app-container` to visible `app-root` div
   - Remove setTimeout-based event listener setup since components will handle their own events
   - Simplify DOMContentLoaded handler to just render the AppComponent

[x] **Sub-phase 9.4: Update Component Integration Patterns**
1. Refactor autocomplete integration:
   - Move autocomplete setup from external script to `WorkflowControlsComponent`
   - Integrate `loadTags()` and autocomplete initialization into component lifecycle
   - Ensure autocomplete works with Preact-controlled textarea component

2. Update CSS class compatibility:
   - Ensure all new Preact components use existing CSS class names
   - Verify that component rendering matches expected DOM structure for styling
   - Test that all existing styles apply correctly to Preact-rendered elements

3. Update cross-component communication:
   - Replace direct DOM manipulation with props/state updates
   - Ensure all component interactions use Preact patterns
   - Remove any remaining getElementById() calls and DOM queries

[x] **Sub-phase 9.5: Testing and Validation**
1. Test complete application functionality:
   - Verify all form controls work correctly (workflow selection, inputs, buttons)
   - Test image generation workflow from form submission to display
   - Validate gallery functionality and modal interactions
   - Ensure carousel navigation and image selection work properly

2. Verify styling and layout:
   - Check that all CSS styles apply correctly to Preact-rendered elements
   - Test responsive behavior and visual consistency
   - Validate that component styling matches original static layout

3. Performance and cleanup validation:
   - Ensure no memory leaks from event listeners or component instances
   - Verify proper component mounting and unmounting
   - Test that application initialization is reliable and error-free

### Phase 10: Cleanup and Optimization
[ ] Remove factory functions and imperative APIs:
1. Remove all factory function exports that are no longer needed after Preact conversion.
2. Clean up any unused DOM manipulation code and event listeners.
3. Consolidate common component patterns and reduce code duplication.
4. Ensure consistent prop interfaces across all components.

[ ] Update styling and CSS integration:
1. Ensure all components work properly with existing CSS classes and styling.
2. Update any CSS that relied on specific DOM structures created by factory functions.

## Success Criteria
- All components use pure Preact patterns with props and state management
- No factory functions remain in the codebase (except for backward compatibility wrappers)
- All existing functionality is preserved and works correctly
- Component APIs are consistent and follow Preact best practices
- Code is more maintainable and follows modern React/Preact patterns
- All modal components (`ImageModalComponent`, `DialogComponent`, `GalleryComponent`) use the shared `CustomModal` container for consistency

