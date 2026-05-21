# AnyTale Advanced Character & Outfits Import (by raw prompt tags)

## Goal
Replace the existing viewer window import functionality with an advanced parser that reconstructs the AnyTale Character/Outfit/Parts lists by extracting and matching comma-separated tags from the image's raw prompt against the existing parts library.

## Tasks

- [x] Task 1: Implement Prompt Extraction and Tag Parsing (Step 1)
  - Locate the import trigger in the viewer window (`gallery.mjs` or similar).
  - Extract the raw prompt (e.g., `positivePrompt`) from the selected image's metadata.
  - Write a helper function to split this prompt by commas and trim whitespace from each tag.

- [x] Task 2: Implement Pre-Import Data Clearing (Step 0)
  - Before applying the parsed tags, implement logic to clear existing data based on the active tab.
  - **Character & Outfits tab:** Clear the items in both the Character dynamic list and Outfits dynamic list.
  - **Parts & Plot tab:** Clear the items in the unified parts dynamic list, and reset the Plot (UID/Name) and Page Number input fields.

- [x] Task 3: Implement Core Tag Matching and List Assignment (Step 2)
  - Iterate through the parsed tags. For each tag, search the global parts library for the *first* part where the tag exactly matches (case-insensitive) either a baseline tag or one of its attribute options.
  - Implement list assignment logic when a match is found:
    - **Parts & Plot tab:** Add the part to the unified parts list.
    - **Character & Outfits tab:** Check the part's `type` against `recommendedCharacterPartTypes` and `recommendedOutfitPartTypes` (from server config). Add to the Character list, Outfits list, or both, as specified in the rules.
  - Ensure duplicate parts aren't added to the same list if they were already added.

- [x] Task 4: Implement Attribute Updates (Step 3)
  - Within the tag matching loop, if a tag matches a part's *attribute option*, set that attribute's value to the matched tag.
  - Ensure that if the part has *already* been added to a list during the current import (e.g., by an earlier tag), its attribute value in the list is updated/overwritten instead of adding a duplicate part.

- [x] Task 5: Implement Plot/Page Metadata Restoration (Step 4)
  - After completing the tag iteration and list population, add a conditional check for the `Parts & Plot` tab.
  - If active, invoke the existing restoration logic to populate the Plot UID/Name and Page Number fields from the image metadata.

- [x] Task 6: Integration and End-to-End Manual Testing
  - Connect all the implemented steps to the viewer's Import action, replacing the legacy metadata-based character loading logic.
  - **Test 1 (Character & Outfits):** Import an image. Verify lists clear, parts are appropriately routed based on part types, and attributes update correctly when later tags match attribute options.
  - **Test 2 (Parts & Plot):** Import an image. Verify the unified list populates correctly, and Plot/Page data inputs are accurately restored from metadata.

## Implementation Details
- The logic for `recommendedCharacterPartTypes` and `recommendedOutfitPartTypes` relies on the global configuration fetched from the server.
- String matching for tags and attributes should always be done case-insensitively with leading/trailing spaces trimmed: `tag.toLowerCase().trim() === libraryItem.toLowerCase().trim()`.
- Use existing custom UI dynamic list components (`dynamic-list.mjs`) to manipulate the frontend lists (e.g., clearing items, adding items, updating item values).
