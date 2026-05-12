# Multi-Type Part Values

## Goal

Expand the AnyTale part `type` field from a single string to a list of type strings, update all related UI to use a shared chip-based autocomplete component, and update prompt assembly logic so that a part is only hidden if all of its types are explicitly disabled, and template tag matching works against any of a part's types.

## Tasks

- [x] Add `chip` variant to `Button` (`button.mjs`) — mirrors `small-text` sizing and typography but uses fully rounded corners (`border-radius: 9999px`)
- [x] Add a confirm button (checkmark icon, `small-icon` variant) to `AutocompleteInput` (`autocomplete-input.mjs`) rendered inline to the right of the text input, firing the same Tab/Enter commit logic (first-match suggestion or raw typed value, then clear)
- [x] Create `ChipAutocompleteInput` component (`public/js/app-ui/chip-autocomplete-input.mjs`) that composes `AutocompleteInput` with a chip row below it; chips use the `chip` Button variant with an `x` icon to remove individual values
- [x] Migrate `config.type` from `string` to `string[]` in `anytale-state.mjs`: update `createDefaultPart` default to `[]`, and add a migration in `loadState` that coerces any legacy plain-string `type` value to a single-element array (or `[]` if blank)
- [x] Update `part-item.mjs` to replace the `<Input label="Type">` field with `<ChipAutocompleteInput>`; `PartItem` receives a new `allTypes: string[]` prop for autocomplete suggestions
- [x] Update `anytale-form.mjs` to compute and pass `allTypes` (all unique type strings across all current parts' `config.type[]` arrays) down to each `PartItem`
- [x] Replace the inline `AutocompleteInput` + manual chip rendering for Hidden Parts in `plot-section.mjs` with `<ChipAutocompleteInput>`; update `hiddenPartsSuggestions` to expand `config.type[]` per part (instead of a single `config.type` string)
- [x] Update `assemblePrompt` in `prompt-assembler.mjs` so a part is skipped only when **all** of its `config.type[]` values are present in `hiddenSet` (currently skips if the single type matches)
- [x] Update `expandPageTags` in `prompt-assembler.mjs` so a `{{typeName}}` token matches a part if **any** of its `config.type[]` values matches the token (case-insensitive)

## Implementation Details

### Data Shape Change

```js
// Before
config.type = 'hair'

// After
config.type = ['hair', 'wig']
```

**Migration** (in `loadState`): after parsing, for each part, if `typeof part.config.type === 'string'`, replace it with `part.config.type.trim() ? [part.config.type.trim()] : []`.

### `chip` Button Variant

Add `chip` as a recognised variant in `button.mjs`. It should share the same height, padding, font size, and gap as `small-text`, with the only difference being `border-radius: 9999px`. The size lookup block should treat `chip` the same as `small` for all dimensions, and the `borderRadius` override should be `'9999px'`.

### `AutocompleteInput` Confirm Button

The confirm button sits to the right of the `<Input>` element inside a new flex wrapper row. It uses `variant="small-icon"` and `icon="check"`. Its `onClick` handler replicates the Tab/Enter path: reads the current input value, finds the first matching suggestion (or uses the raw value), fires `onSelect`, then clears the native input element via `document.getElementById(inputIdRef.current)`. The button should be disabled when the `disabled` prop is `true`.

The layout change: wrap the existing `<Input>` in a `display: flex; align-items: flex-end; gap: <small gap>` container, with the `<Input widthScale="full">` taking `flex: 1` and the confirm button sitting beside it.

### `ChipAutocompleteInput` Props

```js
/**
 * @param {string}   props.label
 * @param {string}   [props.placeholder]
 * @param {string[]} props.suggestions   – autocomplete candidates
 * @param {string[]} props.values        – current chip list
 * @param {Function} props.onValuesChange – (newValues: string[]) => void
 * @param {boolean}  [props.disabled]
 */
```

`onSelect` from `AutocompleteInput` appends the selected value to `values` if not already present (case-insensitive duplicate check). Each chip is a `<Button variant="chip" icon="x" onClick={removeAtIndex}>` rendered inside a wrapping flex row with `flex-wrap: wrap`.

### Hidden Parts Logic (plot-section.mjs)

- `hiddenPartsSuggestions` currently iterates `[p.config?.name, p.config?.type]`; update to iterate `[p.config?.name, ...(p.config?.type ?? [])]`
- The `hiddenParts` page field remains `string[]` (unchanged) — the chip input maps directly to it

### Prompt Assembler Changes

**`assemblePrompt` — hidden check (before → after):**
```js
// Before
if (hiddenSet.has(partName) || hiddenSet.has(partType)) continue;

// After
const types = Array.isArray(part.config?.type) ? part.config.type : [];
const allTypesHidden = types.length > 0 && types.every(t => hiddenSet.has(t.toLowerCase()));
if (hiddenSet.has(partName) || allTypesHidden) continue;
```

**`expandPageTags` — token matching (before → after):**
```js
// Before
.filter(p => (p.config?.type || '').trim().toLowerCase() === tokenType)

// After
.filter(p => {
  const types = Array.isArray(p.config?.type) ? p.config.type : [];
  return types.some(t => t.trim().toLowerCase() === tokenType);
})
```

### Manual Testing Checklist

1. Open AnyTale, add a part — confirm the Type field is now a `ChipAutocompleteInput` with no chips by default
2. Type a type string and press Enter / Tab / the checkmark button — confirm a chip appears
3. Add a second part, start typing a type in the Type field — confirm the first part's types appear as suggestions
4. Click `x` on a chip — confirm it is removed
5. Save the state (navigate away and back) — confirm types persist and reload as an array
6. Load an older saved state with a plain-string type — confirm it migrates to a single-element array
7. In the Plot section, confirm Hidden Parts now also has the inline confirm button
8. In the Plot section, confirm that hiding a type string hides parts that have that type in their array; a part with two types is only hidden if both are in the hidden list
9. In the Plot section Page Tags, use a `{{typeName}}` template — confirm it matches any part that has that string in its type array
