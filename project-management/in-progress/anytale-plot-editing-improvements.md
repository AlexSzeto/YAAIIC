# Anytale Plot Editing Improvements

## Goal

Improve the AnyTale plot editor with two-stage delete/recover flows for both plots and pages, shift-click range selection in the gallery modal, anytale-aware media sorting on gallery load and initial page load with automatic jump to the current page image, `dialog` stored as a dedicated media field and displayed as a speech bubble in the viewer, dialog generated before images when a plot is queued, the unlock-page button removed, and Reject/Extend gated on media availability rather than lock state.

## Tasks

### Phase 1 — Delete/recover flows and lock state cleanup

- [x] Add `recoveryPlot` state to `plot-section.mjs`; keep the existing confirmation dialog in `handleDelete`, store the full plot record (including UID) in `recoveryPlot` after confirmation, blank the UI, then fire the API delete; swap the Delete button for a Recover button (primary color, recycle icon) while `recoveryPlot` is set; on Recover, prompt confirmation, re-save the stored plot via the existing save endpoint (preserving original UID), restore it into editing state, and clear `recoveryPlot`; clear `recoveryPlot` also on any successful save or successful load

#### Fixes and Changes
- [x] Restore the confirmation dialog to the plot-level `handleDelete`; no-confirmation applies only to the page delete button
- [x] Add `recoveryPage` state to `plot-section.mjs`; remove the confirmation dialog from `handleDeletePage`, store the removed page object and its original index before splicing, swap the Delete Page button to a recycle icon while `recoveryPage` is set; clicking the recycle icon inserts the stored page back at its original index and clears `recoveryPage`; clear `recoveryPage` when the current page index changes for any reason (navigation, add page, another delete), or when a plot-level revert or delete completes — save does not clear it
- [x] Remove the Unlock Page button and `handleUnlock` from `plot-section.mjs`
- [x] Pass `history` down from `anytale.mjs` → `anytale-form.mjs` → `plot-section.mjs` as a prop; compute `hasMediaForCurrentPage = history.some(item => item.plot?.uid === plot.uid && item.plot?.page === currentPageIndex)`; replace `!isCurrentPageLocked` as the disabled condition on both Reject and Extend with `!hasMediaForCurrentPage`

### Phase 2 — Gallery improvements

- [ ] Add a `lastSelectedUid` ref to `gallery.mjs`; update it on every direct (non-shift) item click; when a click arrives with `shiftKey` held and exactly one item is currently selected and `lastSelectedUid` is set, find both items by UID in the full `galleryData` array and select every UID in the range between them (inclusive); leave existing single-toggle logic unchanged for non-shift clicks
- [ ] Add a `plot` sort mode to `service.mjs` that groups items by `plot.uid`, orders groups by the smallest numeric UID in each group ascending, sorts within each group by `plot.page` ascending, then appends all non-anytale items (no `plot` field) sorted by timestamp descending; expose it via `sort=plot` query param on `/media-data`

### Phase 3 — Dialog field and viewer integration

- [ ] Add `dialog` as a string field (default `""`) to `server/resource/media-data-schema.json`
- [ ] Add an optional `dialogText` parameter to `handleGenerate` in `anytale.mjs`; include it in the generation payload as `dialog` when non-empty; for single-page generation, pass `dialogPreviews[currentPageIndex]` (if set) through `onGenerate`
- [ ] Make `handleFullPlotTest` in `anytale-form.mjs` async; refactor `bulkDialogGenerate` in `plot-section.mjs` to return a `pageIndex → dialogText` map in addition to updating `dialogPreviews` state; await `bulkDialogGenerate(queuedIndices)` before the image queue loop; pass each page's dialog text into `onGenerate`; remove the post-loop `plotBulkDialogFnRef.current?.(queuedIndices)` call
- [ ] In `anytale-viewer.mjs`, add an absolutely-positioned `DialogOverlay` inside `ImageWrapper` anchored to the top with theme spacing; import `SpeechBubble` from `./play/speech-bubble.mjs`; render it with `item.dialog` as content when `item.dialog` is non-empty; set `pointer-events: none` so it does not block image interaction

### Phase 4 — Anytale-aware sort and initial load jump

- [ ] Change the gallery `onLoad` handler in `anytale.mjs` to request `sort=plot`; apply the same param to the initial-load fetch effect
- [ ] After the initial-load effect sets the sorted history, call `handleViewPageImage({ plotUid: currentPlot.uid, pageIndex: currentPageIndex })` if the plot has a UID; pass a `silent` flag (or guard inside `handleViewPageImage`) to suppress the "not found" toast for this automatic call
- [ ] Review and update affected living docs: `docs/features/anytale.md`

## Implementation Details

### Plot delete two-stage

`recoveryPlot` holds the complete plot object (all fields including `uid`) at the moment of deletion. The Delete button (currently hardcoded `disabled={true}` at line 720 of `plot-section.mjs`) becomes active and gains two-stage behavior. While `recoveryPlot !== null`, the button row renders Recover instead of Delete.

Recovery calls `savePlot(recoveryPlot.uid, recoveryPlot)` — the same endpoint as a normal save — which re-inserts the record under its original UID.

Clear triggers for `recoveryPlot`: successful `handleSave`, successful `handleLoadPlot`. Revert does not clear it.

### Page delete two-stage

`recoveryPage` is `{ page: <page object>, index: <number> } | null`. The recycle icon button occupies the same position as the Delete Page button. Restoring: `newPages.splice(recoveryPage.index, 0, recoveryPage.page)` — the corresponding `pageLocked` entry is also re-inserted at the same index with value `false`.

Clear triggers for `recoveryPage`: `currentPageIndex` changes for any reason, `handleAddPage` fires, a second `handleDeletePage` fires, `handleRevert` completes, `handleDelete` completes. `handleSave` does not clear it.

### Reject and Extend gating

`history` (the media record array from `anytale.mjs`) is forwarded as a new `history` prop through `anytale-form.mjs` to `plot-section.mjs`. The check:

```js
const hasMediaForCurrentPage = history.some(
  item => item.plot?.uid === plot.uid && item.plot?.page === currentPageIndex
);
```

This replaces `!isCurrentPageLocked` as the `disabled` prop on both Reject and Extend.

### Shift-click range selection

`lastSelectedUid` is a `useRef(null)` updated to the clicked item's UID on every non-shift toggle. On a shift-click with exactly one item already selected:

1. Find the anchor: `galleryData.findIndex(i => i.uid === lastSelectedUid.current)`
2. Find the target: `galleryData.findIndex(i => i.uid === clickedUid)`
3. Select all UIDs from `Math.min(anchor, target)` to `Math.max(anchor, target)` inclusive

Range selection requires `selectedItems.length === 1` and a valid `lastSelectedUid`.

### Anytale-aware sort (`sort=plot`)

```js
// New branch in service.mjs searchMedia sort block:
if (sort === 'plot') {
  const withPlot = filtered.filter(i => i.plot?.uid);
  const withoutPlot = filtered.filter(i => !i.plot?.uid);

  const groups = new Map();
  for (const item of withPlot) {
    const uid = item.plot.uid;
    if (!groups.has(uid)) groups.set(uid, []);
    groups.get(uid).push(item);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (a.plot.page ?? 0) - (b.plot.page ?? 0));
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));

  withoutPlot.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  filtered = [...sortedGroups.flatMap(([, g]) => g), ...withoutPlot];
}
```

Groups are ordered by their earliest (smallest numeric) plot UID so the oldest-created plot appears first.

### Dialog field

Add to `server/resource/media-data-schema.json`:
```json
"dialog": { "type": "string", "default": "" }
```

The sanitizer treats `dialog` as a core field and stores it directly (not in `extraInputs`). Existing records without `dialog` will simply have the field absent; the viewer guards with `item.dialog` being falsy so no migration is required.

`dialog` is passed alongside `plot`, `parts`, etc. in the generation payload. The field name does not conflict with any workflow node input name and passes through the workflow data filtering unchanged.

### `bulkDialogGenerate` return value

Refactor to accumulate and return results:

```js
const results = {};
// ... existing loop body ...
results[i] = result;
setDialogPreviews(prev => ({ ...prev, [i]: result }));
// ...
return results;
```

`handleFullPlotTest` becomes `async` and awaits before the queue loop:

```js
const dialogMap = await plotBulkDialogFnRef.current?.(queuedIndices) ?? {};
for (let i = 0; i < plotPageCount; i++) {
  if (!pageWillQueue[i]) continue;
  // ...
  onGenerate(prompt, currentPlot.name || '', partsData, plotData, dialogMap[i] || '');
}
// post-loop plotBulkDialogFnRef call removed
```

### Speech bubble in viewer

`DialogOverlay` is an absolutely-positioned styled div inside `ImageWrapper` (`position: relative`):

```js
const DialogOverlay = styled('div')`
  position: absolute;
  top: ${() => currentTheme.value.spacing.medium.padding};
  left: ${() => currentTheme.value.spacing.medium.padding};
  right: ${() => currentTheme.value.spacing.medium.padding};
  z-index: 2;
  pointer-events: none;
`;
```

`SpeechBubble` is imported from `./play/speech-bubble.mjs` — no file move required since both are within `app-ui/anytale/`.

### Initial load auto-jump

After `setHistory(sorted)` in the initial-load effect:

```js
if (currentPlot.uid) {
  handleViewPageImage({ plotUid: currentPlot.uid, pageIndex: currentPageIndex, silent: true });
}
```

Add a `silent` parameter to `handleViewPageImage` in `anytale.mjs` that suppresses the `toast.show('Page image not found', 'warning')` call when the auto-jump finds no matching item.
