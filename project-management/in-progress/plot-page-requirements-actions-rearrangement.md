# Plot & Page Requirements and Actions Rearrangement

## Goal

Rework how plot requirements and page requirements/actions are presented and stored in the AnyTale editor: page requirements gain a dedicated "Parts" section with a per-part hidden toggle (stored as `page.hiddenParts`), hidden parts are excluded from prompt assembly while still counting for all slot logic, and the plot requirements editor auto-populates all library parts without requiring manual addition.

## Tasks

### Phase 1 — Schema, migration, and rendering change

- [x] Add `hiddenParts: []` default to `normalizePage` in `play-normalizer.mjs`; write migration script `scripts/migrate/anytale-data/3-to-4.mjs` that adds `hiddenParts: []` to all existing plot pages; bump `anytale-data` `currentVersion` to 4 in `server/core/data-versions.mjs`. **Manual test:** start server, load a plot via `GET /anytale/plot/:uid`, verify all pages include the `hiddenParts` field.
- [x] Update `assemblePrompt` in `prompt-assembler.mjs` to exclude parts whose `config.uid` appears in `activePage.hiddenParts` when building `visibleParts` (applied after the `data.enabled` check and slot visibility check); add unit tests verifying a part with its uid in `hiddenParts` is absent from the assembled prompt and that `resolveSlotStatuses` / `checkPageRequirements` are unaffected. **Manual test:** in the editor, temporarily hard-code a part uid in a page's `hiddenParts` in localStorage and confirm its baseline is absent from the generated prompt.

### Phase 2 — Page requirements UI split

#### Fixes and Changes
- [x] Fix part pills in Parts section: read flat `{ uid, name }` shape from libraryParts (not `config.uid`/`config.name`); restore requirements lock button on each part pill; show `[name] → hidden` inline label when part is in `hiddenParts`.
- [x] Switch Parts section source from libraryParts to the editor's local parts prop (Parts List tab); update plot-page-pills.mjs to read wrapped `{ config: { uid, name } }` shape.

- [x] Split `plot-page-pills.mjs` into two labeled sections — **"Page Requirements and Changes (Slots)"** (existing slot-pill behavior, entirely unchanged) and **"Page Requirements and Changes (Parts)"** (new) — and update `plot-section.mjs` to pass all `libraryParts` unfiltered to the new Parts section. **Manual test:** open the Plot section in the editor; verify two labeled sections appear and the Slots section behaves identically to before.
- [x] Implement the Parts section: pre-populate all library parts as pills in blank/outlined state by default; clicking a pill toggles it to the "hidden" filled state; clicking again returns it to blank; read initial pill state from `page.hiddenParts` (filled if uid present); write to `page.hiddenParts` on every toggle. **Manual test:** toggle a part to hidden, save the plot, reload — verify the pill is still filled; toggle it back, save, reload — verify the pill is blank.

### Phase 3 — Plot requirements UI update

- [ ] Update `plot-requirements-editor.mjs`: remove the SearchSelectModal and "Add Part" button; auto-populate the parts list from `libraryParts` as outlined pills in the ignore (no-requirement) state; pills for parts already in `plot.slotRequirements` show their current `present`/`absent` state; orphan pills — UIDs in `slotRequirements` whose uid is absent from `libraryParts` — are shown and persist until toggled back to ignore, at which point they are removed from both the rendered list and `slotRequirements`. Slot-type pills (always shown) are unchanged. **Manual test:** open a plot that has an orphan part requirement; verify the orphan pill appears; toggle it to ignore and verify it disappears.

### Phase 4 — Docs

- [ ] Review and update affected living docs: `docs/features/anytale.md`

## Implementation Details

### New data field

```js
// PlotPage — updated shape
{
  tags?: string,
  dialogPrompt?: string,
  actions?: PlotPageAction[],   // slot transitions — unchanged
  requirements?: string[],      // slot/part requirements — unchanged
  hiddenParts?: string[],       // NEW: part UIDs excluded from final prompt assembly
}
```

Default: `[]`. The migration script adds `hiddenParts: []` to all existing pages. No other existing fields change.

### Migration script

```js
// scripts/migrate/anytale-data/3-to-4.mjs
export const fromVersion = 3;
export const toVersion = 4;

export function migrate(data) {
  for (const plot of data.plots ?? []) {
    for (const page of plot.pages ?? []) {
      if (!Array.isArray(page.hiddenParts)) {
        page.hiddenParts = [];
      }
    }
  }
  return data;
}
```

### Complete page rendering pipeline (post-change)

Steps 1–4 are **unchanged**. Step 5 gains a single additional filter. All references to "hidden parts" below mean UIDs listed in `activePage.hiddenParts`.

**Inputs:**
- `parts` — full local parts list (with `data.enabled` flags)
- `coverage` — `getPartsCoverage()` → `Map<uid, isRevealing: boolean>`
- `plotPages` — all pages of the active plot
- `pageIndex` — 0-based current page index
- `parsedRules` — `parseRules(config.rules)` (slot visibility rules from config)
- `activePage` — `plotPages[pageIndex]`

---

**Step 1 — Build enabled parts with coverage**

Filter `parts` to those where `data.enabled !== false`, then overlay each part's `config.isRevealing` with the value from `coverage[part.config.uid]`.

→ `enabledParts`

Hidden parts are **not excluded here**. A part is "hidden" for a page only at the prompt assembly step.

---

**Step 2 — Resolve slot statuses** (`resolveSlotStatuses(enabledParts, plotPages, pageIndex)`)

1. Initialize every slot type found across all `enabledParts` to `'removed'`.
2. For each enabled part: compute `baseStatus` (`'revealing'` if `config.isRevealing === true`, else `'covering'`). For each slot type in `config.type`, upgrade the slot's status only if `STATUS_RANK[baseStatus] > STATUS_RANK[current]` (covering=2 > revealing=1 > removed=0).
3. Replay page `actions` from page 0 through `pageIndex` inclusive: each `{ slot, status }` entry overwrites the slot's status in the map (if the slot key exists).

→ `slotStatuses: Map<string, 'covering' | 'revealing' | 'removed'>`

Hidden parts **still contribute** their slot types and base status to this step.

---

**Step 3 — Apply slot visibility rules** (`applyRules(slotStatuses, parsedRules)`)

1. All slots in `slotStatuses` start visible (`true`).
2. Process each parsed rule in order:
   - **Standard rule** (`if <slot> is [status] (and …) then show|hide <slot>`): evaluate all conditions (AND logic) against `slotStatuses`; if all pass, update the target slot's visibility.
   - **forEach rule** (`check each {slot} if {slot} is [status] (and …) then show|hide {slot}`): for every slot in the visibility map, bind it as `{slot}`, evaluate conditions, update that slot's visibility if they pass.

→ `slotVisibility: Map<string, boolean>`

---

**Step 4 — Page requirements check** (`checkPageRequirements(activePage, priorSlotStatuses, enabledParts)`)

`priorSlotStatuses` = `resolveSlotStatuses(enabledParts, plotPages, pageIndex - 1)` (statuses *before* the current page's actions apply).

For each string in `activePage.requirements`:
- Find all enabled parts matching by name or slot type.
- Check whether any matched part has at least one slot type present in `priorSlotStatuses` at a non-`'removed'` value.
- If any requirement is unsatisfied → returns `false`.

Returns `true` only if all requirements pass.

**Contexts:**
- **Editor** (`plot-section.mjs`): drives the "requirements met / failed" badge (display only; generation always proceeds).
- **Play mode**: gates page visibility; a page whose requirements fail is invisible to the user, though its `actions` still advance the slot state for subsequent pages.

Hidden parts **still count** here. `enabledParts` includes all enabled parts regardless of `hiddenParts`.

---

**Step 5 — Assemble visible parts into prompt** (`assemblePrompt(parts, activePage, slotVisibility)`)

Build `visibleParts` by filtering `parts`:
1. Exclude if `data.enabled === false`.
2. Exclude if `slotVisibility` is provided AND none of the part's slot types map to `true` in `slotVisibility`.
3. **NEW** Exclude if `activePage.hiddenParts` contains `part.config.uid`.

Expand page tags (`expandPageTags(activePage.tags, visibleParts)`):
- Split by comma/newline into segments.
- Segments without `{{type}}` tokens: include verbatim.
- Segments with `{{type}}` tokens: for each token, find visible parts whose `config.type` matches; drop the segment if any token has zero matches; cartesian-product expand all matched sets, substituting part names.

For each visible part:
- Collect `data.attributeValues`.
- Include `config.baseline` tags *unless* any attribute value contains the part name (case-insensitive substring match).

Deduplicate all tags case-insensitively (first occurrence wins), join with `, `.

→ Final prompt string

---

### Plot requirements editor — pill sources (Phase 3)

Three source groups, rendered in order:

| Source | Persistence | Default state |
|---|---|---|
| Non-character slot types derived from `libraryParts` | Always shown | Ignore (outlined) |
| All parts from `libraryParts` | Always shown | Ignore (outlined) |
| Orphan UIDs in `slotRequirements` not found in `libraryParts` | Shown until toggled to ignore | Their stored `present`/`absent` state |

Cycle per pill: **ignore (outlined) → present (green/secondary) → absent (red/danger)**. Pills in the ignore state are not written to `slotRequirements` (they are removed from the object). No SearchSelectModal or "Add Part" button.

### Page requirements — Parts section pill states (Phase 2)

| State | Appearance | Stored in `hiddenParts` | Effect on rendering |
|---|---|---|---|
| Blank | Outlined pill | No | Part renders normally |
| Hidden | Filled pill | Yes (uid added) | Part excluded from prompt; slot logic unaffected |

The Parts section shows all parts from `libraryParts` regardless of `data.enabled` state in the local editor, since `hiddenParts` is a property of the plot (shared across character configurations). Parts are displayed in the order returned by `/anytale/parts`.
