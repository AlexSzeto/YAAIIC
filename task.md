# AnyTale Plot Page UI Overhaul — Slot Tracker, Conditional Pages, Layout Rearrangement

## Goal
Rearrange the plot page edit UI into a new vertical order, introduce a collapsible part slots tracker panel showing pre-page slot statuses, and add conditional page requirements that gate whether a page's actions are applied during slot resolution.

## Tasks

- [x] Task 1: Schema — Add `requirements` field to page data
  - In `anytale-state.mjs`, update `createBlankPlot()`: add `requirements: []` to each blank page object (alongside `tags`, `dialogPrompt`, `actions`).
  - In `loadPlot()`, add a defensive default in the `pages.map()`: `requirements: Array.isArray(p.requirements) ? p.requirements : []`.
  - **Manual test:** Open AnyTale, create a new plot or clear the existing one. Inspect `localStorage.getItem('anytale-plot')` in the browser console and confirm each page object has a `requirements` array field.

- [x] Task 2: Core — Update `resolveSlotStatuses` to support conditional page skipping
  - In `slot-resolver.mjs`, add a module-level helper `checkPageRequirements(page, statuses, activeParts)`:
    - If `page.requirements` is empty or missing, return `true` (no requirements = always active).
    - For each requirement string `req` in `page.requirements`:
      - Find all parts in `activeParts` where `part.config?.name?.toLowerCase() === req.toLowerCase()` OR any entry in `part.config?.type` matches `req` case-insensitively.
      - Among those matched parts, check if ANY of their slot type strings (lowercased) appear in `statuses` with a value other than `'removed'` (i.e., `statuses.get(slotKey)` exists and is not `'removed'`).
      - If no matched part satisfies this condition, return `false`.
    - Return `true` if all requirements pass.
  - Update the action-replay loop in `resolveSlotStatuses`: before applying a page's actions, call `checkPageRequirements(pages[i], statuses, activeParts)`. If it returns `false`, skip that page's actions via `continue`.
  - **Manual test:** Add a requirement to a page via browser console: `const p = JSON.parse(localStorage.getItem('anytale-plot')); p.pages[1].requirements = ['some slot name']; localStorage.setItem('anytale-plot', JSON.stringify(p));`. Reload AnyTale and add a `console.log` temporarily in `slot-resolver.mjs` to verify the page is skipped when the slot is removed. Restore after testing.

- [x] Task 3: UI — Rearrange the plot page edit layout
  - In `plot-section.mjs`, reorder the JSX inside the Page `<VerticalLayout>` to match this new vertical order:
    1. `<H2>Page</H2>` — page title
    2. Slot tracker panel (placeholder `<div>` for now — will be implemented in Task 5)
    3. `<H3>` for "Page Requirements" (with indicator placeholder — will be wired in Task 4)
    4. `<ChipAutocompleteInput>` for `requirements` (placeholder — will be wired in Task 4)
    5. `<H3>Actions</H3>` + status/slot dropdowns (in that order — Status first, then Slot) + add button + chip row (existing)
    6. `<Input label="Action Description for Dialog Prompt">` (existing `dialogPrompt` field — move below actions)
    7. `<TagInput label="Page Tags">` (move below action description)
    8. `<NavRow>` — navigation (stays last in page section)
  - Do not change the outer Progression section or the save/load button row — those remain below the Page section.
  - **Manual test:** Open AnyTale → Plot section. Confirm the new visual order matches the spec. Confirm all existing interactions (tags, actions, navigation, lock) still work correctly.

- [x] Task 4: UI — Add Page Requirements chip input with unmet-requirements danger indicator
  - In `plot-section.mjs`, compute `priorSlotStatuses` via a `useMemo`:
    - Filter `parts` (the prop) to enabled parts: `parts.filter(p => p.data?.enabled !== false)`.
    - Call `resolveSlotStatuses(enabledParts, plot.pages, currentPageIndex - 1)`.
    - For page 0 (`currentPageIndex - 1 = -1`), the existing loop guard `for (let i = 0; i <= limit; i++)` with `limit = Math.min(-1, ...)` naturally exits immediately, returning the initial all-`'covering'` statuses — no special case needed.
    - Import `resolveSlotStatuses` from `./slot-resolver.mjs`.
  - Compute `requirementsMet` (boolean) via `useMemo`: call `checkPageRequirements` (exported from `slot-resolver.mjs`) on `currentPage` with `priorSlotStatuses` and the enabled parts list. Export `checkPageRequirements` from `slot-resolver.mjs` if not already exported.
  - Build the `requirementsSuggestions` array via `useMemo`: collect all unique lowercase part names from `libraryParts` (via `p.config?.name`) and all unique slot types from `slotOptions` into a single flat array (no label differentiation — reuse `ChipAutocompleteInput` as-is).
  - Render the Page Requirements section:
    - An `<H3>` row containing the label "Page Requirements" and, if `!requirementsMet`, an `<Icon name="radio-circle-marked" color=${theme.colors.danger.text} size="16px" />` immediately after the text.
    - A `<ChipAutocompleteInput>` bound to `currentPage.requirements`, calling `updatePage(currentPageIndex, { ...currentPage, requirements: newValues })` on change.
  - Import `Icon` from `../../custom-ui/layout/icon.mjs`. Access the current theme color via `currentTheme.value.colors.danger.text`.
  - **Manual test:** Add a requirement that matches an existing part's name or slot. Confirm no danger icon appears. Add a requirement for a non-existent slot/name. Confirm the danger icon (`radio_button_checked` in Material Symbols or the equivalent box-icon) appears next to the header. Confirm chips appear, can be added and removed, and persist in localStorage.

- [x] Task 5: UI — Add Part Slots Tracker panel
  - In `plot-section.mjs`, add a `slotTrackerExpanded` boolean state (default `false`).
  - Compute `trackerSlots` via `useMemo`: from `priorSlotStatuses` (computed in Task 4), produce an array of `[slotName, status]` pairs sorted alphabetically by slot name.
  - Render the tracker panel in position 2 of the page section (below the `<H2>Page</H2>` title). Use `<Panel variant="outlined" padding="small">` from `../../custom-ui/layout/panel.mjs`.
  - Inside the panel, use a single content `<div>` with `overflow: hidden` and a `max-height` CSS value:
    - Collapsed: `max-height: '36px'` (matches `small-icon` button height including line-height; adjust if needed).
    - Expanded: `max-height: 'none'`.
    - Add `transition: max-height 0.2s ease` for a smooth collapse animation.
  - Inside the content div, render the expand/collapse button **first** using `float: right` via inline style so pills flow around it:
    ```
    <Button
      variant="small-icon"
      icon=${slotTrackerExpanded ? 'collapse-right' : 'expand-right'}
      style={{ float: 'right' }}
      onClick=${() => setSlotTrackerExpanded(v => !v)}
    />
    ```
  - After the button, render pill elements using a local `styled` div (`SlotPill`) styled like a chip: `display: inline-flex; align-items: center; gap: 4px; padding: <small padding from theme>; background: <theme.colors.secondary.backgroundLight>; border-radius: <theme.border.radius>; font-size: <theme.typography.fontSize.small>`. The pills themselves are not interactive — do NOT use `Button`.
  - Inside each pill, render a `<span>` with the slot name. Set the pill's background color based on status:
    - `'covering'` → `theme.colors.success.backgroundLight`
    - `'revealing'` → `theme.colors.warning.backgroundLight`
    - `'removed'` → `theme.colors.danger.backgroundLight`
  - Wrap the pills in a `styled` div (`SlotPillRow`) with `display: flex; flex-wrap: wrap; gap: <theme.colors.small.gap>; align-items: center`.
  - **Manual test:** Open AnyTale with parts loaded. The tracker panel should appear below "Page" title. Pills should show all slot types from enabled parts with background colors matching their current pre-page statuses (success/warning/danger). Click the expand button — all pills become visible. Click collapse — overflowing pills are hidden. Navigate to a later page that has actions — verify the statuses and background colors update to reflect actions from prior pages. Disable a part in the Parts & Plot tab — verify its slot disappears from the tracker.

## Implementation Details

### New Page Data Shape
```js
{
  tags: '',
  dialogPrompt: '',
  actions: [],      // [{ slot: string, status: string }]
  requirements: [], // string[] — part names or slot type strings
}
```

### `checkPageRequirements` — Export and Spec
Export this function from `slot-resolver.mjs` so both the resolver loop and the UI can call it.

```js
/**
 * Returns true if all of the page's requirements are satisfied by the current
 * pre-page slot statuses. A requirement string is satisfied when at least one
 * part in activeParts matches by name OR slot type, and has at least one slot
 * type present in statuses at a non-'removed' value.
 */
function checkPageRequirements(page, statuses, activeParts) { ... }
```

### `resolveSlotStatuses` — Updated Loop
```js
for (let i = 0; i <= limit; i++) {
  if (!checkPageRequirements(pages[i], statuses, activeParts)) continue;
  for (const action of (pages[i]?.actions || [])) { ... }
}
```

### Pre-Page Statuses in the UI
`priorSlotStatuses` in `plot-section.mjs` = `resolveSlotStatuses(enabledParts, plot.pages, currentPageIndex - 1)`.
- `enabledParts` = `parts.filter(p => p.data?.enabled !== false)` where `parts` is the component prop (Parts & Plot tab parts).
- When `currentPageIndex === 0`, passing `-1` causes the replay loop to run zero iterations, returning the initial pool statuses (all `'covering'`).

### Status Color Mapping (for Slot Tracker pills)
| Status | Theme token (background) |
|--------|--------------------------|
| `'covering'` | `theme.colors.success.backgroundLight` |
| `'revealing'` | `theme.colors.warning.backgroundLight` |
| `'removed'` | `theme.colors.danger.backgroundLight` |

### Requirement Suggestions Source
Combine into one flat array (no grouping):
- All unique part names from `libraryParts`: `p.config?.name` filtered to non-empty strings.
- All unique slot types from `slotOptions` (already computed from `libraryParts`).
Deduplicate case-insensitively. Pass the result to `ChipAutocompleteInput` as `suggestions`.

### Slot Tracker Collapse Behaviour
- The expand/collapse `Button` is rendered with `style={{ float: 'right' }}` inside the content `<div>`. This causes the flex pill row to wrap around it naturally.
- Collapsed `max-height` should equal the button's rendered height. The `small-icon` button variant is typically `32px` tall; add the panel's small padding top (`theme.spacing.small.padding`) to arrive at the total clip height. Use `36px` as the default; adjust visually if needed.
- Apply `overflow: hidden` on the content div at all times so collapsed clipping works.

### Key File Locations
- Page schema: `public/js/app-ui/anytale/anytale-state.mjs`
- Slot resolver: `public/js/app-ui/anytale/slot-resolver.mjs`
- Plot page UI: `public/js/app-ui/anytale/plot-section.mjs`
- Panel component: `public/js/custom-ui/layout/panel.mjs`
- Icon component: `public/js/custom-ui/layout/icon.mjs`

---

# Revealing Toggle for Parts

## Goal
Add an `isRevealing` flag to each part's config that controls its base slot status in slot resolution. Parts with `isRevealing: true` contribute `'revealing'` (rather than `'covering'`) as their base slot status, allowing the system to represent parts that expose rather than cover what's underneath.

## Tasks

- [x] Task 6: Schema — Add `isRevealing` to part config
  - In `anytale-state.mjs`, update the JSDoc comment block at the top to include `isRevealing: boolean` inside the `config` shape.
  - In `createDefaultPart()`, add `isRevealing: false` to the `config` object.
  - In `loadState()`, inside the `parts` array mapping, add a defensive default for `isRevealing` on each part's config: `isRevealing: typeof p.config?.isRevealing === 'boolean' ? p.config.isRevealing : false`.
  - **Manual test:** Open AnyTale, clear state via `localStorage.removeItem('anytale-state')` and reload. Inspect `localStorage.getItem('anytale-state')` after making any change — confirm each part's `config` object contains `isRevealing: false`. Also add a part, toggle the checkbox (Task 7), and confirm `isRevealing` updates.

- [x] Task 7: UI — Add "Reveals Parts Underneath" checkbox to PartItem
  - In `part-item.mjs`, add a checkbox below the `ChipAutocompleteInput` for Type (inside `<RightFields>`), labelled "Reveals Parts Underneath".
  - Use the existing `Checkbox` component from `../../custom-ui/io/checkbox.mjs` if it exists; otherwise use a plain `<label>` + `<input type="checkbox">` styled inline with a `styled` wrapper. Check `public/js/custom-ui/io/` for available components before creating anything new.
  - Bind the checkbox to `config.isRevealing`: checked when `true`, calls `updateConfig({ isRevealing: !config.isRevealing })` on change.
  - Update the `isUnchangedFromLibrary` comparison to include `isRevealing` in both sides of the `JSON.stringify` comparison so that changing `isRevealing` marks the part as modified relative to the library.
  - **Manual test:** Open AnyTale → Parts & Plot tab. Expand a part. Confirm the "Reveals Parts Underneath" checkbox appears below the Type input. Check and uncheck it — confirm the value persists in `localStorage` under `config.isRevealing`. Confirm the Save/Update library button becomes enabled when `isRevealing` differs from the library value.

- [x] Task 8: Core — Update `resolveSlotStatuses` initial state logic
  - In `slot-resolver.mjs`, replace the existing initial-state loop in `resolveSlotStatuses` (lines 34–41) with a new loop that implements the upgrade-based algorithm:
    1. Define a local rank map: `const STATUS_RANK = { covering: 2, revealing: 1, removed: 0 }`.
    2. Loop through each part in `activeParts`. For each part, compute `baseStatus`: `'revealing'` if `part.config?.isRevealing === true`, else `'covering'`.
    3. For each type string `t` in the part, normalize to `key = t.trim().toLowerCase()`. Skip empty keys.
    4. Get the current status: `const current = statuses.get(key) ?? 'removed'`.
    5. If `STATUS_RANK[baseStatus] > STATUS_RANK[current]`, call `statuses.set(key, baseStatus)`.
  - This replaces the old `if (key && !statuses.has(key)) statuses.set(key, 'covering')` pattern. The rest of `resolveSlotStatuses` (the page-action replay loop) is unchanged.
  - Update the JSDoc on `resolveSlotStatuses` to describe the new initial state rule.
  - **Manual test:** Open AnyTale with at least two parts — one normal (covering) and one with "Reveals Parts Underneath" checked. Navigate to the Plot section and observe the Slot Tracker panel (from Task 5). The covering part's slot types should show green (`covering`) pills; the revealing part's slot types should show yellow (`revealing`) pills at page 0 before any actions. If two parts share a slot type and one is covering, the slot should show green (covering wins). Navigate to a later page with actions and confirm page-action statuses still override the initial state as before.

## Implementation Details

### Updated Part Config Shape
```js
config: {
  name: string,
  type: string[],
  previewBaseline: string,
  baseline: string,
  attributes: Array<{ name: string, options: string }>,
  isRevealing: boolean,  // default false; true = slot base status is 'revealing'
}
```

### Status Rank for Upgrade Comparisons
```js
const STATUS_RANK = { covering: 2, revealing: 1, removed: 0 };
```

### Updated Initial-State Loop in `resolveSlotStatuses`
```js
const STATUS_RANK = { covering: 2, revealing: 1, removed: 0 };
for (const part of (activeParts || [])) {
  const types = Array.isArray(part.config?.type) ? part.config.type
    : Array.isArray(part.type) ? part.type : [];
  const baseStatus = part.config?.isRevealing === true ? 'revealing' : 'covering';
  for (const t of types) {
    const key = t.trim().toLowerCase();
    if (!key) continue;
    const current = statuses.get(key) ?? 'removed';
    if (STATUS_RANK[baseStatus] > STATUS_RANK[current]) {
      statuses.set(key, baseStatus);
    }
  }
}
```

### Key File Locations
- Part schema & factory: `public/js/app-ui/anytale/anytale-state.mjs`
- Part edit form: `public/js/app-ui/anytale/part-item.mjs`
- Slot resolver: `public/js/app-ui/anytale/slot-resolver.mjs`
