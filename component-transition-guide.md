# Component Transition Guide
This document provides instructions on how to migrate existing app code from old component APIs to the new Goober-styled versions.

## Panel (NEW)
Panel is a new component. No migration needed - just start using it.
```javascript
// Usage
import { Panel } from './custom-ui/panel.mjs';
<Panel variant="default|elevated|outlined|glass">content</Panel>
```

## Button
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `variant="primary"` | `color="primary"` | Color is now separate from size |
| `variant="secondary"` | `color="secondary"` | Default color |
| `variant="success"` | `color="success"` | |
| `variant="danger"` | `color="danger"` | |
| `variant="icon"` | `variant="small-icon"` | Small square icon button (28x28) |
| `variant="icon-nav"` | `variant="medium-icon"` | Medium square icon button (44x44) |
| `variant="small-text"` | `variant="small-text"` | Same |
| `variant="primary-small-text"` | `variant="small-text" color="primary"` | Split into variant + color |
| (default with text) | `variant="medium-text"` | Default, explicit name |
| (with icon + text) | `variant="medium-icon-text"` | Explicit icon+text variant |

```javascript
// Old
<Button variant="primary" icon="play">Play</Button>
<Button variant="icon">X</Button>

// New
<Button variant="medium-icon-text" color="primary" icon="play">Play</Button>
<Button variant="small-icon" icon="x" color="secondary" />
```

## Input
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `className` | (removed) | Use styled wrapper if needed |
| All other props | Same | No changes needed |

```javascript
// Old
<Input label="Name" className="custom-class" />

// New  
<Input label="Name" />
// If custom styling needed, wrap in a styled container
```

## Select
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|---------|
| `className` | (removed) | Use styled wrapper if needed |
| All other props | Same | No changes needed |

```javascript
// Old
<Select label="Category" className="custom-class" options={options} />

// New  
<Select label="Category" options={options} />
// If custom styling needed, wrap in a styled container
```

## Textarea
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `className` | (removed) | Use styled wrapper if needed |
| `fullWidth=true` | `fullWidth=true` | Default is now true (unchanged) |
| All other props | Same | No changes needed |

```javascript
// Old
<Textarea label="Notes" className="custom-class" />

// New  
<Textarea label="Notes" />
// Additional props: rows (default 4)
```

## Checkbox
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `className` | (removed) | Use styled wrapper if needed |
| All other props | Same | No changes needed |

```javascript
// Old
<Checkbox label="Accept" className="custom-class" />

// New  
<Checkbox label="Accept" />
// Supports: labelPosition ('left' or 'right')
```

## Tags → ButtonGroup (RENAMED)
**Component renamed from `Tags` to `ButtonGroup`**

| Old Import | New Import |
|------------|------------|
| `import { Tags } from './tags.mjs'` | `import { ButtonGroup } from './button-group.mjs'` |

**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `variant="primary-small-text"` | `color="primary"` | Color is now separate |
| All other props | Same | No changes needed |

```javascript
// Old (tags.mjs)
import { Tags } from './tags.mjs';
<Tags items={items} selected={selected} onSelect={handleSelect} />

// New (button-group.mjs)  
import { ButtonGroup } from './button-group.mjs';
<ButtonGroup items={items} selected={selected} onSelect={handleSelect} />
// Note: Tags export still available for backward compatibility
```

## Pagination → ItemNavigator
**ItemNavigator now fully replaces PaginationControls** as a drop-in replacement with enhanced features.

ItemNavigator supports two operating modes:
1. **Page Mode**: Stateless navigation for pages (direct replacement for PaginationControls)
2. **Item Mode**: Item-centric navigation through actual data items

### Replacing PaginationControls with ItemNavigator

**Simple Drop-in Replacement (Page Mode)**

```javascript
// OLD: Using PaginationControls
import { PaginationControls } from './pagination.mjs';

<PaginationControls
  currentPage=${pagination.currentPage}
  totalPages=${pagination.totalPages}
  onNext=${pagination.goToNext}
  onPrev=${pagination.goToPrev}
/>

// NEW: Using ItemNavigator in page mode
import { ItemNavigator } from './item-navigator.mjs';

<ItemNavigator
  currentPage=${pagination.currentPage}
  totalPages=${pagination.totalPages}
  onNext=${pagination.goToNext}
  onPrev=${pagination.goToPrev}
/>
```

**With Optional First/Last Buttons**

```javascript
// If your pagination object has goToFirst/goToLast methods:
<ItemNavigator
  currentPage=${pagination.currentPage}
  totalPages=${pagination.totalPages}
  onNext=${pagination.goToNext}
  onPrev=${pagination.goToPrev}
  onFirst=${pagination.goToFirst}
  onLast=${pagination.goToLast}
  showFirstLast=${true}
/>
```

**With Keyboard Navigation**

```javascript
<ItemNavigator
  currentPage=${pagination.currentPage}
  totalPages=${pagination.totalPages}
  onNext=${pagination.goToNext}
  onPrev=${pagination.goToPrev}
  enableKeyboard=${true}  // Enables Arrow keys, Home/End
/>
```

**Complete Example: Gallery with Pagination**

```javascript
import { ItemNavigator } from './item-navigator.mjs';
import { usePagination } from './use-pagination.mjs';

function Gallery() {
  const [data, setData] = useState([]);
  const pagination = usePagination(data, 24); // 24 items per page
  
  return html`
    <div>
      <div class="gallery-grid">
        ${pagination.currentPageData.map(item => renderItem(item))}
      </div>
      
      <${ItemNavigator}
        currentPage=${pagination.currentPage}
        totalPages=${pagination.totalPages}
        onNext=${pagination.goToNext}
        onPrev=${pagination.goToPrev}
        enableKeyboard=${true}
      />
    </div>
  `;
}
```

### Alternative: Item-Centric Navigation (Item Mode)

If your use case allows, consider using ItemNavigator in its native item mode for a more direct navigation experience:

```javascript
import { ItemNavigator } from './item-navigator.mjs';

function ImageViewer() {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  
  return html`
    <div>
      ${selectedImage && html`<img src=${selectedImage.url} />`}
      
      <${ItemNavigator}
        items=${images}
        selectedItem=${selectedImage}
        onSelect=${setSelectedImage}
        showFirstLast=${true}
        enableKeyboard=${true}
      />
    </div>
  `;
}
```

### PaginationControls vs ItemNavigator Feature Comparison

| Feature | PaginationControls | ItemNavigator (Page Mode) | ItemNavigator (Item Mode) |
|---------|-------------------|---------------------------|---------------------------|
| Page navigation | ✅ | ✅ | ❌ |
| Item navigation | ❌ | ❌ | ✅ |
| Stateless | ✅ | ✅ | ✅ |
| First/Last buttons | ❌ | ✅ (optional) | ✅ (optional) |
| Keyboard navigation | ❌ | ✅ (optional) | ✅ (optional) |
| Custom item comparison | ❌ | ❌ | ✅ |
| Theme-responsive | ✅ | ✅ | ✅ |

**Recommendation:** Use ItemNavigator in page mode as a direct replacement for PaginationControls. It provides the same API with additional optional features.

## ImageCarousel → ItemNavigator
**Component deprecated.** `ImageCarousel` is now a thin wrapper around `ItemNavigator`.

| Old Import | New Import |
|------------|------------|
| `import { ImageCarousel } from './image-carousel.mjs'` | `import { ItemNavigator } from './item-navigator.mjs'` |

```javascript
// Old (still works, deprecated)
import { ImageCarousel } from './image-carousel.mjs';
<ImageCarousel items={images} selectedItem={current} onSelect={setImage} />

// New  
import { ItemNavigator } from './item-navigator.mjs';
<ItemNavigator items={images} selectedItem={current} onSelect={setImage} />
```

## ItemNavigator (NEW)
**Unified navigation component** combining `ImageCarousel` and item-centric pagination.

```javascript
// Import
import { ItemNavigator } from './item-navigator.mjs';

// Basic usage (same API as ImageCarousel)
<ItemNavigator 
  items={images}
  selectedItem={currentImage}
  onSelect={(item) => setCurrentImage(item)}
/>

// Enhanced features
<ItemNavigator 
  items={images}
  selectedItem={currentImage}
  onSelect={(item, index) => setCurrentImage(item)}
  showFirstLast={true}      // Add first/last buttons
  enableKeyboard={true}     // Arrow keys, Home/End
  compareItems={(a, b) => a.id === b.id}  // Custom equality
/>
```
