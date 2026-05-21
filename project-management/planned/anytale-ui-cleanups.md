# AnyTale UI Cleanups

## Goal

Polish the AnyTale editor UI for clarity and usability. Searchable list items (parts, outfits, characters) should display both name and type in their label so users can distinguish items with the same name — e.g. "shirt (outer upper body)" or "dress (outer upper body, inner upper body)".

## Notes

- Part labels in search/select lists should append the type array in parentheses after the name.
- When a part has multiple types, all should be listed: "dress (outer upper body, inner upper body)".
- May apply to any component using the search-select modal or inline searchable list for AnyTale entities.
- Other AnyTale UI clean-ups can be collected here before grooming.

## Additional Idea: Parts Tags Helper — Insert All & Prune

Update the parts tags helper button into two actions:
- **Insert all**: existing insert buttons but adds all tag combinations without any existence checks (unconditional insert).
- **Prune**: takes the current tags list and removes any tags that do not appear in the autocomplete suggestion list.

## Additional Idea: Unified Slot/Part Pill UI for Plot Pages

Replace the separate parts-preview, parts-requirements, and parts-action UI on plot pages with a single unified pill list. Each pill represents one slot or part name and encodes all relevant state visually:

**Pill anatomy** (left to right):
- **Lock/unlock icon** (left edge): toggles whether this slot/part is a requirement for the current page. Click only the lock icon to toggle.
- **Background color**: indicates the current status of the slot (covering, revealing, removed, or n/a for name-based pills).
- **Label**: slot type string or part name.
- **Arrow + new status** (right side, slot pills only): shows the status transition that fires before this page renders. Click anywhere on the pill except the lock icon to cycle/change the transition status.

Example: `[🔒] outer upper body → revealing` with a secondary background color means: this slot is required for the page, it is currently in "covering" state (background encodes that), and it transitions to "revealing" before the page renders.

**Population rules:**
- The pill list is auto-populated from the currently active/enabled parts list: slots first (one pill per unique slot type), then part names.
- Name-based pills support lock/unlock only — no status or transition (background is always secondary/gray, no arrow).
- Slot-based pills support both lock/unlock and status transition.

**Plot-level requirements:**
- The entire plot block also needs its own requirements list (not per-page): a map of slot/part id → required status, e.g. `{ "outer upper body": "covering", "outer lower body": "covering" }`.
- This defines what state is expected to be true for the plot to be selectable at all (used by play mode bootstrap).

**Open questions:**
- How does the background color encoding work for slots that have no current status (not in any active part)?
- Should the per-page transition arrow be optional (no transition = pill shows status only, no arrow)?
