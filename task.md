# Search-Select Modal and AnyTale Integration

## Goal
Implement a generic, highly reusable `search-select.mjs` modal component in the custom UI toolkit for browsing, filtering, and selecting items from large datasets. Integrate this new component into the AnyTale UI to replace existing autocomplete-based loading interfaces with a robust single-select modal, and supplement autocomplete-based multi-item inputs with a multi-select modal.

## Tasks
- [x] **Create `search-select.mjs` component base.** Implement the modal layout (title, filter input, scrollable list, footer with a "Close" button) in `public/js/custom-ui/overlays/search-select.mjs`. Use `modal-base.mjs` components and accept `items`, `displayLimit`, and `onClose` props. The filter input should automatically receive focus on open.
- [x] **Implement Filtering and Sorting logic.** Add real-time text filtering logic to the modal. Ensure items are sorted alphabetically ascending. Display a "No matches" text when the filter returns zero results. Normalize `items` prop to handle both simple string arrays and `{label: string, value: any}` object arrays. Cap the rendered items using the `displayLimit` prop.
- [x] **Implement Single-Select Mode.** Add a `mode="single"` (default) which renders list items as rectangular clickable buttons (similar styling to `list-select.mjs`). Clicking an item should fire an `onSelect(value)` callback and immediately close the modal.
- [x] **Implement Multi-Select Mode.** Add a `mode="multi"` which renders list items as checkboxes with labels. Clicking an item should toggle its selection state, update the modal's internal selected list, and fire `onSelect([values])`. The modal should remain open until closed manually. Ensure the modal can accept an `initialSelected` prop to correctly check items on open.
- [x] **Integrate Single-Select Mode in AnyTale (Load Plot).** In `plot-section.mjs`, replace the "Load Plot" autocomplete input with a new "Load" button. Place this button in the action buttons row, immediately before the "Save" button. Clicking it should open the `search-select` modal in single-select mode to load a plot.
- [x] **Integrate Single-Select Mode in AnyTale (Load Character).** In `character-section.mjs`, replace the "Load Character" autocomplete input with a new "Load" button in the action buttons row (before "Save"). Hook it up to the `search-select` single-select mode.
- [x] **Integrate Single-Select Mode in AnyTale (Load Outfit).** In `outfit-section.mjs`, replace the "Load Outfit" autocomplete input with a new "Load" button in the action buttons row (before "Save"). Hook it up to the `search-select` single-select mode.
- [x] **Integrate Multi-Select Mode in AnyTale (Library Parts).** In `character-section.mjs` and `outfit-section.mjs` where `ChipAutocompleteInput` is used to add parts from the library, add a "Search" icon button (magnifying glass) next to the "Done/Select" button. Clicking it should open `search-select` in multi-select mode. Ensure the modal's selection stays in sync with the displayed chips.
- [x] **Integrate Multi-Select Mode in AnyTale (Preferred Outfits).** In `character-section.mjs` where `ChipAutocompleteInput` is used for preferred outfits, add the "Search" icon button to open `search-select` in multi-select mode, syncing selections with the chips.
- [x] Unify all "Add parts from library" components - wrap it in a new component that contains both the autocomplete component and search-select button, and use it in all locations where there is an "add parts from library" component. Use single select list mode for this search-select button. when an item is selected, add it to the parts list.
- [x] The simultaneous presence of the interactive list button and the checkbox component inside is confusing the click input handlers. disable all button handling for any wrappers of the checkbox component in multi-select mode, and let the checkbox component itself be the sole emitter of check/uncheck events. If this is already done, then this is likely a state sync issue and we should do the reverse (to make sure it's not something else breaking the component): disable the chcekbox components, let the list item be the one sending the list change events, and let the checkboxes be a visual only component with no effect on the selected items state.
- [x] add a single mode search-select to the preview plot input.
- [x] add a 'autocomplete-input-button-wrapper' style div wrapper around ALL search-select buttons in the UI, so they would all line up correctly vertically with the autocomplete input. 
- [x] Remove the default behavior to pre-load the gallery based on character name. in the Parts & Plot tab, remove the Character Name input (this means removing the entire fixed section at the top), and move that functionality to the Generation section - the new input should be labelled 'Preview Image Name", right below the title "Generation". Add this input to the Character & Outfits tab as well, in the same position, and detatch the character name on that tab from being used as the name for the image being generated.

## Implementation Details

### Component Signature: `search-select.mjs`
```javascript
/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {string} props.title - Modal title
 * @param {Array<string|{label, value}>} props.items - Data source
 * @param {'single'|'multi'} [props.mode='single'] - Selection mode
 * @param {number} [props.displayLimit=100] - Max items to render
 * @param {string|string[]} [props.initialSelected] - Initially selected value(s)
 * @param {Function} props.onSelect - Callback on item selection
 * @param {Function} props.onClose - Callback to close modal
 */
```

### Component Specification: `search-select.mjs`

**Location:** `public/js/custom-ui/overlays/`
**Data Source:** Accepts an array of strings `['apple', 'banana']` or objects `[{label: 'Apple', value: 'apple'}]`.

**UI Layout & Behavior:**
- **Header:** Modal Title.
- **Search Bar:** A text input that automatically focuses on open.
- **Scrollable List:** 
  - Real-time text filtering.
  - Automatically sorts items alphabetically (ascending).
  - Uses a `displayLimit` property to cap the maximum number of items rendered.
  - Displays "no matches" text if the filter returns zero results.
- **Footer:** Row of action buttons containing a "Close" button. User can also click outside to dismiss.

**Selection Modes:**
- **Single-Select Mode (`mode="single"`):** 
   - Items render as rectangular clickable buttons.
   - Clicking an item fires `onSelect(value)` and immediately closes the modal.
- **Multi-Select Mode (`mode="multi"`):**
   - Items render as checkboxes with labels.
   - Clicking an item toggles its state and fires `onSelect([array of selected values])`.
   - The modal remains open until dismissed.

### Additional Notes

- **Auto-focus**: Use `useRef` and `useEffect` to focus the search input when `isOpen` becomes true.
- **Goober Refs**: Remember the `goober-styled-ref.md` rule. When auto-focusing the `Input` component from `custom-ui`, use a stable `id` and `document.getElementById` rather than a Preact `ref` if it's a `styled` component.
- **AnyTale Integration**:
  - The "Load" button should use the standard `<Button>` component from `custom-ui`.
  - Ensure the autocomplete data fetching logic is properly mapped to the `items` prop of `search-select`.
