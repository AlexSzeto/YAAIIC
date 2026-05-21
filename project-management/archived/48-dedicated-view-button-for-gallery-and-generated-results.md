# Dedicated View Button for Gallery & Generated Results

## Goals

Replace the click-to-preview behavior on gallery cards and generated result images with a dedicated `open_in_new` icon button. Card clicks in the gallery become selection/load actions directly, removing the intermediate preview modal step. Audio-type items are unaffected.

## Implementation Details

### Type Detection
- All generated items have an `imageUrl` (audio items have album cover images). The only reliable way to determine whether to show the view button is to check `item.type !== 'audio'` (gallery items) or `image.type !== 'audio'` (generated results).

### View Button Placement
- **GalleryPreview** (`gallery-preview.mjs`): Place inside the glass panel (`GalleryItemInfo`), on the left side, in the same slot used by the audio play/stop button. Both buttons can coexist on items that have both (though in practice image/video items won't have audio).
- **GeneratedResult** (`generated-result.mjs`): Absolutely positioned in the bottom-left corner of `MediaContainer`, styled similarly to `TimeOverlay` but anchored `bottom: 8px; left: 8px`.

### View Button Behavior
- Icon: `open_in_new`, variant `small-icon`
- Always visible (not hover-dependent)
- Opens `createImageModal(imageUrl)` — view only, no "Select as Input" action inside the modal
- The `onSelectAsInput` prop integration with `createImageModal` is removed

### Card Click — GalleryPreview
- Remove `handleImageClick` (opening modal / delegating to `onImageClick`)
- Clicking the image area calls `onSelect(item, !isSelected)` when `onSelect` is available — identical to clicking the checkbox
- When `onImageClick` is provided (used by gallery selection mode), call it directly without opening a modal

### Gallery Modal (`gallery.mjs`) — Click Behavior Changes
- **Selection mode**: `handleItemClick` no longer opens a modal. Instead, pass a direct handler via `onImageClick` that calls `onSelect(item)` + `onClose()` immediately on card click.
- **Non-selection mode**: Card click toggles multi-select (delegates to `handleItemSelect`, same as checkbox). Do not pass `onImageClick` to previews in this mode.

### GeneratedResult — Image Click
- Remove `onClick` from `GeneratedImage`. The image element is no longer clickable.

## Tasks

- [x] **Add view button to `GeneratedResult`**: In `generated-result.mjs`, add a `open_in_new` small-icon button absolutely positioned at `bottom: 8px; left: 8px` inside `MediaContainer`. Render it only when `image.type !== 'audio'`. Clicking it calls `createImageModal(image.imageUrl, true)`. Remove `onClick` from `GeneratedImage` at the same time.
  - **Manual test**: Open the app, generate or view an image result. Confirm the image is no longer clickable. Confirm the `open_in_new` button appears at the bottom-left and opens the image in the preview modal. Generate or view an audio result and confirm the button does not appear.

- [x] **Add view button to `GalleryPreview`**: In `gallery-preview.mjs`, add a `open_in_new` small-icon button inside the glass panel (`GalleryItemInfo`), to the left of the text content, in the same position as the audio play/stop button. Render it only when `item.type !== 'audio'`. Clicking it calls `createImageModal(item.imageUrl)` — no `onSelectAsInput` argument.
  - **Manual test**: Open the gallery. Confirm image/video cards show the `open_in_new` button in the bottom-left glass panel, always visible. Confirm the button opens the image modal. Confirm audio cards do not show the button and their play/stop button is unaffected.

- [x] **Repurpose card click in `GalleryPreview` for selection**: In `gallery-preview.mjs`, replace `handleImageClick` (currently on `GalleryItemImage`) with a handler that calls `onSelect(item, !isSelected)` when `onSelect` is available. If `onImageClick` is provided, call it directly (no modal). If neither prop is available, the click is a no-op.
  - **Manual test**: Open the gallery in non-selection mode. Click a card (not the view button or checkbox). Confirm the item is checked/unchecked (multi-select toggled) without opening a modal. Confirm the view button still opens the modal correctly.

- [x] **Update gallery selection mode to select on click**: In `gallery.mjs`, change the selection-mode `handleItemClick` to no longer open an image modal. Instead, pass a direct handler via `onImageClick` that immediately calls `onSelect(item)` + `onClose()`. In non-selection mode, do not pass `onImageClick` to previews (card click falls through to `onSelect`/checkbox toggle).
  - **Manual test**: Open the gallery from a context that triggers selection mode (e.g., picking an input image). Click a card directly. Confirm the gallery closes and the item is selected immediately, without a modal appearing. Confirm non-selection mode still allows multi-select by clicking cards.
