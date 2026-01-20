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
| Custom item comparison | ❌ | ❌ | ✅ |
| Theme-responsive | ✅ | ✅ | ✅ |

> [!NOTE]
> **Keyboard navigation removed**: The `enableKeyboard` prop has been removed from ItemNavigator due to implementation complexity with styled components. If keyboard navigation is required, implement it at the parent component level.

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

// With first/last buttons
<ItemNavigator 
  items={images}
  selectedItem={currentImage}
  onSelect={(item, index) => setCurrentImage(item)}
  showFirstLast={true}      // Add first/last buttons
  compareItems={(a, b) => a.id === b.id}  // Custom equality
/>
```

> [!NOTE]
> **Keyboard navigation removed**: The `enableKeyboard` prop has been removed. If keyboard navigation is needed, implement it at the parent component level.

## ListSelect
**Old API → New API:**

The ListSelect component has been refactored to use Goober styling, but maintains the same API.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| All props | Same | No changes needed |

```javascript
// Old (still works, but now styled with Goober)
import { showListSelect } from './list-select.mjs';

showListSelect({
  title: 'Select Item',
  items: [{ id: '1', label: 'Item 1' }],
  itemIcon: 'list-ul',
  onSelectItem: (item) => handleSelect(item)
});

// New (same API, just uses Goober internally)
import { showListSelect } from './list-select.mjs';

showListSelect({
  title: 'Select Item',
  items: [{ id: '1', label: 'Item 1', icon: 'file', disabled: false }],
  itemIcon: 'list-ul',       // Default icon if item doesn't specify
  actionLabel: 'New Item',   // Optional footer action button
  showActions: true,         // Show edit/delete buttons on items
  showActionButton: true,    // Show the footer action button
  selectedId: '1',           // Initially selected item
  emptyMessage: 'No items',  // Custom message for empty state (use 'Loading...' for loading)
  onSelectItem: (item) => console.log('Selected:', item),
  onEdit: (item) => console.log('Edit:', item),
  onDelete: (item) => console.log('Delete:', item),
  onAction: () => console.log('Create new'),
  onClose: () => console.log('Closed')
});
```

**Key Features:**
- All styling now handled by Goober (no CSS classes needed)
- Button variant updated: `variant="icon"` → `variant="small-icon"`
- Danger color added to delete button: `color="danger"`
- Theme-responsive colors and transitions
- Maintains backwards compatibility with existing code

## FolderSelect (MOVED to app-ui)
**Component moved from `custom-ui/folder-select.mjs` to `app-ui/folder-select.mjs`**

The FolderSelect component has been refactored to use ListSelect as its base component. It is now considered an app-specific component rather than a generic UI component.

| Old Import | New Import |
|------------|------------|
| `import { showFolderSelect } from './custom-ui/folder-select.mjs'` | `import { showFolderSelect } from './app-ui/folder-select.mjs'` |

**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| All props | Same | No changes needed |

```javascript
// Old (still works via re-export for backward compatibility)
import { showFolderSelect } from './custom-ui/folder-select.mjs';

showFolderSelect(
  (uid) => console.log('Selected:', uid),
  (uid, newLabel) => console.log('Renamed:', uid, newLabel),
  (uid) => console.log('Deleted:', uid),
  (newFolder) => console.log('Created:', newFolder),
  currentFolderUid
);

// New (recommended)
import { showFolderSelect } from './app-ui/folder-select.mjs';

showFolderSelect(
  (uid) => console.log('Selected:', uid),
  (uid, newLabel) => console.log('Renamed:', uid, newLabel),
  (uid) => console.log('Deleted:', uid),
  (newFolder) => console.log('Created:', newFolder),
  currentFolderUid
);
```

**Key Changes:**
- Now uses ListSelect internally for consistent Goober styling
- All styling handled by Goober (no CSS classes needed)
- Theme-responsive colors and transitions
- Maintains full backwards compatibility with existing API

## ImageSelect
**Old API → New API:**

The ImageSelect component has been refactored to use Goober styling, converting from a functional component with hooks to a class-based component with theme subscription.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `variant="icon"` (buttons) | `variant="small-icon"` | Button variants updated |
| `variant="icon-danger"` (buttons) | `variant="small-icon" color="danger"` | Danger color now separate |
| All other props | Same | No changes needed |

```javascript
// Old (still works, but now styled with Goober)
import { ImageSelect } from './custom-ui/image-select.mjs';

<ImageSelect
  label="Profile Image"
  value={imageFile}
  onChange={(file) => handleChange(file)}
  onSelectFromGallery={() => openGallery()}
  disabled={false}
/>

// New (same API, uses Goober internally)
import { ImageSelect } from './custom-ui/image-select.mjs';

<ImageSelect
  label="Profile Image"
  value={imageFile}           // URL string or Blob/File
  onChange={handleChange}     // (fileOrUrl | null) => void
  onSelectFromGallery={openGallery}  // Optional gallery callback
  disabled={false}
/>
```

**Key Changes:**
- All styling now handled by Goober (no CSS classes needed)
- Component converted from functional (hooks) to class-based for theme subscription
- Internal button variants updated: `variant="icon"` → `variant="small-icon"`
- Danger button now uses `color="danger"` instead of `variant="icon-danger"`
- Theme-responsive colors, borders, and transitions
- Maintains full backwards compatibility with existing API

## AudioSelect
**Old API → New API:**

The AudioSelect component has been refactored to use Goober styling, converting from a functional component with hooks to a class-based component with theme subscription.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `variant="icon"` (buttons) | `variant="small-icon"` | Button variants updated |
| `variant="icon-danger"` (buttons) | `variant="small-icon" color="danger"` | Danger color now separate |
| All other props | Same | No changes needed |

```javascript
// Old (still works, but now styled with Goober)
import { AudioSelect } from './custom-ui/audio-select.mjs';

<AudioSelect
  label="Background Music"
  value={audioUrl}
  onChange={(url) => handleChange(url)}
  onSelectFromGallery={() => openGallery()}
  disabled={false}
/>

// New (same API, uses Goober internally)
import { AudioSelect } from './custom-ui/audio-select.mjs';

<AudioSelect
  label="Background Music"
  value={mediaData}           // URL string or object with { audioUrl, name, imageUrl }
  onChange={handleChange}     // (null) => void (called when cleared)
  onSelectFromGallery={openGallery}  // Called for gallery selection
  disabled={false}
/>
```

**Key Changes:**
- All styling now handled by Goober (no CSS classes needed)
- Component converted from functional (hooks) to class-based for theme subscription
- Internal button variants updated: `variant="icon"` → `variant="small-icon"`
- Danger button now uses `color="danger"` instead of `variant="icon-danger"`
- Theme-responsive colors, borders, and transitions
- Album art background displayed when media data object includes `imageUrl`
- Maintains full backwards compatibility with existing API

## AudioPlayer
**Old API → New API:**

The AudioPlayer component has been refactored to use Goober styling with theme subscription.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `variant="icon-nav"` (button) | `variant="medium-icon"` | Button variant updated |
| All other props | Same | No changes needed |

```javascript
// Old (still works, but now styled with Goober)
import { AudioPlayer } from './custom-ui/audio-player.mjs';

<AudioPlayer audioUrl="/path/to/audio.mp3" />

// New (same API, uses Goober internally)
import { AudioPlayer } from './custom-ui/audio-player.mjs';

<AudioPlayer audioUrl="/path/to/audio.mp3" />
```

**Key Changes:**
- All styling now handled by Goober (no CSS classes needed)
- Internal button variant updated: `variant="icon-nav"` → `variant="medium-icon"`
- Theme-responsive colors and transitions
- Progress bar hover effect for better UX
- Maintains full backwards compatibility with existing API

## ProgressBanner
**Old API → New API:**

The ProgressBanner component has been refactored to use Goober styling with theme subscription.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| All props | Same | No changes needed |

```javascript
// Old (still works, but now styled with Goober)
import { ProgressBanner } from './custom-ui/progress-banner.mjs';

<ProgressBanner 
  taskId="task-123"
  sseManager={sseManager}
  onComplete={handleComplete}
  onError={handleError}
  defaultTitle="Page Title"
/>

// New (same API, uses Goober internally)
import { ProgressBanner } from './custom-ui/progress-banner.mjs';

<ProgressBanner 
  taskId="task-123"
  sseManager={sseManager}
  onComplete={handleComplete}
  onError={handleError}
  defaultTitle="Page Title"
/>
```

**Key Changes:**
- All styling now handled by Goober (no CSS classes needed)
- Uses theme colors for success/error states (green for complete, red for error)
- Theme-responsive background, borders, shadows, and text colors
- Smooth slide-up animation and transitions
- Auto-dismiss after completion (2s) or error (5s)
- Updates page title with progress percentage during generation
- Maintains full backwards compatibility with existing API
