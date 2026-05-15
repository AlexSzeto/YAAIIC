# AnyTale Parts Attributes Refactoring
## Goal
Collapse the AnyTale parts attribute data types into a single `attributes` array, migrate existing data, and enhance the UI with a new tag import helper and sorting capabilities.

## Tasks
- [x] **Data Model Validation**: Verify AnyTale endpoints handling parts data to ensure the new `attributes` format is accepted and remove any hardcoded references or schema validations enforcing `categoryAttributes` or `customAttributes`.
- [x] **Migration Script**: Create a one-time migration script to combine `categoryAttributes` and `customAttributes` into `attributes`. The script should parse `categoryAttributes` using `danbooru_category_tree.json`, filter out tags with `:` or `/`, preserve the existing `name`, and combine them into a comma-separated `options` string.
- [x] **UI Rename & Sorting**: Rename "Custom Attributes" to "Attributes" in the UI and enable manual drag-and-drop sorting on the Attributes `DynamicList`.
- [x] **UI Helper Auto-fill**: Update the existing "Colors" and "Variations" helper actions to auto-fill the attribute `name` with "Color" and "Misc" respectively, if the name is currently empty.
- [x] **New Tag Import Helper**: Add a third helper action button (tag icon) to the Attributes UI. Clicking it opens the tag search modal, fetches leaf tags for the selected category (excluding colons/slashes), formats them as a comma-separated string in the `options` input, and auto-fills the `name` with the category name if it is currently empty.
- [x] Modify the dynamic list so that it can put a select input on the right side of the header. the input is technically placed to the left of the custom action buttons. use the same I/O strategy as the embedded checkbox to handle inputs and events. set the height to "compact".
- [x] Modify the attribute dynamic item:
1. Move the helper action buttons below the options input, in its own row. expand them so they are small icon text buttons.
2. Move the value input into the header by using the newly added select input options.
- [x] When the tag import helper is used, restore the previous functionality that preloads the part name as a category, and failing that the part name as a tag, into the search input.
- [x] When a custom-ui text prompt opens with prefilled text, select them all by default on top of shifting focus to the text input.
- [x] On the AnyTale page, load "previewBasePromptByType" in addition to other configs, preferably piggybacking on existing calls. when a type is added to a Part, if the preview baseline tags are empty, look up the preview base prompts by type for a matching entry and replace the empty tags with the preview base prompt.
## Implementation Details
- **Target files for UI**: `character-section.mjs`, `outfit-section.mjs` (and any related attribute components).
- **Migration**: The migration script should be a standalone script that connects to the database and processes all parts records.
- **Backend Check**: Review backend routing or schemas that process part submissions to ensure smooth functioning after the UI removes the `categoryAttributes` payload.
- **UI Details**: Use `sortable={true}` on the `DynamicList` component to enable sorting. Ensure the existing helpers correctly fallback to default names when the user has not provided an attribute name.
