# Form State Standardization

## Goal

Establish a consistent two-state model (`dirty` / `recorded`) for every significant form record in the app, and replace the current inconsistent Save/Update/Create button labeling with a single standardized three-button set (Create/Save, Revert, Delete) whose labels and enabled states derive mechanically from those two states.

## Tasks

### Phase 1 — Fix AnyTale Music tab (GenreCard)

- [x] Correct `GenreCard` button labels: `recorded` is always `true` for genres (created server-side on Add), so the Create/Save button always reads **'Save'**, enabled only when `dirty`.
- [ ] Move the genre Delete button out of the `ButtonRow` and into the `DynamicList` header by removing `hideDelete` from the outer DynamicList, adding a `deleteLabel`-less trash icon, and wiring the confirmation dialog through a custom `onDelete` prop instead of the `handleDelete` callback currently in GenreCard.

### Phase 2 — Fix AnyTale PlotSection, CharacterSection, OutfitSection

- [x] **PlotSection**: `saveLabel` now uses `formButtonStates` → `isInLibrary ? 'Save' : 'Create'`. Button enabled via `saveEnabled`. Revert and Delete use `revertEnabled` / `deleteEnabled`.
- [x] **CharacterSection**: renamed `hasChanges` → `dirty`, uses `formButtonStates`. `isInLibrary ? 'Save' : 'Create'` via `saveLabel`.
- [x] **OutfitSection**: same treatment as CharacterSection.

### Phase 3 — Fix AnyTale PartItem (library save)

- [x] `part-item.mjs` Save-to-Library button now uses `formButtonStates(!!libraryPart, !isUnchangedFromLibrary)` → `saveLabel` = `libraryPart ? 'Save' : 'Create'`.

### Phase 4 — Fix workflow editor and brew editor

- [x] `workflow-editor.mjs`: added `savedWorkflow` state. `workflowDirty` via `useMemo`. Button reads `workflowSaveLabel` ('Save'/'Create'), enabled only when `canSave && workflowSaveEnabled`.
- [x] `brew-editor.mjs`: added `savedBrew` state. `brewDirty` via `useMemo`. Button reads `brewSaveLabel`, enabled only when `brewSaveEnabled && !isSaving`.

### Phase 5 — Utility and audit

- [x] Created `public/js/app-ui/forms.mjs` with `formButtonStates(recorded, dirty)` and `useFormRecord` hook. All significant forms import and use `formButtonStates`.
- [x] Final grep for `'Update'` in button labels across `public/js/` — no stragglers found.

### Phase 6 - Inconsistency fixes
- [x] Workflow Editor: missing revert button.
- [x] Brew Editor: global sound sources is a special case. Save Global button needs to tracks dirty state based on the entire global sound source array, individual sound sources needs to show asterisk when its own record is dirty.
- [x] Brew Editor: brew section missing revert button.
- [x] AnyTale Editor: music tab items missing revert button, Save button label not updating according to dirty/recorded status - mainly due to a record being created when an entry is being added to this list. Stop creating new records on add, and disable the `generate track` button before an entry has a record/uid.
- [x] AnyTale Editor: move all persistent local data out of local storage into session storage.

### Phase 6 Clean up
- [x] Brew Editor: global sound sources is missing a revert button (similar to its save counterpart, it reverts the entire global sound array)
- [x] AnyTale Editor: reorganzie button positioning: Create/Save, Revert, Delete, and Clear are right aligned buttons. All other action buttons (Generate, Edit Parts, etc) stay left aligned. If both exist on the same row, use a HorizontalEdgesLayout to split them, otherwise use a HorizontalLayout with justifyContent to right align the items. The page controls are a special case, and is split into 3 rows: 1. reject, extend (right aligned) 2. page navigation, add page, unlock page, delete page (left aligned) 3. Create/Save, Revert, Delete, Clear (right aligned, keeping with convention)
- [x] Make sure that Panel wrapper around the AnyTale Parts & Plot / Character & Outfits Generation has an outline. If a Panel wrapper doesn't exist yet, add one.
## Implementation Details

### The two states

```
recorded  — the entry exists in the database (has a UID present in the server's list).
dirty     — the current form state differs from the baseline:
              • if recorded: differs from the last server-saved copy.
              • if not recorded: differs from the initial blank/default state when the form was opened.
```

### Standard three-button set

| Button | Label | Icon | Color | Enabled when |
|---|---|---|---|---|
| Create/Save | `recorded ? 'Save' : 'Create'` | `save` | `primary` | `dirty` |
| Revert | Revert | `undo` | `secondary` | `recorded && dirty` |
| Delete | Delete | `trash` | `danger` | `recorded` |

### Delete placement rule

- If the record is managed by a `DynamicList`, the Delete button lives in the **item header** (via DynamicList's built-in delete mechanism). It always shows the `trash` icon and must confirm before acting.
- If the record is a standalone form (not inside a DynamicList), Delete sits in the button row.

### Dirty comparison for `not recorded` entries

The baseline is the return value of the component's `createBlank*` / `createDefault*` factory, serialized via `JSON.stringify`. This is computed once on mount and stored in a ref. Dirty = current serialized form state ≠ baseline.

### Scope exclusions

The following are **not** subject to this standard:
- Transient action forms (e.g., sound clip region save in `sound-editor-modal.mjs`).
- Read-only views and navigation controls.
- Generation trigger buttons (Generate, Queue).
