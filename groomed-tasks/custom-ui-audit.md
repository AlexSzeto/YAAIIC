# Custom-UI Audit: Application-Specific Logic

## Summary

This audit identifies instances where reusable UI components in `public/js/custom-ui/` contain logic or dependencies specific to the YAAIIC application. The `custom-ui` folder should contain generic, reusable components that can be extracted and used in other projects.

---

## Violations Found

### 1. `util.mjs` - ComfyUI Node Mappings

**Location:** `public/js/custom-ui/util.mjs` (Lines 361-389)

**Issue:** Contains hardcoded ComfyUI-specific node type mappings that are entirely application-specific:

```javascript
export const NODE_STEP_NAMES = {
  'CheckpointLoaderSimple': 'Loading model...',
  'LoraLoaderModelOnly': 'Loading LoRA...',
  'CLIPTextEncode': 'Encoding prompt...',
  'EmptyLatentImage': 'Preparing canvas...',
  'EmptySD3LatentImage': 'Preparing canvas...',
  'FluxGuidance': 'Configuring guidance...',
  'KSampler': 'Generating latent data...',
  'VAEEncode': 'Encoding data...',
  'VAEDecode': 'Decoding data...',
  'VAEEncodeForInpaint': 'Encoding for inpaint...',
  'LoadImage': 'Loading image...',
  'LoadImageMask': 'Loading mask...',
  'JWImageSaveToPath': 'Saving image...',
  'SaveImage': 'Saving image...',
  'JWAudioSaveToPath': 'Saving audio...'
};

export function getStepName(nodeType) {
  return NODE_STEP_NAMES[nodeType] || 'Processing...';
}
```

**Recommendation:** Move `NODE_STEP_NAMES` and `getStepName()` to the app-ui folder:
- Create `public/js/app-ui/comfyui-step-names.mjs`
- Export these from there and import in `progress-banner.mjs`

---

### 2. `util.mjs` - Hardcoded Application Name

**Location:** `public/js/custom-ui/util.mjs` (Line 329)

**Issue:** The `PageTitleManager` class has a hardcoded default title:

```javascript
export class PageTitleManager {
  constructor(defaultTitle = 'YAAIIG') {  // <-- App-specific default
    this.defaultTitle = defaultTitle;
    // ...
  }
}
```

**Recommendation:** 
- Remove the default value or change to a generic default (e.g., empty string or `'App'`)
- Require callers to always pass the app name explicitly

---

### 3. `msg/progress-banner.mjs` - SSE Manager Dependency

**Location:** `public/js/custom-ui/msg/progress-banner.mjs` (Lines 142, 160, 255-259)

**Issue:** The component requires an `sseManager` prop which is a YAAIIC-specific service that manages Server-Sent Events for ComfyUI task tracking:

```javascript
/**
 * @param {Object} props.sseManager - SSE manager instance for subscribing to progress events (required)
 */
export function ProgressBanner({ 
  taskId, 
  sseManager,  // <-- App-specific dependency
  // ...
}) {
  // Uses sseManager.subscribe(taskId, {...})
  // Uses sseManager.unsubscribe(taskId)
}
```

**Recommendation:** Decouple the component from the specific SSE manager interface:
1. **Option A - Generic Interface:** Define a generic progress subscription interface that can wrap any event source:
   ```javascript
   // In app-ui, create a wrapper
   const progressAdapter = {
     subscribe: (taskId, handlers) => sseManager.subscribe(taskId, handlers),
     unsubscribe: (taskId) => sseManager.unsubscribe(taskId)
   };
   ```

2. **Option B - Move Component:** Move `progress-banner.mjs` to `app-ui/` since it's inherently tied to the YAAIIC progress tracking system.

---

### 4. `msg/progress-context.mjs` - SSE Manager Dependency

**Location:** `public/js/custom-ui/msg/progress-context.mjs` (Lines 19, 23, 35)

**Issue:** The ProgressProvider component requires `sseManager` as a prop and passes it to child banners:

```javascript
/**
 * @param {Object} props.sseManager - SSE manager instance (required)
 */
export function ProgressProvider({ sseManager, children }) {
  // Passes sseManager to ProgressBanner
}
```

**Recommendation:** Same as above - either:
1. Create a generic subscription interface in `app-ui/`
2. Move both `progress-context.mjs` and `progress-banner.mjs` to `app-ui/`

---

### 5. `overlays/dialog.mjs` - Hardcoded Default Title

**Location:** `public/js/custom-ui/overlays/dialog.mjs` (Line 354)

**Issue:** The `showDialog()` function has an application-specific default title:

```javascript
export function showDialog(text, title = 'Generate Image', options = null) {
  //                               ^^^^^^^^^^^^^^^^^ App-specific default
}
```

**Recommendation:** Change to a generic default:
```javascript
export function showDialog(text, title = 'Dialog', options = null) {
```

---

## Files Reviewed (No Issues Found)

The following files contain only generic, reusable UI logic with no application-specific dependencies:

| Folder | Files |
|--------|-------|
| **Root** | `goober-setup.mjs`, `theme.mjs`, `themed-base.mjs`, `global-audio-player.mjs` |
| **io/** | `button.mjs`, `checkbox.mjs`, `input.mjs`, `select.mjs`, `textarea.mjs` |
| **layout/** | `icon.mjs`, `page.mjs`, `panel.mjs` |
| **media/** | `audio-player.mjs`, `audio-select.mjs`, `image-select.mjs` |
| **msg/** | `toast.mjs` |
| **nav/** | `button-group.mjs`, `navigator.mjs`, `use-item-navigation.mjs`, `use-pagination.mjs` |
| **overlays/** | `list-select.mjs`, `modal.mjs`, `modal-base.mjs` |

---

## Recommended Actions

### Priority 1: Move to `app-ui/`
| File | Content to Move |
|------|-----------------|
| `util.mjs` | `NODE_STEP_NAMES`, `getStepName()` → `app-ui/comfyui-step-names.mjs` |

### Priority 2: Fix Hardcoded Defaults
| File | Change |
|------|--------|
| `util.mjs` | Change `PageTitleManager` default from `'YAAIIG'` to `''` or remove default |
| `dialog.mjs` | Change `showDialog` default title from `'Generate Image'` to `'Dialog'` |

### Priority 3: Architectural Decision
Decide whether the progress tracking components (`progress-banner.mjs`, `progress-context.mjs`) should:
- **Stay in `custom-ui/`** with a generic subscription interface (requires refactoring)
- **Move to `app-ui/`** as application-specific components (simpler, acknowledges tight coupling)

---

## Implementation Guide

### Moving ComfyUI Step Names

1. Create `public/js/app-ui/comfyui-step-names.mjs`:
```javascript
export const NODE_STEP_NAMES = {
  // ... all ComfyUI node mappings
};

export function getStepName(nodeType) {
  return NODE_STEP_NAMES[nodeType] || 'Processing...';
}
```

2. Update `progress-banner.mjs` import:
```javascript
// Before
import { PageTitleManager, getStepName } from '../util.mjs';

// After
import { PageTitleManager } from '../util.mjs';
import { getStepName } from '../../app-ui/comfyui-step-names.mjs';
```

3. Remove exports from `util.mjs`

### Fixing PageTitleManager Default

```javascript
// Before
constructor(defaultTitle = 'YAAIIG') {

// After  
constructor(defaultTitle = '') {
```

### Fixing Dialog Default Title

```javascript
// Before
export function showDialog(text, title = 'Generate Image', options = null) {

// After
export function showDialog(text, title = 'Dialog', options = null) {
```
