# Refactor Components to Preact with Signals Architecture

## Overview
Refactor all existing components to remove factory functions, rely on Preact component properties (with callbacks) and state management, and introduce Preact signals for reactive DOM composition. This will modernize the component architecture and improve maintainability.

## Tasks

### Task 1: Install and Configure Preact Signals
[ ] Install Preact Signals package in the project dependencies
[ ] Update the HTML imports to include Preact Signals CDN or module imports
[ ] Create a new signals utility module `public/js/signals.js` for managing global application signals

### Task 2: Create Preact Signal-Based State Management
[ ] Create global signals for application state in `signals.js`:
  - `currentImageData` - Signal for currently displayed generated image data
  - `carouselDataList` - Signal for carousel data array
  - `galleryDataList` - Signal for gallery data array  
  - `searchQuery` - Signal for gallery search query
  - `isGalleryVisible` - Signal for gallery modal visibility
  - `workflows` - Signal for available workflows
  - `currentWorkflow` - Signal for selected workflow
[ ] Export signal utilities for components to use
[ ] Create derived signals for computed values (e.g., `totalCarouselItems`, `filteredGalleryData`)

### Task 3: Refactor Modal Component to Pure Preact
[ ] Convert `createImageModal` factory function in `custom-ui/modal.js` to Preact component:
  - Create `ImageModal` component class extending Preact Component
  - Accept `url`, `autoScale`, and `isVisible` props
  - Use component lifecycle methods instead of imperative DOM manipulation
  - Implement proper cleanup in `componentWillUnmount`
[ ] Update modal styling to work with Preact component rendering
[ ] Replace all `createImageModal()` calls with Preact component usage

### Task 4: Refactor Dialog Component to Pure Preact  
[ ] Convert `showDialog` factory function in `custom-ui/dialog.js` to Preact component:
  - Create `Dialog` component class extending Preact Component
  - Accept `text`, `title`, and `isVisible` props
  - Use Preact event handling instead of direct DOM event listeners
  - Implement proper state management for visibility
[ ] Create a global dialog signal for managing dialog state
[ ] Replace all `showDialog()` calls with signal-based dialog management

### Task 5: Refactor Pagination Component Factory Function
[ ] Remove `createPagination` factory function from `custom-ui/pagination.js`:
  - Keep the existing `PaginationComponent` class but enhance it with signals
  - Use signals for `dataList`, `currentPage`, and other reactive state
  - Remove the factory function entirely
[ ] Update all components using `createPagination()` to use the component directly
[ ] Ensure proper cleanup of signal subscriptions in component lifecycle

### Task 6: Refactor Gallery Component Architecture
[ ] Convert `createGallery` factory function in `custom-ui/gallery.js` to pure Preact:
  - Remove the factory function
  - Enhance the existing `GalleryDisplay` component to use signals
  - Connect to global `galleryDataList`, `searchQuery`, and `isGalleryVisible` signals
  - Use signal-based reactivity for search and data updates
[ ] Remove the factory function and update `main.js` to instantiate component directly
[ ] Implement proper signal-based communication between gallery and carousel

### Task 7: Refactor Generated Image Display Component
[ ] Update `GeneratedImageDisplay` class in `generated-image-display.js`:
  - Connect to `currentImageData` signal instead of manual `setData()` calls
  - Use signal-based reactivity for image and metadata updates
  - Convert button event handlers to use Preact patterns
  - Remove imperative DOM updates in favor of reactive rendering
[ ] Implement signal-driven copy and use button functionality
[ ] Connect to global workflow and form field signals for the "use" functionality

### Task 8: Refactor Carousel Display Component  
[ ] Update `CarouselDisplay` class in `carousel-setup.js`:
  - Connect to `carouselDataList` and `currentImageData` signals
  - Remove manual data list management in favor of signal reactivity
  - Use signal subscriptions instead of callback-based updates
  - Remove the factory function dependency for pagination
[ ] Implement signal-based navigation that automatically updates `currentImageData`
[ ] Connect carousel navigation to generated image display via shared signals

### Task 9: Refactor Gallery Preview Component
[ ] Convert `createGalleryPreview` factory function in `gallery-preview.js`:
  - Create `GalleryPreviewItem` Preact component
  - Accept item data as props instead of factory function parameters
  - Use Preact event handling for click events
  - Connect click events to global modal visibility signals
[ ] Update gallery component to use array of preview components instead of factory function
[ ] Implement proper key props for list rendering performance

### Task 10: Update Main Application Bootstrap
[ ] Refactor `main.js` to use signal-based architecture:
  - Initialize all global signals on application start
  - Remove manual component instantiation with factory functions
  - Use Preact rendering for the main application components
  - Set up signal watchers for cross-component communication
[ ] Create a main App component that manages all sub-components
[ ] Use signals to coordinate between form submission, image generation, and display updates
[ ] Implement proper error handling with signal-based error state

### Task 11: Update Toast Component Integration
[ ] Ensure `toast.js` component integrates properly with the new signal-based architecture
[ ] Connect toast notifications to error and success signals
[ ] Remove any remaining factory function patterns in toast usage

### Task 12: Clean Up and Optimize
[ ] Remove all unused factory functions and their exports
[ ] Update imports across all files to use new component structure
[ ] Optimize signal subscriptions to prevent memory leaks
[ ] Add TypeScript-style JSDoc comments for better IDE support
[ ] Test all component interactions work with new signal-based architecture
[ ] Ensure proper component cleanup and signal unsubscription

### Task 13: Update Documentation and Patterns
[ ] Update `rules.md` to reflect the new Preact + Signals architecture guidelines
[ ] Document the new component patterns and signal usage conventions
[ ] Create examples of proper signal subscription and cleanup patterns
[ ] Update any inline documentation referencing old factory function patterns