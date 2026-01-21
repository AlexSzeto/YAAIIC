# Component Transition Guide
This document provides instructions on how to migrate existing app code from old component APIs to the new Goober-styled versions.

## Panel (NEW)
Panel is a new component with optional color theming support.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `variant` | `'default'\|'elevated'\|'outlined'\|'glass'` | Visual style variant (default: `'default'`) |
| `color` | `'primary'\|'secondary'\|'success'\|'danger'\|'info'\|'warning'` | Optional color theme |

```javascript
// Basic usage
import { Panel } from './custom-ui/panel.mjs';
<Panel variant="elevated">Content here</Panel>

// With color theming (applies color's backgroundLight and border)
<Panel variant="elevated" color="success">Success message</Panel>
<Panel variant="outlined" color="danger">Error message</Panel>

// All variants support color prop
<Panel color="info">Default panel with info color</Panel>
<Panel variant="glass" color="warning">Glass panel with warning color</Panel>
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
- Now uses `<Panel variant="elevated" color={statusColor}>` for consistent theming
- Success state uses Panel color="success"
- Error state uses Panel color="danger"
- In-progress state uses default Panel styling (no color)
- All styling now handled by Goober through Panel component
- Theme-responsive shadows and borders from elevated Panel
- Smooth slide-up animation and transitions
- Auto-dismiss after completion (2s) or error (5s)
- Updates page title with progress percentage during generation
- Maintains full backwards compatibility with existing API

## Gallery
**Old API → New API:**

The Gallery component has been refactored to use Goober styling with theme subscription and **moved to the app-ui folder** as it is application-specific.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| All props | Same | No changes needed |

```javascript
// Old (custom-ui location, CSS-based styling)
import { Gallery } from './custom-ui/gallery.mjs';

<Gallery
  isOpen={isOpen}
  onClose={handleClose}
  queryPath="/media-data"
  previewFactory={createPreview}
  onLoad={handleLoad}
  selectionMode={false}
  fileTypeFilter={['image', 'video']}
  folder="folder-uid"
/>

// New (moved to app-ui, Goober styling)
import { Gallery } from './app-ui/gallery.mjs';

<Gallery
  isOpen={isOpen}
  onClose={handleClose}
  queryPath="/media-data"
  previewFactory={createPreview}
  onLoad={handleLoad}
  selectionMode={false}
  fileTypeFilter={['image', 'video']}
  folder="folder-uid"
/>
```

**Key Changes:**
- **Component moved from `custom-ui/` to `app-ui/`** - Update all imports accordingly
- All styling now handled by Goober (no CSS classes needed)
- Theme-responsive colors for all UI elements (background, borders, buttons, text)
- Responsive grid layout (8/6/4/3 columns) using CSS Grid
- Search input with themed focus states and shadows
- Action buttons use theme colors (danger for delete, primary for move, secondary for others)
- Hover effects and transitions use theme timing values
- Smooth transform animations on grid items
- Maintains full backwards compatibility with existing API
- All internal buttons and controls styled with theme

## Toast
**Old API → New API:**

The Toast component now uses elevated Panel with color property for themed styling.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| All props | Same | No changes needed |
| `toast.warning()` | NEW | Added warning variant |

```javascript
// Usage (unchanged API)
import { ToastProvider, useToast } from './custom-ui/toast.mjs';

const toast = useToast();
toast.success('Success message');   // Uses Panel color="success"
toast.error('Error message');       // Uses Panel color="danger"
toast.info('Info message');         // Uses Panel color="info"
toast.warning('Warning message');   // Uses Panel color="warning"
toast.show('Custom', { type: 'warning', duration: 5000 });
```

**Key Changes:**
- Now uses `<Panel variant="elevated" color={type}>` for consistent theming
- Removed custom background/border color logic in favor of Panel's color property
- Success maps to Panel color="success"
- Error maps to Panel color="danger"
- Info maps to Panel color="info"
- Warning maps to Panel color="warning"
- Maintains full backwards compatibility with existing API
- Inherits Panel's elevated shadow and theme-responsive styling

**Key Changes:**
- All styling now handled by Goober (no CSS classes needed)
- Added new `warning` variant with themed colors
- Uses theme colors for all variants:
  - Success: `theme.colors.success.backgroundLight` with `success.border`
  - Error: `theme.colors.danger.backgroundLight` with `danger.border`
  - Info: `theme.colors.info.backgroundLight` with `info.border`
  - Warning: `theme.colors.warning.backgroundLight` with `warning.border`
- Smooth slide-in/slide-out animations using Goober keyframes
- Click-to-dismiss now triggers exit animation before removal
- Auto-dismiss triggers same exit animation
- Theme-responsive text colors, shadows, and borders
- Portal rendering to document.body maintained
- Maintains full backwards compatibility with existing API
## Dialog
**Old API → New API:**

The Dialog component now uses Goober styling and the Button component for all action buttons.

| Old Prop | New Prop | Notes |
|----------|----------|-------|
| All props | Same | No changes needed for showDialog() and showTextPrompt() |

```javascript
// Usage (unchanged API)
import { showDialog, showTextPrompt } from './custom-ui/dialog.mjs';

// Basic dialog with default close button
showDialog('Dialog content here', 'Dialog Title');

// Confirmation dialog with options (first option is danger/destructive)
const result = await showDialog(
  'Are you sure you want to delete this?',
  'Confirm Delete',
  ['Delete', 'Cancel']
);
if (result === 'Delete') {
  // User confirmed
}

// Text prompt dialog
const folderName = await showTextPrompt(
  'Enter folder name',
  'Default Name',
  'Placeholder text...'
);
if (folderName) {
  // User entered a value
}
```

**Key Changes:**
- All styling now handled by Goober (no CSS classes needed)
- Uses `<Button>` component for all action buttons:
  - Default close button: `variant="medium-text" color="secondary"`
  - First option in options array: `variant="medium-text" color="danger"` (destructive action)
  - Other options: `variant="medium-text" color="primary"`
  - Cancel button in text prompt: `variant="medium-text" color="secondary"`
  - OK button in text prompt: `variant="medium-text" color="primary"`
- Portal rendering to document.body using `createPortal` from preact/compat
- Theme-responsive colors for overlay, dialog box, borders, text, and input fields
- Smooth transitions on border-color and box-shadow for input focus states
- Maintains keyboard shortcuts (Escape to cancel, Enter to confirm)
- Maintains overlay click-to-dismiss behavior
- Full backwards compatibility with existing API (showDialog and showTextPrompt functions)