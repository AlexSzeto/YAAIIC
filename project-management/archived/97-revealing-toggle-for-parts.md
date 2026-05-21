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
