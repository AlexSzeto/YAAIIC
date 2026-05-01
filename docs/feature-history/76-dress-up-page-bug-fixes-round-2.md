# Dress-Up Page Bug Fixes (Round 2)

## Goal

Fix autocomplete and dynamic-list issues on the dress-up page: move the app-coupled `TagInput` to `app-ui`, convert Additional Prompts into a togglable `DynamicList`, restore autocomplete on all tag inputs, restrict attribute autocomplete to tags that include the item name, and support TAB/ENTER to confirm attribute selections.

## Tasks

- [x] Move `public/js/custom-ui/io/tag-input.mjs` to `public/js/app-ui/tags/tag-input.mjs` and update all import paths that reference it (dress-up-form.mjs, clothing-item.mjs)
- [x] Convert the `additionalPrompts` string field in `dress-up-state.mjs` and `dress-up-form.mjs` to an array of objects `{ id, name, text, enabled }` — update `loadState`, `saveState`, and `DEFAULT_STATE` accordingly; migrate legacy string values on load
- [x] Replace the `TagInput` "Additional Prompts" field in `dress-up-form.mjs` with a `DynamicList` where each item renders a row containing: a compact `Input` for the item label (`name`), a `Checkbox` for "Use" (`enabled`), and a `TagInput` for the prompt text; `name` is display-only and not included in the assembled prompt; the `DynamicList` title should be "Additional Prompts"
- [x] Update `prompt-assembler.mjs` to accept the new `additionalPrompts` array (instead of string), and only include items where `enabled` is true
- [x] Fix the attribute autocomplete filter in `clothing-item.mjs` so it only suggests tags whose text includes `item.name` as a substring (case-insensitive) — e.g. for name "shirt", show "white shirt" but not "dress"; keep the existing exclusion of already-added attributes and state tags
- [x] Add TAB and ENTER key support to the attributes input in `clothing-item.mjs`: when either key is pressed and the suggestion list is showing, select the highlighted suggestion; when no suggestion is highlighted and the input has text, confirm the raw query text as a new attribute pill; in both cases prevent default browser behaviour
- [x] Restore autocomplete on the `TagInput` used for **Related Tags** inside `clothing-item.mjs` — verify the moved `TagInput` (from task 1) still initialises `autoComplete.js` and resolves tags correctly within the `DynamicList` context
- [x] Verify the `TagInput` instances inside the Additional Prompts `DynamicList` also initialise `autoComplete.js` correctly (autocomplete + tag-selection modal) after the move to app-ui
