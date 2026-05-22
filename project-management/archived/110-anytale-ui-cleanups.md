# AnyTale UI Cleanups

## Goal

Polish the AnyTale editor UI for clarity and usability across four areas: richer searchable-list labels that surface entity metadata at a glance; a refactored tags helper that separates unconditional insertion from filtering; a unified slot/part pill UI on plot pages that collapses the separate preview, requirements, and action sections into a single interactive list; and automatic re-queuing of part previews when a cache lookup returns empty.

## Tasks

### Phase 1 — Searchable label formatting

- [x] Update part labels in all searchable list components to render `name (type1, type2)` using the part's `config.type` array; omit the parenthetical when the array is empty.

- [x] Update character labels to render `name (truncated personality)` where the personality string is cut at the last word boundary within 60 characters and suffixed with `…`; omit the parenthetical when the personality profile is empty.

- [x] Update outfit labels to render `name (location1, location2)` by resolving each UID in `preferredLocations` to its part name from `libraryParts`; omit the parenthetical when `preferredLocations` is empty.

- [x] Update plot labels to render `name (type)` using the plot's `section` field (used as type/category); omit the parenthetical when `section` is empty.

### Phase 2 — Tags helper refactor

- [x] Change "insert by colors" and "insert by patterns" actions to unconditionally dump all generated tag combinations into the tags list without any existence check against the suggestion list.

- [x] Add a "prune risky tags" button that removes any tag from the current tags list that does not appear in the suggestion list (the same list those insert actions check against).

#### Fixes and Changes

- [x] Switch Prune (and Colors/Patterns filter) to use the full `TagInput` autocomplete list instead of the curated definitions set — the definitions set was too strict, rejecting valid tags that TagInput accepts.

- [x] Refactor tag existence check: move `tagExists()` to `tags.mjs` (checks full autocomplete list); rename old `tagExists()` in `tag-data.mjs` to `tagDefinitionExists()` to disambiguate. Update `handleVariationsAction` to use `getTags()` from the larger dataset.

- [x] Partial rollback: restore filtering in Colors/Patterns (do not dump unconditionally); keep the expanded tag list (`tagExists` from `tags.mjs`) and the `tagDefinitionExists`/`tagExists` rename. The net effect is a larger valid set, not unconditional insertion.

- [x] Remove the Prune button entirely — the expanded tag list made it less useful and the UX overhead wasn't justified.

### Phase 3 — Unified slot/part pill UI for plot pages

- [x] Add `slotRequirements: Record<string, 'covering'|'revealing'|'removed'>` to the `PlotBlock` typedef in `server/features/anytale/repository.mjs` and set its default to `{}` in `anytale-state.mjs`'s `createBlankPlot()` (or equivalent).

- [x] Create `public/js/app-ui/anytale/plot-page-pills.mjs` — a component that accepts `slotStatuses`, `activeParts`, `page`, and `onChange` props and renders the unified pill list:
  - Slot pills: one per unique slot type present in `slotStatuses`; background color encodes current status; lock icon toggles the slot type string in `page.requirements[]`; clicking the pill body cycles the transition through the other statuses (excluding current) and "no transition"; an arrow + target status label appears only when a transition is set.
  - Name pills: one per active part name; always secondary/gray background; lock icon toggles the part name in `page.requirements[]`; no transition controls.
  - Slots appear before name pills.

- [x] Replace the parts-preview, parts-requirements, and parts-action UI sections in `plot-section.mjs` with `PlotPagePills`, passing `priorSlotStatuses`, active parts, `currentPage`, and an `updatePage` callback.

- [x] Add a plot-level slot requirements editor above the page pill list: a read-only pill row derived from `plot.slotRequirements` where each pill shows the slot and required status; clicking a pill cycles through the valid statuses and removes the entry on "none"; an "add slot requirement" control lets the user add a new slot → status pair to `plot.slotRequirements`.

#### Fixes and Changes

- [x] Show all known slots in PlotPagePills (not just active ones); pass `allSlots` from `slotOptions`; inactive slots render as outline-only pills with no background.

- [x] Hide name pills for parts where every type is in `recommendedCharacterPartTypes`; filter in `plot-section.mjs` before passing `activeParts`.

- [x] Transition label background color must match the target status color (use `STATUS_BG[transition]` instead of hardcoded red).

- [x] Restore the page requirements pass/fail pill indicator; place it inline next to the Page H2 heading.

### Phase 3.5 — Plot-level requirements editor rewrite

- [x] Update `slotRequirements` typedef in `server/features/anytale/repository.mjs`: change value type from `'covering'|'revealing'|'removed'` to `'present'|'absent'`; document that keys are either slot type strings or part UIDs.

- [x] Update `loadPlot()` in `anytale-state.mjs`: strip any entries whose value is not `'present'` or `'absent'` (forward-compat guard against the old status strings).

- [x] Create `public/js/app-ui/anytale/plot-requirements-editor.mjs` — a self-contained component with two regions:
  - **Top — Add Part from Library:** a `SearchSelectModal`-driven control that accepts a library part selection and adds its UID to `plot.slotRequirements` as `'present'`.
  - **Bottom — Pill list:** renders all non-character slot types (from `slotOptions`) always, plus any UID-keyed entries currently in `slotRequirements`. Each pill cycles through three visual states on click:
    - **ignore** (key absent from requirements): secondary outline, no background fill, label is just `[name]`.
    - **present** (value `'present'`): secondary/gray background, label `[name] → covering/revealing`.
    - **absent** (value `'absent'`): danger background, label `[name] → removed/missing`.
  - For slot-type pills, cycling through to ignore removes the key from `slotRequirements` but keeps the pill visible (it is always shown). For part-UID pills, cycling to ignore removes the entry from `slotRequirements` **and** from the displayed list (re-add via the top control).

- [x] Remove the inline `PlotReqPillRow` / `PlotReqPill` / `SLOT_REQ_STATUSES` / `SLOT_REQ_BG` styled components and the `cycleSlotRequirement` / `addSlotRequirement` handlers from `plot-section.mjs`; replace with `<PlotRequirementsEditor>` positioned between the plot description inputs and the Page section heading.

### Phase 3.5 — Implementation Details

**Data shape (updated):**
```js
// slotRequirements: Record<string, 'present'|'absent'>
// Keys: slot type string (e.g. 'outer upper body') OR part UID
// 'present': slot is considered present when any active part with that slot type
//            has status 'covering' or 'revealing'
// 'absent':  slot is considered absent when no active part with that type is
//            covering or revealing (status is 'removed' or slot not in use)
```

**PlotRequirementsEditor props:**
```js
{
  plot,          // full plot object (reads slotRequirements, calls onChange with updated plot)
  onChange,      // (updatedPlot) => void
  libraryParts,  // for resolving UID keys to display names and populating the add modal
  slotOptions,   // string[] — all known non-character slot types (same list as PlotPagePills)
}
```

**Pill cycle for slot-type keys:** ignore → present → absent → ignore (pill always remains visible)

**Pill cycle for part-UID keys:** present → absent → ignore (on ignore: key is removed and pill disappears; user re-adds via the top control)

**Label resolution for UID keys:** `libraryParts.find(p => p.uid === key)?.config?.name ?? key`

### Phase 4 — Auto-regen part previews on empty cache response

- [x] In the part editor, change `baseline` and `previewBaseline` tag inputs to update the part data object `onBlur` instead of on every keystroke, so that preview regen requests are not triggered while the user is still typing.

- [x] Server: pass `partUid` in the request body to `POST /anytale/generate-part-preview` and include it in the enqueued `taskData` so clients can match queue items to a specific part.

- [x] Client: in the `request-part-preview` response handler, when `found: false` is returned, scan the current queue state for items where `endpointKey === 'anytale-part-preview'` and `taskData.partUid` matches the part's UID; delete each matched item via `DELETE /queue/item/:id`, then re-enqueue a preview for the part's current tag combination by calling the generate-part-preview endpoint with `?queueOnly=true`.

- [x] Review and update affected living docs: `docs/features/anytale.md`, `docs/server.md`

### Phase 5 — Part attribute quick-edit controls

#### Fixes and Changes

- [x] Add a Random button (dice-3 icon, "Random" label, same size as Preview button) beneath each Preview button in `PartItem` and `CharacterPartItem` — resets all attribute values to blank, then randomly selects `ceil(total / 3)` attributes and assigns each a random value from its options list; triggers auto-preview via the existing `requestPortraitCache` / `requestPartPreviewCache` pipeline.

- [x] Replicate the Phase 4 auto-regen behaviour in `character-section.mjs` and `outfit-section.mjs`: on cache miss, cancel stale queued previews matching `partUid` via `DELETE /queue/item/:id`, then re-enqueue with `partContext: 'character'` / `'outfit'` and `partUid`; add `queueItemsRef` to each section for stable access inside the async callback.

## Implementation Details

### Phase 1 — Label formatting

A single helper is sufficient for each entity type. Suggested truncation for character personality:

```js
function truncateAtWord(str, max = 60) {
  if (str.length <= max) return str;
  const cut = str.lastIndexOf(' ', max);
  return (cut > 0 ? str.slice(0, cut) : str.slice(0, max)) + '…';
}
```

Outfit preferred-location names are resolved by matching each UID in `outfit.preferredLocations` against `libraryParts` and taking `part.config.name`. The plot type comes from `plot.section`.

### Phase 2 — Tags helper

"Insert by colors" and "insert by patterns" currently filter combinations against the suggestion list before inserting. The change is to remove the filter step and insert all combinations unconditionally. "Prune risky tags" is the inverse: iterate the current tags list, remove any entry absent from the suggestion list.

### Phase 3 — Pill UI

#### Slot status color mapping

| Status | Token |
|---|---|
| `covering` | `theme.colors.primary.background` (or equivalent "active" token) |
| `revealing` | a warning/accent token |
| `removed` | `theme.colors.text.secondary` (muted) |

Use theme tokens; do not hardcode colors.

#### Transition cycle logic

Given a slot with current status `S`, the available transition targets are all statuses except `S` plus "no transition". Clicking cycles: `none → [statuses excluding S in order] → none`. When the selected target equals the slot's current status (which cannot happen due to the exclusion), treat it as none.

#### PlotBlock typedef addition

```js
/**
 * @typedef {Object} PlotBlock
 * ...existing fields...
 * @property {Record<string, 'covering'|'revealing'|'removed'>} [slotRequirements={}] - Entry requirements for the entire plot; maps slot type string to required status for play mode bootstrap
 */
```

No data migration required — existing plots deserialize with `slotRequirements` defaulting to `{}`.

#### Per-page data fields (already exist)

```js
// PlotPage.requirements: string[] — slot type strings or part names; all must be satisfied for the page to be reachable
// PlotPage.actions: PlotPageAction[] — slot transitions applied when this page is reached
// PlotPageAction: { slot: string, status: 'covering'|'revealing'|'removed' }
```

### Phase 4 — Auto-regen

#### Server change

`POST /anytale/generate-part-preview` should accept `partUid` in the request body and forward it into `taskData`:

```js
taskData: { ...requestData, partUid: req.body.partUid || null }
```

#### Client-side flow

```js
const response = await requestPartPreview(prompt);
if (!response.found) {
  const queue = getQueueState(); // from SSE queue:updated
  const stale = queue.items.filter(
    i => i.endpointKey === 'anytale-part-preview' && i.taskData?.partUid === part.uid
  );
  await Promise.all(stale.map(i => deleteQueueItem(i.id)));
  await generatePartPreview({ ...currentTagPayload, partUid: part.uid }, { queueOnly: true });
}
```
