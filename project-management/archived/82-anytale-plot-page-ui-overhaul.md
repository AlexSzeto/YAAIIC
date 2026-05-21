# AnyTale Plot Page UI Overhaul
## Goal
Refactor the AnyTale Plot section UI: replace the DynamicList-based "Part Modifiers" with two
separate controls (template-tag syntax in the Page Tags field, and a chip-list UI for hidden
parts), remove the outline container, add a per-page image-count display, show a "(modified)"
suffix on unsaved parts, and move reprompt/delete buttons to the viewer nav row as icon-only buttons.

## Implementation Details

### Data Model — Plot Page Shape
Current: `{ tags: string, parts: Array<{ identifier, forceDisable, templateTag }> }`
New:     `{ tags: string, hiddenParts: string[] }`

- `tags` field continues to store raw tag text, but now supports `{{part type}}` template tokens
  that are **resolved at prompt-assembly time** — they are stored literally.
- `hiddenParts` is a flat `string[]` of part names or part types. Any enabled part whose
  `config.name` OR `config.type` (case-insensitive) appears in this list is skipped during
  prompt assembly (replaces the old `forceDisable` mechanism).
- The old `parts` array (with `identifier / forceDisable / templateTag` fields) is removed.
- **Migration**: handled by a standalone Node script `scripts/migrate/4-anytale-plot-page-shape.mjs`
  that rewrites `server/database/anytale-data.json` in-place (with backup). See Migration Script
  section below. `loadPlot()` in `anytale-state.mjs` should still defensively default
  `hiddenParts` to `[]` on any page that is missing the field, but no wipe guard is needed.

### Template Tag Expansion Rules
Template tokens have the format `{{type name}}`, e.g. `{{outer upper body}}`.

**Parsing algorithm** (applied to each comma/newline-separated tag segment in `page.tags`):

1. Split `page.tags` by comma or newline to get raw segments (same as `splitTags`).
2. For each segment, scan for one or more `{{...}}` tokens.
3. For each token found, look up active (enabled) parts whose `config.type` matches the token
   text (case-insensitive, trimmed).
4. If **no parts** match the token → drop the entire segment (produce zero tags from it).
5. If **one or more parts** match → for each matching part, substitute its `config.name` in
   place of `{{...}}` in the segment text. If multiple `{{...}}` tokens appear in the same
   segment, perform a **cartesian product** across all matched sets.
6. Surrounding text is preserved: `red {{outer upper body}}` with `shirt` + `jacket` matching
   → `red shirt`, `red jacket`.
7. Segments with **no template tokens** are included verbatim (same as today).

**Implementation**: Add a new exported function `expandPageTags(tagsString, enabledParts)` in
`prompt-assembler.mjs`. This replaces the current `splitTags(activePage.tags)` call inside
`assemblePrompt`. The existing `applyTemplate` helper (currently used for `templateTag`) will be
removed; the old `templateTag` mechanism is fully replaced by this.

### Hidden Parts Chip UI (replaces Part Modifiers DynamicList)
Location: `plot-section.mjs`, below the Page Tags field.

Components:
- **AutocompleteInput** labelled "Hidden Parts" (or "Force Disable Parts").
  - Suggestions list = union of all `part.config.name` and `part.config.type` values from the
    current `parts` prop, de-duplicated, case-insensitive. Compiled fresh whenever `parts`
    changes (via `useMemo` or derived in render).
  - On select: if the value is not already in `currentPage.hiddenParts`, append it and call
    `updatePage`. Clear the input after selection.
- **Chip list**: renders `currentPage.hiddenParts` as a row of small pill/chips.
  - Each chip shows the identifier text + an "×" (close/delete icon) button.
  - Clicking × removes that entry from the array and calls `updatePage`.
  - Use a new styled `ChipRow` / `Chip` component within `plot-section.mjs`.
  - Chips wrap when overflowing (`flex-wrap: wrap`).

### UI Layout Changes

#### A — Remove OutlinePanel
In `plot-section.mjs`, remove the `<OutlinePanel>` wrapper around the page form (tags,
hidden parts chips, nav row). The inner content should still be grouped visually by the
existing `VerticalLayout` gap, but without the border/padding box.

#### B — Parts List "(modified)" Header Postfix
In `anytale-form.mjs`, the `DynamicList` for the parts list uses `getTitle`.

Update `getTitle` to:
```js
getTitle=${(item) => {
  const base = item.config?.name || '(unnamed)';
  const lib = libraryParts.find(p =>
    (item.config?.uid && p.uid === item.config.uid) ||
    (item.config?.name && p.name === item.config.name)
  );
  if (!lib) return base; // not in library — no suffix
  const configFields = {
    name: item.config.name, type: item.config.type,
    baseline: item.config.baseline, previewBaseline: item.config.previewBaseline,
    categoryAttributes: item.config.categoryAttributes,
    customAttributes: item.config.customAttributes,
  };
  const libFields = {
    name: lib.name, type: lib.type,
    baseline: lib.baseline, previewBaseline: lib.previewBaseline,
    categoryAttributes: lib.categoryAttributes,
    customAttributes: lib.customAttributes,
  };
  const isModified = JSON.stringify(configFields) !== JSON.stringify(libFields);
  return isModified ? `${base} (modified)` : base;
}}
```
The part-item.mjs already uses this same JSON.stringify pattern for its Save button disabled
state — keep the two in sync.

#### C — Per-Page Lock
A non-persistent, session-only boolean array tracking whether each page is locked.
A page becomes locked as soon as a generation is triggered for it. Locking is **one-way**:
the user can manually unlock a page but there is no automatic re-locking after unlocking.

**State location**: `AnyTaleForm` (where `activePlotPage` lives).
```js
const [pageLocked, setPageLocked] = useState([]); // index = page index, value = boolean
```

**Lock on generate**: At the start of `handleGenerate` in `AnyTaleForm` (before calling
`onGenerate`), lock the current page:
```js
setPageLocked(prev => {
  const next = [...prev];
  next[activePlotPage] = true;
  return next;
});
```
No callback bridge to `AnyTalePage` is needed — locking happens synchronously at generate time.

**Sync on page add/delete** (in `plot-section.mjs`'s `handleAddPage` / `handleDeletePage`):
Pass the lock array and a setter as props to `PlotSection`:
- `pageLocked: boolean[]`
- `onPageLockedChange: (newLocked: boolean[]) => void`

On `handleAddPage` (insert `false` at `insertAt`):
```js
const next = [...pageLocked];
next.splice(insertAt, 0, false);
onPageLockedChange(next);
```
On `handleDeletePage` (remove at `currentPageIndex`):
```js
const next = pageLocked.filter((_, i) => i !== currentPageIndex);
onPageLockedChange(next);
```

**Disabled state**: When `isCurrentPageLocked` is true (= `pageLocked[currentPageIndex] === true`):
- The Page Tags `TagInput` is disabled.
- The Hidden Parts `AutocompleteInput` is disabled.
- All chip × buttons in the `ChipRow` are disabled.

**Unlock button**: On the right edge of the `NavRow` in `plot-section.mjs`, add a small
text icon button:
- Always rendered; disabled when `!isCurrentPageLocked`.
- Label: `Unlock`, icon: `unlock` (or similar unlock icon from the icon set).
- `variant="small-text"`, no color override (neutral/secondary).
- On click: set `pageLocked[currentPageIndex] = false` via `onPageLockedChange`.

Layout of the `NavRow`:
```
[ NavigatorControl ] [ + page ] [ - page ]    [ Unlock btn (right-aligned) ]
```
Use `justify-content: space-between` or `margin-left: auto` on the unlock button to push
it to the right edge.

#### D — Move Reprompt + Delete to Viewer NavRow (Icon-Only)
Currently `handleReprompt`, `canReprompt` (= `!!currentItem?.parts && !isGenerating && !isReprompting`),
`onDelete`, and `canDelete` all live in `AnyTaleForm`.

**Strategy**: expose `handleReprompt` from `AnyTaleForm` to `AnyTalePage` via a ref callback prop:
- Add prop `onRepromptReady: (fn: Function | null, enabled: boolean) => void` to `AnyTaleForm`.
- `AnyTaleForm` calls `onRepromptReady(handleReprompt, canReprompt)` in a `useEffect` whenever
  `handleReprompt` or the enabled state changes; calls `onRepromptReady(null, false)` on unmount.
- `AnyTalePage` stores the returned fn in a `useRef` + mirrors `enabled` in state, then passes
  them as props to `AnyTaleViewer`.

Props added to `AnyTaleViewer`:
- `onReprompt: Function | null`
- `canReprompt: boolean`
- `onDelete: Function`
- `canDelete: boolean`

**NavRow layout** in `AnyTaleViewer`:
```
[ NavigatorControl ] [ reprompt-icon ] [ delete-icon ]   ← gap →   [ slideshow controls ]
```
Use `justify-content: space-between` on `NavRow` with an inner left group:
```html
<LeftNavGroup>  <!-- flex row, gap small -->
  <NavigatorControl ... />
  <Button variant="medium-icon" icon="refresh" title="Reprompt" onClick={onReprompt} disabled={!canReprompt} />
  <Button variant="medium-icon" icon="trash"   title="Delete"   onClick={onDelete}   disabled={!canDelete} />
</LeftNavGroup>
<SlideshowControls>...</SlideshowControls>
```
Remove reprompt and delete from `AnyTaleForm`'s `ButtonRow` after moving them.

### Migration Script
Script: `scripts/migrate/4-anytale-plot-page-shape.mjs`
Run with: `node scripts/migrate/4-anytale-plot-page-shape.mjs`

The script reads `server/database/anytale-data.json`, transforms every plot block's pages, and
writes back. It follows the same conventions as earlier migration scripts (timestamped backup
under `scripts/migrate/backups/`).

**Detection of old shape**: a page is in the old format if it has a `parts` array whose
elements contain an `identifier` field. Pages already in the new shape (or with no `parts`
array at all) are left untouched.

**Transformation per old-format page**:
```
old page: { tags: string, parts: Array<{ identifier, forceDisable, templateTag }> }
new page: { tags: string, hiddenParts: string[] }
```
1. `hiddenParts` = `parts.filter(m => m.forceDisable).map(m => m.identifier)` — only
   the force-disabled identifiers are carried forward.
2. `tags` = existing `tags` value, with any non-empty `templateTag` values appended to the
   end as additional comma-separated tags in the following order:
   - Start from the existing `tags` string (trimmed).
   - For each modifier where `templateTag` is non-empty, append `, <templateTag value>`.
   - Strip leading/trailing commas and normalize whitespace.
3. The old `parts` field is removed entirely.

Example:
```js
// Old
{ tags: 'red background', parts: [
    { identifier: 'shirt', forceDisable: true,  templateTag: '' },
    { identifier: 'hair',  forceDisable: false, templateTag: '{{hair}} color' },
]}
// New
{ tags: 'red background, {{hair}} color', hiddenParts: ['shirt'] }
```

`createBlankPlot()` page shape updated to: `{ tags: '', hiddenParts: [] }`.

## Tasks

- [x] **Task 1 — Migration script + data model update**
  **A. Create `scripts/migrate/4-anytale-plot-page-shape.mjs`:**
  - Create a timestamped backup of `server/database/anytale-data.json` to
    `scripts/migrate/backups/` before making any changes.
  - Read the JSON, iterate over every plot in `data.plot`, and for each page:
    - Skip pages that are already in the new shape (no `parts` array with `identifier` fields).
    - Build `hiddenParts` from `parts` entries where `forceDisable === true`, extracting `identifier`.
    - Append non-empty `templateTag` values from all modifiers to the end of `tags` as
      comma-separated entries (see Migration Script section for exact logic and example).
    - Remove the `parts` key; add `hiddenParts`.
  - Write the transformed data back to the same file.
  - Print a summary: plots processed, pages migrated, pages skipped.

  **B. Update `anytale-state.mjs`:**
  - Change `createBlankPlot()` page shape from `{ tags: '', parts: [] }` to `{ tags: '', hiddenParts: [] }`.
  - In `loadPlot()`, defensively default `hiddenParts` to `[]` on any page where the field
    is missing (no wipe guard needed after the migration script has been run).

  **Manual test**:
  1. Run `node scripts/migrate/4-anytale-plot-page-shape.mjs` against a copy of the database
     with old-format plots. Confirm the backup is created in `backups/`. Inspect the output
     JSON and verify: `hiddenParts` contains only force-disabled identifiers, `templateTag`
     values appear at the end of `tags`, and no `parts` array remains.
  2. Open AnyTale in the browser. Confirm the Plot section loads without errors. Delete
     `anytale-plot` from localStorage and reload — confirm a blank plot is created cleanly.

- [x] **Task 2 — Template tag expansion in prompt assembler**
  Update `prompt-assembler.mjs`:
  - Add `expandPageTags(tagsString, enabledParts)` that:
    1. Splits the string by comma and newline into segments.
    2. For each segment, finds all `{{...}}` tokens.
    3. For each token, finds matching enabled parts by `config.type` (case-insensitive).
    4. If any token has zero matches → drops the segment.
    5. Expands via cartesian product across all matched sets, substituting part names in-place.
    6. Returns the fully expanded flat `string[]`.
  - In `assemblePrompt`, replace `splitTags(activePage.tags)` with `expandPageTags(activePage.tags, enabledParts)`.
  - Remove old `templateTag` logic (the `modifier.templateTag` branch and `applyTemplate` helper).
  - Remove old `forceDisable` branch; replace with: skip part if its `config.name` or `config.type` (case-insensitive) is in `activePage.hiddenParts`.

  **Manual test**: In Plot → Page Tags, type `red {{hair}}, background`. Set a part with type "hair" and name "long hair". Confirm the prompt preview shows `red long hair, background`. Add a second part with type "hair" named "short hair" and confirm it expands to `red long hair, red short hair, background`. Type a type that matches no part — confirm that tag vanishes from preview.

- [x] **Task 3 — Hidden Parts chip UI in PlotSection**
  Update `plot-section.mjs`:
  - Remove the `DynamicList` "Part Modifiers" block entirely (including `PartModifierRow` styled component).
  - Add `ChipRow` and `Chip` styled components (flex-wrap row; chips are small pill-shaped buttons with text + × icon).
  - Below the `TagInput` for "Page Tags", render:
    - An `AutocompleteInput` labelled "Hidden Parts" whose `suggestions` prop = de-duplicated union of all `parts.map(p => p.config.name)` and `parts.map(p => p.config.type)`, filtered to non-empty strings. Recomputed when `parts` prop changes.
    - On `onSelect`: append the selected value to `currentPage.hiddenParts` (if not already present), call `updatePage`.
    - A `ChipRow` rendering each `currentPage.hiddenParts` entry as a `Chip` with an × button that removes it.
  - Update `createItem` / `onChange` wiring — these are no longer needed here; remove.

  **Manual test**: Add a part named "shirt" with type "outer upper body". In the plot page, type "shirt" in the Hidden Parts autocomplete and select it. Confirm a chip "shirt ×" appears. Click ×, confirm the chip disappears. Confirm the prompt preview no longer includes the shirt's tags when the chip is present.

- [x] **Task 4 — Remove OutlinePanel from plot page form**
  In `plot-section.mjs`, remove the `<OutlinePanel>` wrapper around the page sub-section
  (the block containing `TagInput`, hidden parts chip UI, and `NavRow`). Delete the
  `OutlinePanel` styled component definition. The content remains inside `VerticalLayout`.

  **Manual test**: Visually confirm the plot page area no longer has a border/outline box around it.

- [x] **Task 5 — Parts list "(modified)" header postfix**
  In `anytale-form.mjs`, update the `getTitle` prop on the Parts `DynamicList` to append
  ` (modified)` when the part's config differs from its library counterpart, using the JSON
  comparison described in the Implementation Details. Parts not found in the library show no
  suffix.

  **Manual test**: Add a part from the library. Change the Part's baseline tags field. Confirm the DynamicList header for that part shows `PartName (modified)`. Save the part to the library — confirm the suffix disappears.

- [x] **Task 6 — Per-page lock**
  - In `anytale-form.mjs`, add `pageLocked` state (`useState([])`).
  - At the **start** of `handleGenerate` (before calling `onGenerate`), set
    `pageLocked[activePlotPage] = true` (no async bridge needed).
  - Pass `pageLocked` and `onPageLockedChange` as props to `PlotSection`.
  - In `plot-section.mjs`:
    - Wire `handleAddPage` to splice `false` at `insertAt`; wire `handleDeletePage` to filter
      out the deleted index — both call `onPageLockedChange` (see Implementation Details § C).
    - Derive `isCurrentPageLocked = pageLocked[currentPageIndex] === true`.
    - Pass `disabled={isCurrentPageLocked}` to the Page Tags `TagInput` and the Hidden Parts
      `AutocompleteInput`.
    - Pass `disabled={isCurrentPageLocked}` to each chip × button in the `ChipRow`.
    - Add an Unlock button to the right of the `NavRow` (push right via `margin-left: auto` or
      `justify-content: space-between`):
      - `variant="small-text"`, icon `"unlock"` (or closest available), label `"Unlock"`.
      - `disabled={!isCurrentPageLocked}`.
      - On click: call `onPageLockedChange` with the current page set to `false`.

  **Manual test**: Navigate to a plot page and click Generate. Confirm the Page Tags input and Hidden Parts input become disabled, and chip × buttons are unclickable. Confirm the Unlock button in the nav row becomes enabled. Click Unlock — confirm the inputs re-enable. Navigate to a different page — confirm it is still unlocked. Add a page after a locked page — confirm the new page is unlocked and the locked page remains locked. Delete the new page — confirm the locked page is still locked.

- [x] **Task 7 — Move Reprompt + Delete to AnyTaleViewer NavRow**
  - In `anytale-form.mjs`:
    - Add `onRepromptReady: (fn, enabled) => void` prop.
    - Call `onRepromptReady(handleReprompt, canReprompt)` in a `useEffect` whenever either changes.
    - Call `onRepromptReady(null, false)` on unmount (cleanup).
    - Remove Reprompt and Delete buttons from the `ButtonRow`.
  - In `anytale.mjs` (`AnyTalePage`):
    - Store reprompt handler in a `useRef`; mirror `canReprompt` in `useState`.
    - Pass `onRepromptReady` to `AnyTaleForm`.
    - Pass `onReprompt`, `canReprompt`, `onDelete`, `canDelete` to `AnyTaleViewer`.
  - In `anytale-viewer.mjs` (`AnyTaleViewer`):
    - Accept new props: `onReprompt`, `canReprompt`, `onDelete`, `canDelete`.
    - Add a `LeftNavGroup` styled component (flex row, small gap) wrapping `NavigatorControl` + reprompt icon button + delete icon button.
    - Update `NavRow` to use `justify-content: space-between` between `LeftNavGroup` and `SlideshowControls`.
    - Reprompt: `variant="medium-icon" icon="refresh"`, disabled when `!canReprompt`.
    - Delete: `variant="medium-icon" icon="trash"`, disabled when `!canDelete`.

  **Manual test**: Generate an image. Confirm reprompt (↻) and delete (🗑) icon buttons appear to the right of the navigator in the left column. Confirm a gap separates them from the slideshow controls. Click reprompt — confirm parts are restored. Click delete — confirm the image is deleted. Confirm neither button appears in the right-column form anymore.
