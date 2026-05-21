# AnyTale Plot Data in Generation Records

## Goal

When an AnyTale image is generated, store the active plot's UID, name, and current page number alongside the existing `parts` data. When reprompting from that image, restore the correct plot first (by UID, then by exact name fallback), navigate to the stored page number, and handle gracefully: skip reload if the same plot is already loaded, and skip plot restore entirely if no plot data exists (legacy images).

## Tasks

- [x] **Add `plot` as a core schema field in `media-data-schema.json`**

  Add a new field `"plot"` to `server/resource/media-data-schema.json`:
  ```json
  "plot": { "type": "object", "default": null }
  ```
  This mirrors how `parts` is declared. Without this, the sanitizer will demote `plot` into `extraInputs`.

  **Manual test:** Start the server and POST to `/generate` with a `plot` key in the body. Fetch the resulting media entry via `GET /media-data/:uid` and confirm `plot` is a top-level field (not nested under `extraInputs`).

- [x] **Capture and forward plot data through the generate call chain**

  In `anytale-form.mjs` `handleGenerate`, after the existing `loadPlot()` call, build a `plotData` object if the plot has any identifying info:
  ```js
  const plotData = (currentPlot.uid || currentPlot.name)
    ? { uid: currentPlot.uid, name: currentPlot.name, page: activePlotPage }
    : null;
  ```
  Pass `plotData` as a fourth argument to `onGenerate(prompt, name, partsData, plotData)`.

  In `anytale.mjs` `handleGenerate`, receive `plotData` and include it in the `/generate` payload:
  ```js
  plot: plotData ?? null,
  ```

  **Manual test:** Load a saved plot, generate an image, then fetch the media entry via `GET /media-data/:uid`. Confirm the `plot` field contains the expected `{ uid, name, page }`. Generate without a plot loaded and confirm `plot` is `null`.

- [x] **Expose a reprompt handler from `PlotSection` for external callers**

  Add a new prop `onRepromptHandlerReady` to `PlotSection`. On mount (and when the handler changes), call it with an async function:
  ```js
  async function repromptLoadPlot({ uid, name, page }) { ... }
  ```
  On unmount, call `onRepromptHandlerReady(null)`.

  The handler logic (inside `PlotSection`, so it has access to `plot`, `plotList`, `onPageChange`, etc.):

  1. **Same plot already loaded** — if `plot.uid` is non-empty and matches `uid`, do not reload the plot (leave any unsaved changes intact), but still call `onPageChange(page)` to navigate to the stored page.
  2. **Load by UID** — call `GET /anytale/plot/:uid`. If successful, call `setPlot(fullPlot)`, `setSavedPlot(fullPlot)`, and `onPageChange(page)`.
  3. **UID not found — name fallback** — if the UID fetch fails (404 or error), search `plotList` for an entry where `p.name === name` (exact match). If found, fetch that plot by its UID, then apply the same set/setSaved/navigate steps.
  4. **Not found** — show a toast: `"Plot from image not found in library; parts were still restored."` and return without modifying the plot state.

  `AnyTaleForm` stores the registered handler in a ref (`plotRepromptFnRef`) via a `useCallback`-based `handlePlotRepromptReady` prop. Wire `PlotSection` to register this in a `useEffect` when the handler function changes.

  **Manual test:** This task has no standalone UI test yet; wire-up is validated in the next task.

- [x] **Call the plot reprompt handler from `AnyTaleForm.handleReprompt`**

  At the end of the existing parts-restore logic in `handleReprompt` (after `setParts(newParts)` succeeds):

  ```js
  const plotMeta = currentItem?.plot;
  if (plotMeta && (plotMeta.uid || plotMeta.name) && plotRepromptFnRef.current) {
    await plotRepromptFnRef.current({ uid: plotMeta.uid, name: plotMeta.name, page: plotMeta.page ?? 0 });
  }
  ```

  If `currentItem.plot` is absent or null, skip this block entirely — parts are restored normally, and the plot section is untouched (backward compatibility for pre-feature images).

  Update the `canReprompt` condition to also check for `currentItem.plot` OR `currentItem.parts` (either is enough to enable the button):
  ```js
  const canReprompt = (!!currentItem?.parts || !!currentItem?.plot) && !isGenerating && !isReprompting;
  ```

  **Manual test:**
  1. Load a saved plot, generate an image, then click Reprompt on that image. Confirm the correct plot is loaded and the page navigator jumps to the stored page.
  2. Load a *different* plot in the form, then reprompt the same image. Confirm the first plot is re-loaded (UID match triggers a real load).
  3. Reprompt the same image again without changing anything. Confirm the same plot stays loaded with unsaved changes intact (UID matches, no reload — but page navigation does still fire).
  4. Delete the plot from the library, then reprompt the image. Confirm the name fallback is attempted and, if the name also doesn't match, the warning toast appears but parts are still restored.
  5. Reprompt an older image that has `parts` but no `plot` field. Confirm parts are restored and the plot section is unchanged.

## Implementation Details

### Data Shape

The `plot` field stored on a media entry:
```json
{
  "plot": {
    "uid": "my-plot-uid",
    "name": "My Plot Name",
    "page": 2
  }
}
```
`page` is 0-based, matching `activePlotPage`.

### `handleGenerate` Signature Change

`onGenerate` gains a fourth argument:
```
onGenerate(assembledPrompt, name, partsData, plotData)
```
- `plotData` is `{ uid, name, page }` if a plot with any identifier is active, or `null` otherwise.

### `PlotSection` Props Addition

```js
PlotSection({ ..., onRepromptHandlerReady })
```
- Called with a function on mount (and whenever the internal handler identity changes).
- Called with `null` on unmount.

### `AnyTaleForm` Ref

```js
const plotRepromptFnRef = useRef(null);
const handlePlotRepromptReady = useCallback((fn) => {
  plotRepromptFnRef.current = fn;
}, []);
```
Passed to `PlotSection` as `onRepromptHandlerReady={handlePlotRepromptReady}`.

### Page Number Mismatch

The stored `page` is applied directly via `onPageChange(page)` with no range clamping at the call site — `PlotSection` already clamps via `Math.min(Math.max(activePage, 0), pageCount - 1)` internally.
