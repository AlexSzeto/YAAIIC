# Progression Types & Parts Removal Data for Plot

## Goal

Add two global string-array properties — `progressionSections` and `progressionDisabledParts` — to the AnyTale plot data shape, and introduce editing UI for both inside `plot-section.mjs`. Both fields are currently inactive (not consumed by generation logic) and serve as metadata-only placeholders at this stage. The UI uses the existing `ChipAutocompleteInput` component already present in the plot section.

## Tasks

- [x] **Task 1: Extend the plot data shape in `anytale-state.mjs`**
  Add `progressionSections: []` and `progressionDisabledParts: []` to `createBlankPlot()`. In `loadPlot()`, defensively default both arrays the same way `hiddenParts` is handled — if either field is missing or not an array in the stored data, default to `[]`. No migration logic beyond the defensive default is needed (existing plots simply load the new fields as empty arrays).

  **Manual test:** Open the browser console and run `localStorage.removeItem('anytale-plot')`, then reload the page. Confirm `loadPlot()` returns an object with `progressionSections: []` and `progressionDisabledParts: []`. Also load an existing saved plot from the library — confirm the two new fields appear as `[]` without breaking anything.

- [x] **Task 2: Add editing UI for both fields in `plot-section.mjs`**
  Inside the existing `SectionWrapper`, add a new `VerticalLayout gap="medium"` block containing the two new inputs. Position it **below** the Page section block (`VerticalLayout` containing `H2 Page`, `TagInput`, `ChipAutocompleteInput Hidden Parts`, and the nav row) and **above** the existing `ButtonRow` (Save / Delete / Clear Plot buttons). Both inputs use the `ChipAutocompleteInput` component already imported.

  **`progressionSections`:**
  - `label="Progression Sections"`
  - `placeholder="Add a section name..."`
  - `suggestions` — a `useMemo`-derived list of unique, non-empty `section` strings from the already-fetched `plotList`. Compiled as: `plotList.map(p => p.section).filter(s => s && s.trim())` deduplicated (case-insensitive). `plotList` is already fetched and held in state on mount — no new fetch needed.
  - `values={plot.progressionSections || []}` → `onValuesChange` sets `plot.progressionSections` via `setPlot`

  **`progressionDisabledParts`:**
  - `label="Disabled Parts"`
  - `placeholder="Type a part name or type to disable..."`
  - `suggestions` — reuse the **exact same** `hiddenPartsSuggestions` memo already computed in the component (names + types from the `parts` prop). Do not create a duplicate memo; reference the existing value directly.
  - `values={plot.progressionDisabledParts || []}` → `onValuesChange` sets `plot.progressionDisabledParts` via `setPlot`

  Both are always enabled (no `disabled` prop needed at this stage — the page-lock concept applies only to the per-page inputs).

  Wrap both inputs in an `H2` labelled `"Progression"` at the top of the new block so the section is visually grouped.

  **Manual test:** Load or clear a plot. Confirm the "Progression" section appears between the Page nav row and the Save/Delete/Clear buttons. Add chips to both inputs and confirm they persist across a page reload (values are saved to localStorage via the existing `savePlotState` call in the `useEffect`). Save the plot to the server and re-load it — confirm the new fields round-trip correctly.
