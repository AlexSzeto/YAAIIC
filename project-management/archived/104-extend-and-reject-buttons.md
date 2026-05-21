# Extend & Reject Buttons

## Goal

Replace the "Add Page" and "Unlock" buttons in the AnyTale Parts & Plot tab with **Extend** and **Reject**. Extend is a renamed, repositioned version of Add Page with no behaviour change. Reject unlocks the current page and bulk-deletes all viewer images that were generated for that plot + page.

## Tasks

- [x] Rename "Add Page" → "Extend" and "Unlock" → "Reject", and reorder the nav row in `plot-section.mjs` so the sequence is: navigator controls, Delete Page, Reject, Extend.
- [x] Extract the Reject `onClick` into a `handleReject` callback in `PlotSection` that unlocks the page then calls an optional `onReject` prop with `{ plotUid, pageIndex }`.
- [x] Thread the `onReject` prop through `AnyTaleForm` down to `PlotSection`.
- [x] Implement `handleReject` in `AnyTalePage` that filters `history` by matching `plot.uid` and `plot.page`, batch-deletes the matching images via `DELETE /media-data/delete`, updates viewer state, and shows a success toast.
