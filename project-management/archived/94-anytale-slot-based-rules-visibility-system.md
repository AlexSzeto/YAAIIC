# AnyTale Slot-Based Rules Visibility System

## Goal
Replace the manual per-part `enabled` toggle and per-page `hiddenParts` array with a slot-based (part-type-based) rules system. Plot pages assign status changes to slots (part types); a global plain-text ruleset processes those statuses into per-slot visibility decisions that drive prompt assembly.

## Tasks

- [x] Task 1: Server — Load Rules File and Expose via Config Endpoint
  - Create `server/resources/anytale-rules.txt` (start with an empty file or a placeholder comment).
  - In `server/features/anytale/router.mjs`, add logic to read `anytale-rules.txt` at the `/anytale/config` handler (use `fs.readFileSync` with a fallback empty string if the file is missing).
  - Include the file contents as a `slotRules` string field in the JSON response alongside the existing `anytaleConfig` fields.
  - **Manual test:** `curl http://localhost:<port>/anytale/config` and verify the response contains a `slotRules` field (empty string is fine).

- [x] Task 2: Schema — Migrate Plot Pages from `hiddenParts` to `actions`
  - In `anytale-state.mjs`, update `createBlankPlot()` (line ~113): replace `hiddenParts: []` with `actions: []` on each blank page object.
  - In `loadPlot()` (line ~137), update the defensive default: replace `hiddenParts: []` fallback with `actions: []`. Do not attempt to migrate old `hiddenParts` data — treat it as removed/ignored.
  - Each action entry shape: `{ slot: string, status: string }` where `slot` is a part type string and `status` is one of `covering`, `revealing`, or `removed`.
  - **Manual test:** Open the AnyTale page, create or load a plot. Inspect localStorage to confirm plot page objects contain `actions: []` and no `hiddenParts` field.

- [x] Task 3: UI — Replace Hidden Parts Control with Slot/Status Action UI
  - In `plot-section.mjs`, remove the `ChipAutocompleteInput` block for `hiddenParts` (lines ~418–425) and the `hiddenPartsSuggestions` useMemo (lines ~277–293).
  - Replace with a new inline action editor consisting of:
    - **Slot dropdown**: options are all unique type strings gathered from `libraryParts` (the full library, not just the active parts list), sorted alphabetically.
    - **Status dropdown**: fixed options `covering`, `revealing`, `removed`.
    - **Add button**: appends `{ slot: selectedSlot, status: selectedStatus }` to `currentPage.actions`, calling `updatePage`.
    - **Chips display**: renders each action in `currentPage.actions || []` as a chip showing `<slot> → <status>` (using the Unicode arrow `→`, U+2192), with a remove button that splices the entry from the array.
  - Default the slot dropdown to the first available type and status dropdown to `covering` on render.
  - **Manual test:** Open AnyTale → Plot section. Add a slot action, verify chip appears with correct `→` formatting. Remove a chip, verify it disappears. Inspect localStorage to confirm `actions` array updates correctly.

- [x] Task 4: Core — Implement Slot Pool and Status Resolution
  - Create `public/js/app-ui/anytale/slot-resolver.mjs`.
  - Implement and export `resolveSlotStatuses(libraryParts, plotPages, currentPageIndex)`:
    1. Build the **slot pool**: collect all unique type strings (case-insensitive, store as lowercase) from every part in `libraryParts`. Initialize each to status `'covering'`.
    2. Iterate `plotPages[0]` through `plotPages[currentPageIndex]` (inclusive). For each page, iterate `page.actions || []`. For each action `{ slot, status }`: if `slot.toLowerCase()` is in the pool, update its status to `status`. If not in the pool, the slot is implicitly `'removed'` (do nothing — it won't appear in the returned map).
    3. Return a `Map<string, 'covering'|'revealing'|'removed'>` (keys are lowercase slot strings).
  - **Manual test (via temporary log):** Add a `console.log` call in `anytale-form.mjs` that calls this function and prints the map. Load AnyTale with a plot that has page actions and verify the output is correct. Remove the log after verification.

- [x] Task 5: Core — Implement Rules Parser
  - In `slot-resolver.mjs`, implement and export `parseRules(rulesText)`:
    - Split `rulesText` by newline. Skip blank lines. Detect rule type by the leading keyword (case-insensitive).
    - **Standard rules** — lines starting with `if`:
      - Grammar: `if <slot> is [status] (and <slot> is not [status] | and <slot> is [status])* then show|hide <slot>`
      - `<...>` denotes a named slot; `[...]` denotes a status string.
      - Parse `is not` before bare `is` to avoid misclassification.
      - Return a rule object of type `'standard'`:
        ```js
        { type: 'standard', conditions: [{ slot: string, operator: 'is'|'is not', status: string }], action: 'show'|'hide', target: string }
        ```
    - **forEach rules** — lines starting with `check each {slot}`:
      - Grammar: `check each {slot} if {slot} is [status] (and {slot} is not [status])* then show|hide {slot}`
      - `{slot}` is a loop variable bound to each available slot during evaluation — not a literal slot name. All occurrences in conditions and the action target refer to the currently iterated slot.
      - Parse conditions and action using the same `is`/`is not` logic as standard rules, but store the slot reference as the sentinel string `'{slot}'`.
      - Return a rule object of type `'forEach'`:
        ```js
        { type: 'forEach', conditions: [{ slot: '{slot}', operator: 'is'|'is not', status: string }], action: 'show'|'hide', target: '{slot}' }
        ```
    - All literal slot and status strings are stored lowercase and trimmed. Silently skip malformed lines.
  - **Manual test (via temporary log):** Write a few rules in `anytale-rules.txt` (see Implementation Details for examples), add a `console.log(parseRules(slotRules))` in `anytale-form.mjs` after config loads, and verify the parsed output matches expectations.

- [x] Task 6: Core — Apply Rules to Derive Slot Visibility
  - In `slot-resolver.mjs`, implement and export `applyRules(slotStatuses, rules)`:
    1. Initialize a `visibility` Map: for every slot in `slotStatuses`, set visibility to `true` (all available slots start visible). Slots not in `slotStatuses` (unavailable/removed) are excluded from this map.
    2. Process each rule in order:
       - **Standard rule** (`type: 'standard'`): evaluate all AND conditions against `slotStatuses`. A condition `{ slot, operator: 'is', status }` passes if `slotStatuses.get(slot) === status`. `'is not'` passes if they differ. If a condition's slot is not in `slotStatuses`, treat its status as `'removed'`. If all conditions pass, apply `rule.action` (`show`/`hide`) to `rule.target` in the visibility map. If the target is not in the visibility map, ignore.
       - **forEach rule** (`type: 'forEach'`): iterate over every slot in the visibility map. For each iterated slot, substitute it for `'{slot}'` in all condition slot references and the action target, then evaluate conditions and apply the action exactly as a standard rule would — using the substituted slot name throughout.
    3. Return the `visibility` Map<string, boolean>.
  - **Manual test (via temporary log):** After Task 5's parser test, chain this function and log the resulting visibility map. Verify that standard rules flip specific slots, and that a forEach rule (e.g., `check each {slot} if {slot} is [removed] then hide {slot}`) correctly hides all slots whose status is `removing`. Remove logs after verification.

- [x] Task 7: Core — Update `assemblePrompt` to Use Slot Visibility
  - Update `assemblePrompt` in `prompt-assembler.mjs` (line 135):
    - Change signature to `assemblePrompt(parts, activePage, slotVisibility)` where `slotVisibility` is a `Map<string, boolean>` (or `undefined` for backwards compat).
    - Remove the `enabledParts` filter that checks `p.data.enabled`. Instead, filter parts to those that are **visible**: a part is visible if `slotVisibility` is provided AND at least one of the part's `config.type` entries (lowercased) maps to `true` in `slotVisibility`. If `slotVisibility` is `undefined`, include all parts (backwards compat fallback).
    - Remove the `hiddenSet` / `hiddenParts` logic entirely.
    - Update `expandPageTags` call: pass the newly filtered visible parts (not the old `enabledParts`) so `{{type}}` template expansion only includes visible parts.
  - **Manual test:** See Task 8's end-to-end test.

- [x] Task 8: Integration — Wire Slot Resolution, Rules, and Prompt Assembly in anytale-form.mjs
  - Import `resolveSlotStatuses`, `parseRules`, `applyRules` from `slot-resolver.mjs`.
  - After the config fetch response is received, parse the rules once: `const rules = parseRules(config.slotRules || '')` and store in a ref or state variable (rules do not change at runtime).
  - Create a helper `computeSlotVisibility(libraryParts, plotPages, pageIndex)` that calls `resolveSlotStatuses` then `applyRules(slotStatuses, rules)` and returns the visibility map.
  - Update all three `assemblePrompt` call sites in `anytale-form.mjs`:
    - Line ~234 (main generation handler): compute `slotVisibility` for `activePlotPage` and pass as third argument.
    - Line ~295 (Character & Outfits tab generation): same — compute and pass `slotVisibility`.
    - Line ~654 (live preview prompt computation): compute and pass `slotVisibility`.
  - **Manual test (end-to-end):**
    1. Write a rule in `anytale-rules.txt`, e.g.: `if <lower body> is [covering] then hide <lower body>`
    2. Load AnyTale with parts that have `lower body` as a type. Add a page with no actions (so `lower body` stays `covering`).
    3. Trigger generation or view the live preview prompt. Verify tags from `lower body` parts are excluded.
    4. Add a page action setting `lower body` to `revealing`. Switch to that page. Verify those tags now appear in the prompt.
    5. Add a rule `if <lower body> is [revealing] then show <lower body>` and verify the slot becomes visible even when covering.

- [x] Task 9: Cleanup — Remove Per-Part `enabled` Toggle
  - In `anytale-form.mjs`, locate and remove all UI elements that render the per-part enabled toggle (search for references to `p.data.enabled` and any checkbox/toggle bound to it).
  - Remove any state or event handler code that reads or writes `part.data.enabled`.
  - Do not attempt to migrate old `enabled` values — they are ignored by the new system.
  - **Manual test:** Reload AnyTale. Confirm no enabled toggle appears in the parts list. Confirm prompt assembly still works correctly without the toggle.

- [x] Task 10: Remove `progressionDisabledParts` from Schema and UI
  - `progressionDisabledParts` on the plot object is now redundant — the set of removed parts can be derived by calling `resolveSlotStatuses` on all pages and collecting slots with status `'removed'`.
  - In `anytale-state.mjs`: remove `progressionDisabledParts: []` from `createBlankPlot()` and the defensive default in `loadPlot()`.
  - In `plot-section.mjs`: remove the "Disabled Parts" `ChipAutocompleteInput` and the `progressionPartSuggestions` useMemo. If the Progression section becomes empty after this removal (only "Progression Sections" remains), evaluate whether to keep or restructure the section.
  - **Manual test:** Open AnyTale → Plot section. Confirm the "Disabled Parts" chip input no longer appears. Inspect localStorage to confirm `progressionDisabledParts` field is gone from new plot objects.

- [x] Task 11: Replace Add Button with Confirm Icon Button
  - In `plot-section.mjs`, the "Add" text button in the slot action editor should use the existing icon button pattern used throughout the chip autocomplete UI: a `medium-icon` (or `small-icon`) Button with the `check` icon, consistent with how items are confirmed/added elsewhere in the page.
  - Remove the text label from the button; use only the icon.
  - **Manual test:** Open AnyTale → Plot section. The Add action button should display as a checkmark icon button matching the style used in other chip-input confirm actions in the app.

- [x] Task 12: Fix Action Chip Display to Match Existing Chip Style
  - The current chip display for slot actions uses `HorizontalLayout` as the chip container, which lacks `flex-wrap` and may differ visually from the chip rows in `ChipAutocompleteInput`.
  - Replace the `HorizontalLayout` wrapping the chips with an inline styled div matching the `ChipRow` style in `chip-autocomplete-input.mjs` (`display: flex; flex-wrap: wrap; gap: spacing.small.gap; align-items: center`). Do not extract a new component — use a local `styled` div in `plot-section.mjs`.
  - Verify that `Button variant="chip" icon="x"` is used consistently for each chip, matching the exact approach in `ChipAutocompleteInput`.
  - **Manual test:** Add several slot actions and confirm the chips wrap correctly, align vertically, and match the visual style of chip rows elsewhere in AnyTale.

- [x] Task 13: Fix Rules Not Applied to Live Preview Prompt
  - **Root cause**: Parsed rules are stored in a `useRef` (`rulesRef`) in `anytale-form.mjs`. When the config fetch completes and rules are parsed, updating a ref does not trigger a re-render, so `previewPrompt` (a `useMemo`) never re-runs with the populated rules.
  - **Fix**: Replace `rulesRef` with a `useState` variable (`parsedRules`, `setParsedRules`). In the config fetch effect, call `setParsedRules(parseRules(...))` instead of assigning to `rulesRef.current`. Update `computeSlotVisibility` to take `parsedRules` from state and add it to its `useCallback` dependency array. Add `computeSlotVisibility` as a dependency of `previewPrompt` (already there) so re-computation triggers correctly.
  - While here, also verify the live preview updates when page tags change — `livePlot` should update via `onPlotChange={setLivePlot}` in PlotSection. If tags still don't reflect in the preview after this fix, investigate whether the `useEffect([plot])` in `plot-section.mjs` correctly calls `onPlotChange`.
  - **Manual test:** Load AnyTale with the existing `anytale-rules.txt` rules. With parts that have `outer upper body` as a type, confirm that (a) the live preview prompt excludes `inner upper body` parts when `outer upper body` is covering, and (b) editing a page's tags field immediately updates the live preview text.

- [x] Task 14: Add Console Tracing to Slot Rule Processing
  - In `slot-resolver.mjs`, add `console.group`/`console.groupEnd` debug tracing inside `applyRules` that logs: the initial slot status map, each rule being evaluated, each condition's resolved value and pass/fail result, and the final visibility change (or skip reason) for each rule.
  - Gate the tracing behind a module-level `const DEBUG_RULES = false` flag so it can be toggled without touching call sites.
  - **Manual test:** Set `DEBUG_RULES = true`, reload AnyTale, and confirm the browser console shows a full trace of rule evaluation matching expected behaviour. Set it back to `false` when done.

- [x] Task 15: Restore Per-Part `enabled` Toggle in Parts & Plot Tab
  - The manual enabled/disabled toggle on each part in the Parts & Plot tab is a UI-only editorial control. It is not part of the slot rules system. Parts marked disabled here are excluded from prompt assembly before slot rules are evaluated.
  - Restore `enabled: true` in `createDefaultPart()` in `anytale-state.mjs`.
  - Restore `getEnabled` and `onToggleEnabled` props on the `DynamicList` in `anytale-form.mjs` (Parts & Plot tab only). The Character & Outfits tab does not have this toggle — parts built from character/outfit data have no `enabled` field and must always be treated as enabled.
  - In `assemblePrompt` (`prompt-assembler.mjs`), restore the enabled pre-filter: before applying slot visibility, exclude any part where `p.data?.enabled === false`. Parts with no `enabled` field (i.e., `undefined`) default to enabled so Character & Outfits parts are unaffected.
  - **Manual test:** Open AnyTale → Parts & Plot tab. Confirm each part has its enabled toggle. Toggle a part off, verify its tags disappear from the live preview. Toggle it back on, verify tags reappear. Confirm the slot rules still apply on top of the enabled filter (a disabled part stays out even if its slot is visible).
