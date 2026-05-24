# AnyTale: Move Partial Coverage to Outfit Part Property

## Goal

Move `isRevealing` from the persisted part definition to a session-only temporary setting in the Parts & Plot editor and a new persisted field on outfit part data, then update all slot resolution call sites to read from the correct source.

## Tasks

### Phase 1 — Data migration and server schema update

- [x] Write migration script `scripts/migrate/anytale-data/1-to-2.mjs` that strips `isRevealing` from all `parts[]` entries and adds `isRevealing: false` to every entry in all `outfits[].parts[]` arrays
- [x] Bump `currentVersion` for `anytale-data` to `2` in `server/core/data-versions.mjs`
- [x] Update server-side part create/update logic to stop accepting and storing `isRevealing` on part definitions

#### Fixes and Changes

- [x] In the search-select items for outfits, characters, parts, and plot, add a secondary subtitle showing relevant sub-info (outfit: part names; character: personality snippet; parts: type tags; plot: section); render the primary label and subtitle side-by-side, with the subtitle in `theme.colors.text.secondary`

### Phase 2 — Temporary session setting in the Parts & Plot editor

- [ ] Add `anytale-parts-coverage` sessionStorage helpers (`getPartsCoverage`, `setPartCoverage`) to `public/js/app-ui/anytale/anytale-state.mjs`, storing a `{ [partUid]: boolean }` map
- [ ] In `part-item.mjs`, remove the existing `isRevealing` toggle from its current position and add a new toggle at the very top of the form (above preview image and name) labelled "Partial Coverage (temporary setting test)", bound to `anytale-parts-coverage` in sessionStorage
- [ ] In `anytale-form.mjs`, update `handleGenerate()` to read each part's `isRevealing` from `anytale-parts-coverage` sessionStorage (by `partUid`) instead of `config.isRevealing`
- [ ] In `plot-section.mjs`, update the `priorSlotStatuses` useMemo to inject `isRevealing` from `anytale-parts-coverage` sessionStorage into each part before passing to `resolveSlotStatuses`

### Phase 3 — Outfit part isRevealing property and rendering

- [ ] In `outfit-section.mjs`, add an `isRevealing` toggle at the top of each outfit part's dynamic item (above preview image and attributes list), labelled "Partial Coverage (reveals parts underneath)", persisted to outfit part data
- [ ] In `outfit-section.mjs`, update `handleGenerateRender()` to read `isRevealing` from the outfit part (`op.isRevealing ?? false`) instead of the library part config (`lib.isRevealing`)
- [ ] In `anytale-form.mjs`, update `handleCharTabGenerate()` to include `isRevealing: cp.isRevealing ?? false` from each merged outfit part when building the parts array passed to the slot resolver
- [ ] Review and update affected living docs: `docs/features/anytale.md`

## Implementation Details

### Data shapes

**PartConfig** (after migration — `isRevealing` removed):
```js
{
  uid: string,
  name: string,
  type: string[],
  baseline: string,
  previewBaseline: string,
  attributes: PartAttribute[],
  // isRevealing removed
}
```

**CharacterPart** (after migration — `isRevealing` added):
```js
{
  partUid: string,
  enabled: boolean,
  attributeValues: { [attributeName: string]: string },
  previewImageUrl: string,
  isRevealing: boolean,  // new — default false
}
```

### Migration script interface

```js
// scripts/migrate/anytale-data/1-to-2.mjs
export const fromVersion = 1;
export const toVersion = 2;

export function migrate(data) {
  // Strip isRevealing from all part definitions
  for (const part of (data.parts || [])) {
    delete part.isRevealing;
  }
  // Add isRevealing: false to all outfit parts
  for (const outfit of (data.outfits || [])) {
    for (const part of (outfit.parts || [])) {
      part.isRevealing = false;
    }
  }
  return data;
}
```

### SessionStorage key convention

Key: `anytale-parts-coverage`
Value: `JSON.stringify({ [partUid]: boolean })`

Follows the existing `anytale-<category>` pattern in `anytale-state.mjs`. Defaults to `false` for any partUid not present in the map.

### Slot resolution call site changes

| Call site | File | Current source | New source |
|---|---|---|---|
| `handleGenerate()` | `anytale-form.mjs` | `config.isRevealing` | `anytale-parts-coverage[partUid]` from sessionStorage |
| `priorSlotStatuses` | `plot-section.mjs` | `config.isRevealing` | `anytale-parts-coverage[partUid]` from sessionStorage |
| `handleGenerateRender()` | `outfit-section.mjs` | `lib.isRevealing` | `op.isRevealing ?? false` |
| `handleCharTabGenerate()` | `anytale-form.mjs` | (omitted) | `cp.isRevealing ?? false` |

### UI placement

- **Parts & Plot editor** (`part-item.mjs`): Temporary toggle at the very top of the form — above the part name input and preview image. Label: "Partial Coverage (temporary setting test)".
- **Outfit part dynamic item** (`outfit-section.mjs`): Persistent toggle at the top of each collapsible outfit part entry — above the preview image and attribute list. Label: "Partial Coverage (reveals parts underneath)".
