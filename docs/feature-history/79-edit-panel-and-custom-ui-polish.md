# Edit Panel & Custom UI Polish

## Goal

Improve the edit panel's scroll behavior so only the parts list scrolls, add a reusable per-item enabled toggle to `DynamicList`, add label support to `Button`, build a custom tooltip system and migrate existing usages, add tooltips to `Select` and tag value inputs, and prefill the tag search when no category is selected on a category attribute.

## Tasks

- [x] Fix edit panel scroll: only the Parts `DynamicList` scrolls; character name input, prompt preview, and button row remain fixed
- [x] Add `getEnabled(item, index) => boolean` and `onToggleEnabled(item, index)` props to `DynamicList`; render an unlabelled checkbox between the caret and the title (expanded mode) and to the left of the content (condensed mode); only rendered when props are provided; add usage example to `custom-ui/test.html`
- [x] Migrate the `data.enabled` checkbox in `PartItem` to use the new `DynamicList` `getEnabled`/`onToggleEnabled` props and remove the inline enabled checkbox from `PartItem`'s `TopRow`
- [x] Add `label` prop to `Button` (custom-ui); when provided, wrap the button in a vertical stack with a label rendered above it (same style as `Input`'s label); layout unchanged when `label` is null/empty; add usage example to `custom-ui/test.html`
- [x] Migrate the category attributes category button in `PartItem`: replace `<CategoryButtonLabel>Category</CategoryButtonLabel>` + `<Button>` with a single `<Button label="Category">` and remove all custom wrapper styling (`CategoryButtonGroup`, `CategoryButtonLabel`)
- [x] Create `public/js/custom-ui/overlays/tooltip.mjs` — `TooltipContext`, `TooltipProvider` using the same portal/context pattern as `toast.mjs`; tooltip appears after a standard hover delay (~600ms), positioned below-and-right of the cursor at the moment of initial hover (no cursor follow); add `TooltipProvider` to the app's root provider chain; add usage example to `custom-ui/test.html`
- [x] Rename `Button`'s `title` prop to `tooltip` and wire it to the custom tooltip system (via context) instead of the native `title` attribute; update all internal usages of `title=` on `<Button>` within `dynamic-list.mjs` and any other custom-ui files
- [x] Add `tooltip` prop to the `Select` custom-ui component wired to the same tooltip system; add usage example to `custom-ui/test.html`
- [x] In `PartItem`, add a tooltip to the category attribute value `<Select>` and custom attribute value `<Select>`; tooltip text = `definitions[selectedValue]` from the `/tags` response (already available in component state); show nothing if no definition exists for the value
- [x] In `PartItem`, when opening `TagSelectorPanel` for a category attribute that has no category selected (`attr.category` is empty/falsy), pass the part's `config.name.toLowerCase()` as the initial search prefill into the panel; the prefill is set only on open and the user may freely edit it from there

## Implementation Details

### Edit Panel Scroll (task 1)
- File: `public/js/app-ui/anytale/anytale-form.mjs`
- Currently the entire edit tab content is wrapped in a single `<ScrollableContent>` (`overflow-y: auto; flex: 1 1 auto`).
- New layout: remove `<ScrollableContent>` from the outer wrapper. The outer container should be a flex column that fills available height. The character name `<Input>` sits at the top (fixed height). The `<DynamicList title="Parts">` is wrapped in its own scrollable container (`overflow-y: auto; flex: 1 1 auto`). The `<PromptPreview>` and `<ButtonRow>` sit below, fixed.

### DynamicList Enabled Toggle (task 2)
- New props: `getEnabled: (item, index) => boolean`, `onToggleEnabled: (item, index) => void`
- Expanded (`DynamicListItem`): render a plain `<input type="checkbox">` between the `<Icon>` (caret) and `<ItemTitle>`. Stop click propagation on the checkbox so it doesn't collapse the panel.
- Condensed (`CondensedDynamicListItem`): render the checkbox to the left of `<CondensedItemContent>`.
- Both modes: only render the checkbox when `getEnabled` prop is provided.
- Style the checkbox minimally (no label, vertically centered).

### Button Label (task 4)
- New prop: `label?: string`
- When `label` is provided and non-empty: wrap the existing button element in a `<div style="display:flex;flex-direction:column;gap:4px;">` with a `<Label>` styled component above it (same styles as the label in `input.mjs`: `theme.colors.text.primary`, `theme.typography.fontSize.medium`, `theme.typography.fontWeight.medium`).
- When `label` is null/empty: render the button exactly as today (no wrapper).

### Tooltip System (task 6)
- File: `public/js/custom-ui/overlays/tooltip.mjs`
- Pattern: mirrors `toast.mjs` — exports `TooltipContext` and `TooltipProvider`.
- Context API: `{ show(text, anchorX, anchorY), hide() }` — consumers call `show` on `mouseenter` with the cursor coordinates captured at that moment, and `hide` on `mouseleave`.
- The provider renders a single portal tooltip div (via `createPortal`) positioned `fixed` at `(anchorX + 12, anchorY + 16)` (below-right offset). Position is set once on show and never updated.
- Appearance delay: 600ms — use a `setTimeout` that is cleared if `hide()` is called before it fires.
- Styling: matches the existing `HoverPanel` glass aesthetic (`theme.colors.overlay.glass`, `backdropFilter: blur(8px)`), small font, rounded corners, `z-index: 20000`, `pointer-events: none`, max-width 300px, `white-space: pre-wrap`.
- `TooltipProvider` must be added to the root provider chain wherever `ToastProvider` and `HoverPanelProvider` are mounted.

### Button `tooltip` prop (task 7)
- The `title` prop is renamed to `tooltip`. The native `title` attribute is removed.
- On `mouseenter`, call `tooltipContext.show(tooltip, e.clientX, e.clientY)`.
- On `mouseleave`, call `tooltipContext.hide()`.
- The button consumes `TooltipContext` via `useContext` (functional) or `this.context` (class — set `static contextType = TooltipContext`).
- All internal `<Button title="...">` usages in `dynamic-list.mjs` and other custom-ui files must be updated to `tooltip=`.

### Tag Value Tooltip (task 9)
- The `/tags` fetch response already includes `definitions: { [underscoreTag]: string }`.
- The selected value stored in `data.categoryAttributeValues[i]` is already in underscore form (e.g. `"blonde_hair"`), so `definitions[selectedValue]` is a direct lookup.
- Pass `tooltip=${definitions[selectedValue] ?? ''}` to the value `<Select>` component.
- Custom attributes: their values come from a similar select — apply the same pattern.

### Category Prefill (task 10)
- File: `public/js/app-ui/anytale/part-item.mjs`
- `TagSelectorPanel` accepts an `initialSearch` prop (or equivalent) — confirm the prop name before implementing.
- Only pass the prefill when `attr.category` is falsy. Pass `config.name.toLowerCase()` as the value.
- The prefill is one-time: `TagSelectorPanel` uses it only on mount; the user can freely type from there.
