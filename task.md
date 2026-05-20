# Extend & Reject Buttons

## Goal

Replace the "Add Page" and "Unlock" buttons in the AnyTale Parts & Plot tab with **Extend** and **Reject**. Extend is a renamed, repositioned version of Add Page with no behaviour change. Reject unlocks the current page and bulk-deletes all viewer images that were generated for that plot + page.

## Tasks

- [x] Rename "Add Page" → "Extend" and "Unlock" → "Reject", and reorder the nav row in `plot-section.mjs` so the sequence is: navigator controls, Delete Page, Reject, Extend.
- [x] Extract the Reject `onClick` into a `handleReject` callback in `PlotSection` that unlocks the page then calls an optional `onReject` prop with `{ plotUid, pageIndex }`.
- [x] Thread the `onReject` prop through `AnyTaleForm` down to `PlotSection`.
- [x] Implement `handleReject` in `AnyTalePage` that filters `history` by matching `plot.uid` and `plot.page`, batch-deletes the matching images via `DELETE /media-data/delete`, updates viewer state, and shows a success toast.

## Implementation Details

### Button order (nav row)

Old: `[NavigatorControl] [Add Page] [Delete Page] [Unlock]`
New: `[NavigatorControl] [Delete Page] [Reject] [Extend]`

Remove `marginLeft: 'auto'` from the old Unlock/Reject button — flex order handles spacing.

### `onReject` prop shape

```js
// Called by PlotSection after the page is unlocked
onReject?.({ plotUid: plot.uid, pageIndex: currentPageIndex });
```

If `plotUid` is falsy (plot not yet saved), no images will match and the call is a no-op on the parent side.

### Image match filter

Each history item has a `plot` field set at generation time:
```js
plot: { uid: string, name: string, page: number }
```
Match images using:
```js
history.filter(item => item.plot?.uid === plotUid && item.plot?.page === pageIndex)
```

### Batch delete API

```
DELETE /media-data/delete
Body: { "uids": [uid1, uid2, ...] }
```

### Prop threading chain

```
AnyTalePage  →  onReject={handleReject}  →  AnyTaleForm  →  onReject  →  PlotSection
```

### No confirmation dialog

Reject acts immediately with no confirmation prompt.

### Manual Tests

1. **Button layout** — Confirm the nav row order is: navigator controls, Delete Page, Reject, Extend.
2. **Extend works** — Clicking Extend inserts a page after the current one and advances the navigator (same as old Add Page).
3. **Reject unlocks** — With a locked page, clicking Reject makes the page fields editable.
4. **Reject deletes matching images** — Generate an image on a specific plot + page, lock the page, click Reject. The page unlocks, the image disappears from the viewer, and a toast shows "Rejected: deleted N image(s)".
5. **Reject with no images** — Reject a locked page with no generated images. Page unlocks silently (no toast, no error).
6. **Reject on unsaved plot** — Reject while the plot has no UID. Page unlocks; no crash or error.
7. **Other images unaffected** — Generate images on multiple pages, reject one. Only that page's images are removed from the viewer.
