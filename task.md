# PaginationComponent Refactor Implementation Plan

## Overview
Refactor the `PaginationComponent` from an imperative factory-based approach to a pure, declarative Preact component. This will eliminate the `createPagination` factory function, remove imperative methods like `setDataList()`, and adopt proper Preact patterns using props and events.

## Current Architecture Issues
1. **Factory Function Pattern**: `createPagination()` creates component instances imperatively, which goes against Preact's declarative philosophy.
2. **Imperative Methods**: Methods like `setDataList()`, `setItemsPerPage()`, `goToPage()` require direct component manipulation rather than prop updates.
3. **Internal State Management**: Component manages its own `currentPage` state when it could be controlled externally for better flexibility.
4. **DOM Manipulation**: Factory function renders component to arbitrary DOM containers instead of using standard Preact rendering.

## New Architecture Design

### Component Interface
```javascript
// Proposed new PaginationComponent props
interface PaginationProps {
  // Data and configuration
  dataList: Array<any>
  itemsPerPage?: number
  currentPage?: number  // externally controlled
  
  // Event handlers
  onPageChange: (pageIndex: number, pageData: Array<any>) => void
  onNavigate?: (direction: 'prev' | 'next' | 'first' | 'last') => void
  
  // Display options
  showNavigation?: boolean
  showIndex?: boolean
  disabled?: boolean
  
  // Accessibility
  ariaLabel?: string
}
```

### State Management Options
**Option 1: Controlled Component (Recommended)**
- Parent manages `currentPage` state
- Component receives `currentPage` as prop
- Component calls `onPageChange` when user navigates
- Maximum flexibility for parent components

**Option 2: Uncontrolled Component**
- Component manages internal `currentPage` state
- Accepts optional `defaultPage` prop
- Still calls `onPageChange` for parent notification
- Simpler for basic use cases

**Option 3: Hybrid Approach**
- Support both controlled and uncontrolled modes
- If `currentPage` prop provided, use controlled mode
- If not provided, use internal state (uncontrolled mode)

## Implementation Tasks

### 1. Analyze Current PaginationComponent Architecture
[] Document all existing functionality and use cases:
1. Review current `PaginationComponent` class and identify all public methods
2. Document `createPagination` factory function and its return object interface
3. Map imperative methods (`setDataList`, `setItemsPerPage`, `goToPage`, etc.) to declarative patterns
4. Identify all current usage locations of `createPagination` in the codebase
5. Document keyboard navigation features (arrow keys, home/end keys) to preserve

[] Identify imperative patterns to be replaced:
1. Factory function instantiation pattern → Direct component rendering
2. Method calls like `pagination.setDataList()` → Prop updates
3. Method calls like `pagination.goToPage()` → Controlled `currentPage` prop
4. Manual DOM container management → Standard Preact parent-child rendering
5. Imperative event callback registration → Declarative event props

### 2. Design Declarative PaginationComponent Interface
[] Define comprehensive props interface:
1. Core data props: `dataList`, `itemsPerPage`, `currentPage`, `defaultPage`
2. Event handler props: `onPageChange`, `onNavigate`
3. Display option props: `showNavigation`, `showIndex`, `disabled`
4. Accessibility props: `ariaLabel`, custom ARIA attributes
5. Add prop validation and default values for all optional props

[] Design event system for page changes and navigation:
1. `onPageChange(pageIndex, pageData)` - Called when page changes
2. `onNavigate(direction, currentPage, totalPages)` - Called on navigation attempts
3. Consider additional events for edge cases (e.g., navigation beyond bounds)
4. Ensure events provide sufficient data for parent components to react appropriately

[] Determine optimal state management approach:
1. Implement hybrid controlled/uncontrolled pattern
2. Use `currentPage` prop presence to determine mode
3. Fall back to `defaultPage` prop for initial uncontrolled state
4. Provide clear documentation on when to use each mode

### 3. Implement Pure PaginationComponent
[] Remove all imperative methods from component class:
1. Delete methods: `setDataList`, `setItemsPerPage`, `goToPage`, `goToPreviousPage`, `goToNextPage`
2. Delete methods: `goToFirstPage`, `goToLastPage`, `getCurrentPageData`, `getState`
3. Remove internal method-based state management
4. Convert all functionality to prop-driven computations

[] Implement controlled component pattern:
1. Add support for controlled `currentPage` prop
2. Implement `onPageChange` event emission on navigation
3. Handle prop updates in `componentDidUpdate` for controlled mode
4. Maintain backward compatibility during transition period

[] Replace internal state management with props-driven updates:
1. Compute `totalPages` from `dataList.length / itemsPerPage`
2. Compute `currentPageData` from `dataList` slice based on current page
3. Handle page bounds validation using props instead of internal state
4. Update all navigation handlers to use new prop-based logic

[] Preserve all existing rendering logic and accessibility features:
1. Maintain existing CSS classes and DOM structure
2. Preserve keyboard navigation (arrow keys, home/end)
3. Keep ARIA labels and accessibility attributes
4. Ensure disabled states work correctly with new prop system

### 4. Update CarouselDisplayComponent Integration
[] Remove `createPagination` factory usage:
1. Delete `setupPagination` method and ref callback pattern
2. Remove `pagination` instance variable and related lifecycle management
3. Delete `handlePaginationUpdate` callback method
4. Clean up component unmount pagination cleanup logic

[] Add pagination state management to carousel component:
1. Add `currentIndex` state to track current carousel position
2. Implement `handlePageChange` method to update carousel state
3. Sync carousel `currentIndex` with pagination page changes
4. Handle prop updates to `dataList` and maintain current position when possible

[] Render `PaginationComponent` directly in JSX:
1. Replace ref-based pagination container with direct component rendering
2. Pass `dataList`, `itemsPerPage=1`, and `currentPage` props
3. Connect `onPageChange` event to carousel state management
4. Remove all factory function calls and imperative method usage

[] Test carousel pagination functionality:
1. Verify pagination appears when multiple images are loaded
2. Test navigation between images using prev/next buttons
3. Test keyboard navigation (arrow keys) still works
4. Ensure carousel display updates correctly when page changes

### 5. Update Other Pagination Consumers
[] Search codebase for all `createPagination` usages:
1. Use grep/search to find all `createPagination` function calls
2. Identify all files that import `createPagination` function
3. Document the context and usage pattern for each consumer
4. Plan migration approach for each specific use case

[] Update each consumer to use direct component rendering:
1. Replace factory function calls with direct `<PaginationComponent>` usage
2. Convert imperative method calls to prop updates where applicable
3. Implement proper parent state management for controlled pagination
4. Update imports to use component class instead of factory function

[] Implement proper state management in each parent component:
1. Add pagination-related state (`currentPage`, etc.) to parent components
2. Implement event handlers to respond to pagination changes
3. Handle data updates and pagination state synchronization
4. Test each updated consumer for proper functionality

### 6. Remove Factory Function and Imperative APIs
[] Delete `createPagination` function from pagination.js:
1. Remove entire `createPagination` function and its documentation
2. Remove factory function return object with imperative methods
3. Update export statement to only export `PaginationComponent` class
4. Clean up any helper functions only used by factory function

[] Remove imperative methods from component class:
1. Verify all imperative methods are no longer needed after consumer updates
2. Delete method implementations: `setDataList`, `setItemsPerPage`, etc.
3. Remove any internal state that was only used for imperative interface
4. Simplify component to pure prop-driven behavior

[] Clean up any unused imports or dependencies:
1. Remove imports only used by factory function or imperative methods
2. Update component dependencies to only include what's needed for new interface
3. Verify all remaining imports are actually used
4. Update file documentation to reflect new pure component approach

### 7. Test Refactored Pagination Functionality
[] Test basic pagination navigation:
1. Verify prev/next buttons work correctly with multiple pages of data
2. Test button disabled states on first/last pages
3. Test page index display shows correct current/total pages
4. Verify `onPageChange` event is called with correct parameters

[] Test keyboard navigation:
1. Verify arrow keys navigate between pages
2. Test Home/End keys jump to first/last page
3. Ensure keyboard navigation respects disabled states
4. Test focus management and accessibility features

[] Test edge cases:
1. Test with empty data array (should show no pagination or handle gracefully)
2. Test with single page of data (should disable navigation)
3. Test with `currentPage` prop outside valid range
4. Test rapid prop updates and state synchronization

[] Test accessibility features:
1. Verify ARIA labels are present and correct
2. Test screen reader compatibility
3. Check keyboard focus management
4. Ensure proper disabled state communication to assistive technology

[] Verify carousel pagination works with multiple images:
1. Load multiple images from gallery into carousel
2. Verify pagination controls appear and show correct page count
3. Test navigation between images using pagination buttons
4. Ensure image display updates correctly when pagination changes

[] Test any other pagination consumers in the application:
1. Identify and test any other components using pagination
2. Verify all existing pagination functionality still works
3. Test edge cases specific to each consumer
4. Ensure no regressions in user experience

## Detailed Implementation Steps

### Step 1: New Component Structure
```javascript
export class PaginationComponent extends Component {
  constructor(props) {
    super(props);
    
    // Only manage currentPage if not controlled externally
    this.state = {
      currentPage: props.currentPage ?? props.defaultPage ?? 0
    };
  }
  
  // Compute derived values from props
  get totalPages() {
    const { dataList = [], itemsPerPage = 1 } = this.props;
    return Math.max(1, Math.ceil(dataList.length / itemsPerPage));
  }
  
  get currentPage() {
    // Use controlled prop if available, otherwise internal state
    return this.props.currentPage ?? this.state.currentPage;
  }
  
  get currentPageData() {
    const { dataList = [], itemsPerPage = 1 } = this.props;
    const startIndex = this.currentPage * itemsPerPage;
    return dataList.slice(startIndex, startIndex + itemsPerPage);
  }
  
  handlePageChange = (newPage) => {
    const { onPageChange, currentPage: controlledPage } = this.props;
    
    // Update internal state if uncontrolled
    if (controlledPage === undefined) {
      this.setState({ currentPage: newPage });
    }
    
    // Always notify parent
    if (onPageChange) {
      onPageChange(newPage, this.getCurrentPageData(newPage));
    }
  }
  
  // ... navigation methods that call handlePageChange
}
```

### Step 2: CarouselDisplayComponent Integration
```javascript
export class CarouselDisplayComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      dataList: props.dataList || [],
      currentIndex: 0,
      // ... other state
    };
  }
  
  handlePaginationChange = (pageIndex, pageData) => {
    this.setState({ currentIndex: pageIndex });
    // Update display with current item
    if (this.props.onSelectionChange && pageData.length > 0) {
      this.props.onSelectionChange(pageData[0], pageIndex);
    }
  }
  
  render() {
    const { dataDisplayComponent: DataDisplayComponent } = this.props;
    const { dataList, currentIndex, isVisible } = this.state;
    const currentItem = dataList[currentIndex];
    
    return html`
      <div class="carousel-display" style=${{ display: isVisible ? 'block' : 'none' }}>
        <div class="carousel-content">
          <${DataDisplayComponent} 
            imageData=${currentItem}
            onUseField=${this.props.onUseField}
          />
        </div>
        <div class="carousel-controls">
          <${PaginationComponent}
            dataList=${dataList}
            itemsPerPage=${1}
            currentPage=${currentIndex}
            onPageChange=${this.handlePaginationChange}
            ariaLabel="Navigate generated images"
          />
        </div>
      </div>
    `;
  }
}
```

## Benefits of Refactored Approach
1. **Declarative**: Follows standard Preact patterns with props and events
2. **Flexible**: Supports both controlled and uncontrolled usage patterns
3. **Maintainable**: Eliminates complex factory function and imperative APIs
4. **Testable**: Easier to unit test pure component with predictable props/events
5. **Reusable**: Standard component can be used anywhere in Preact render tree
6. **Type-safe**: Clear interface makes it easier to add TypeScript later if desired

## Migration Strategy
1. Implement new component alongside existing factory function
2. Update consumers one by one to use new component
3. Remove factory function once all consumers are updated
4. This allows for incremental migration and easy rollback if needed

## Considerations
- Ensure no breaking changes to existing pagination behavior
- Preserve all keyboard navigation and accessibility features
- Maintain visual styling consistency
- Test thoroughly with multiple data scenarios
- Consider performance implications of prop updates vs imperative calls