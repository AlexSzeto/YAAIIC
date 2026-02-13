# Right-Click Tag Selection UI

## Goals

Create a right-click activated tag selection interface for prompt inputs in workflows that have autocomplete enabled (main UI and inpaint UI). The interface should present a hierarchical browser based on the Danbooru tag category tree, allowing users to navigate through tag groups and select individual tags to insert into their prompts. The UI should be positioned near the cursor using the hover panel and include search functionality with autocomplete.

## Implementation Details

### Component Location
- Place new component in `public/js/app-ui/tag-selector-panel.mjs`
- Component should be reusable across both main UI and inpaint UI

### UI Layout (Top to Bottom)
1. **Breadcrumbs Section**: Small buttons showing navigation path, always starting with "tag_groups" for quick return to root
2. **Search Input**: Custom UI input with autocomplete functionality
3. **Title**: Display current node's name (formatted as "Title With Spaces")
4. **Definition**: Styled component showing definition if it exists (hidden if not)
5. **Navigation Section**: Medium-sized buttons for child nodes/tags with icons:
   - Icon for navigable nodes (can drill down)
   - Different icon for leaf nodes (selectable tags)
6. **Footer Section**: Contains two buttons:
   - "Select" button: Adds current tag to prompt (disabled when viewing category without definition)
   - "Cancel" button: Closes panel without adding tags

### Data Structure
The tag data comes from two sources:
1. **Tag definitions and list**: Existing `/tags` endpoint
2. **Category tree**: `danbooru_category_tree.json` (needs to be added to `/tags` endpoint response)

Example category tree structure:
```json
{
  "tag_groups": {
    "body": {
      "hair": { "long_hair": {}, "short_hair": {} },
      "eyes": { "blue_eyes": {}, "red_eyes": {} }
    },
    "clothing": { ... }
  }
}
```

### Title/Name Formatting Rules
Convert internal tag names to display-friendly format:
- "sports_festival" → "Sports Festival"
- "tag_groups/body" → "Body"
- "tag_group:colors" → "Colors"

Rules:
1. Remove "tag_groups:" prefix if present
2. Remove any text before and including "/" 
3. Replace underscores with spaces
4. Capitalize each word

### Tag Insertion Behavior
When a tag is selected and confirmed:
1. Append to end of existing prompt
2. Add comma before tag if prompt doesn't end with comma
3. Format: `existing prompt, new_tag` or just `new_tag` if prompt is empty
4. Close the panel

### Interaction Flow
1. User right-clicks in prompt input (only if autocomplete enabled for workflow)
2. Panel opens at cursor position showing root level (tag_groups children)
3. User can:
   - Click navigation buttons to drill into categories or view tags
   - Use search with autocomplete to jump directly to specific tags/categories
   - Click breadcrumbs to navigate back up the tree
   - Click "Select" to add current tag to prompt (if it has a definition)
   - Click "Cancel" to close without adding
4. Selecting from autocomplete navigates to that tag (doesn't immediately add it)
5. Only clicking "Select" button adds tag and closes panel

### Context Menu Replacement
- Right-click in prompt input should suppress default browser context menu
- If this requires significant reusable code, create utility in custom-ui

### Error Handling
- If tags fail to load: Send console.error message
- If user right-clicks before tags load: Ignore the action (no panel shown)
- No loading state required

### Styling
- Use existing hover panel defaults for container
- Use theme tokens from theme.mjs for colors, spacing, typography
- Follow goober styling patterns
- Ensure panel stays within viewport bounds
- Panel should not follow cursor after initial positioning

### Integration Points
**Generation Form** (`public/js/app-ui/generation-form.mjs`):
- Textarea with id="description" needs contextmenu event listener
- Check if workflow.autocomplete is enabled before showing panel
- Pass necessary callbacks for tag insertion

**Inpaint Form** (`public/js/app-ui/inpaint-form.mjs`):
- Same integration as generation form

**Server** (`server/server.mjs`):
- Extend `/tags` endpoint to include category tree from `danbooru_category_tree.json`
- Response format: `{ tags: [...], definitions: {...}, categoryTree: {...}, filters: {...} }`

**Tag Data Module** (`public/js/app-ui/tag-data.mjs`):
- Extend existing tag-definitions.mjs (rename to tag-data.mjs)
- Load and cache category tree in addition to tag definitions
- Provide `getCategoryTree()` accessor function

## Tasks

[x] Update `/tags` endpoint to include category tree
   1. Read `server/resource/danbooru_category_tree.json` in the `/tags` endpoint handler
   2. Parse the JSON and add it to the response object as `categoryTree`
   3. Update response format to: `{ tags: [...], definitions: {...}, categoryTree: {...}, filters: {...} }`
   4. Add error handling for missing or invalid category tree file (log error, return empty object)
   5. Test endpoint returns expected data structure

[x] Create reusable context menu suppression utility
   1. Create `public/js/custom-ui/util-contextmenu.mjs` with helper function
   2. Export `suppressContextMenu(element, handler)` that:
      - Adds contextmenu event listener to element
      - Calls `event.preventDefault()` to suppress default menu
      - Calls provided handler with event details (cursor position, etc.)
      - Returns cleanup function to remove listener
   3. Add JSDoc documentation with usage example
   ```javascript
   // Example API:
   export function suppressContextMenu(element, handler) {
     const listener = (event) => {
       event.preventDefault();
       handler({ x: event.clientX, y: event.clientY, event });
     };
     element.addEventListener('contextmenu', listener);
     return () => element.removeEventListener('contextmenu', listener);
   }
   ```

[x] Extend tag data module to include category tree
   1. Rename `public/js/app-ui/tag-definitions.mjs` to `public/js/app-ui/tag-data.mjs`
   2. Update the existing `loadTagDefinitions()` function to also cache:
      - `categoryTree` from the `/tags` endpoint response
      - `tags` list from the response (optional, for future use)
   3. Add new export `getCategoryTree()` that returns the cached category tree
   4. Keep existing exports: `getTagDefinition()`, `isTagDefinitionsLoaded()`, `getTagDefinitionsCount()`
   5. Update console logs to reflect broader scope ("Tag data loaded" instead of "Tag definitions loaded")
   6. Update all imports throughout codebase from `tag-definitions.mjs` to `tag-data.mjs`
   ```javascript
   // New/Updated exports:
   export async function loadTagDefinitions()   // Existing - now also caches categoryTree and tags
   export function getTagDefinition(tagName)    // Existing - returns definition or null
   export function getCategoryTree()            // New - returns category tree object
   export function isTagDefinitionsLoaded()     // Existing - returns boolean
   export function getTagDefinitionsCount()     // Existing - returns count
   ```

[x] Create name formatting utility function
   1. Add function to `public/js/app-ui/tag-data.mjs`
   2. Implement `formatTagDisplayName(internalName)` that:
      - Removes "tag_groups:" prefix
      - Removes text before and including "/"
      - Replaces underscores with spaces
      - Capitalizes each word
   3. Add unit test examples in JSDoc comments
   ```javascript
   // Examples:
   // "sports_festival" → "Sports Festival"
   // "tag_groups/body" → "Body"
   // "tag_group:colors" → "Colors"
   ```

[x] Create tag selector panel component structure
   1. Create `public/js/app-ui/tag-selector-panel.mjs`
   2. Export `TagSelectorPanel` component that accepts props:
      - `onSelect: (tagName) => void` - callback when tag is selected
      - `onClose: () => void` - callback when panel should close
      - `position: {x, y}` - cursor position for panel placement
   3. Set up internal state for:
      - Current navigation path (array of node names)
      - Current node data (children to display)
      - Search input value
   4. Initialize at root level showing tag_groups children
   5. Component should use HoverPanelContainer or similar positioning logic
   6. Add styled components for different sections (breadcrumbs, navigation grid, footer)

[x] Create tag definition display component
   1. Create styled component in tag selector panel file for showing definitions
   2. Use medium padding, subtle background color from theme
   3. Border-left accent using primary theme color
   4. Text color from theme.colors.text.secondary
   5. Component should handle empty/null definitions (not render anything)
   6. Follow goober component naming conventions

[x] Implement breadcrumb navigation
   1. Create breadcrumb section showing navigation path
   2. Always start with "tag_groups" as first breadcrumb
   3. Use small buttons from custom-ui
   4. Each breadcrumb is clickable to navigate back to that level
   5. Current location shown as last item in breadcrumb trail
   6. Use theme.spacing for gaps between items
   7. Display formatted names (not internal names)

[x] Implement search input with autocomplete
   1. Add custom UI Input component at top of panel
   2. Import and configure autocomplete similar to `autocomplete-setup.mjs`
   3. Configure to search through all tags in definitions
   4. On selection: navigate to that tag's location in tree (don't close panel)
   5. Autocomplete should replace entire input value with selection (default behavior)
   6. Position autocomplete dropdown relative to panel, not body
   7. Ensure autocomplete works within hover panel's z-index

[x] Implement title and definition display
   1. Show current node's formatted name as title using theme typography
   2. Use tag definition component to show definition if it exists
   3. Definition should display below title with appropriate spacing
   4. For categories without definitions, definition area should be hidden
   5. Title should use theme.colors.text.primary
   6. Apply medium spacing between title and definition

[x] Implement navigation buttons section
   1. Create grid/flex layout for child nodes (wrap as needed)
   2. Use medium-sized buttons for each child
   3. Add appropriate icon prefix for each button:
      - Category/navigable nodes: folder or chevron icon
      - Selectable tags (with definitions): tag or checkmark icon
   4. Clicking navigable node: update path and display its children
   5. Clicking leaf tag node: update current selection (for Select button)
   6. Sort children alphabetically by display name
   7. Make section scrollable if many children
   8. Use theme spacing for gaps between buttons

[x] Implement footer with select and cancel buttons
   1. Create footer section with flexbox layout
   2. Add "Select" button (primary variant) and "Cancel" button (secondary variant)
   3. Select button should be:
      - Disabled when viewing category without definition
      - Enabled when viewing tag with definition
      - On click: call onSelect with current tag name, then onClose
   4. Cancel button should always be enabled
   5. On click: call onClose without selecting
   6. Use theme spacing for footer padding and gap between buttons
   7. Ensure buttons don't wrap on narrow panels

[x] Wire tag insertion logic
   1. In `public/js/app-ui/generation-form.mjs` and `inpaint-form.mjs`:
   2. Add state for tracking tag selector panel visibility
   3. Create handler for tag selection that:
      - Gets current prompt value
      - Checks if prompt ends with comma
      - Appends comma if needed: `existingPrompt.trim().endsWith(',') ? ' ' : ', '`
      - Appends selected tag
      - Updates form state with new prompt value
      - Closes panel

[x] Integrate tag selector with prompt inputs
   1. In generation-form and inpaint-form components:
   2. Import suppressContextMenu utility and TagSelectorPanel component
   3. Add contextmenu listener to textarea with id="description"
   4. Check if workflow.autocomplete is true before showing panel
   5. If false or data not loaded: ignore right-click (allow default behavior to be suppressed, just don't show panel)
   6. If true: 
      - Store cursor position from event
      - Show TagSelectorPanel at cursor position
   7. Pass onSelect and onClose handlers to panel
   8. Ensure panel is positioned within viewport bounds

[x] Add category and tag count display to title section
   1. Add helper method `getCategoriesAndTagsCounts()` that:
      - Gets current children from `getCurrentChildren()`
      - Counts navigable children (categories) using `isNodeNavigable()`
      - Counts non-navigable children with definitions (tags)
      - Returns object: `{ categories: number, tags: number }`
   2. Modify `renderTitleSection()` to:
      - Call `getCategoriesAndTagsCounts()` to get counts
      - Add a `<div>` below the `<H2>` element
      - Format counts as: "{categories} category/categories, {tags} tag/tags"
      - Use proper pluralization (append 's' to noun if count !== 1)
      - Omit category count and comma if categories === 0
      - Display format examples:
        - "3 categories, 5 tags"
        - "1 category, 8 tags"
        - "10 tags" (when categories === 0)
        - "1 tag" (when tags === 1 and categories === 0)

[x] Test tag selector integration
   1. Manually test right-click on prompt input for workflow with autocomplete enabled
   2. Verify panel opens at cursor position with tag_groups children
   3. Test navigation through categories (breadcrumbs and drilling down)
   4. Test search autocomplete navigation
   5. Test selecting a tag with definition adds it to prompt correctly
   6. Test comma insertion logic (with and without trailing comma)
   7. Test cancel button closes without adding
   8. Test that right-click on non-autocomplete workflow doesn't show panel
   9. Verify proper error handling when tags fail to load
   10. Test on both main UI and inpaint UI

[x] Convert tag selector panel to modal
   1. Import Modal component from `custom-ui/overlays/modal.mjs` in tag-selector-panel.mjs
   2. Add `isOpen` prop to TagSelectorPanel component API (remove `position` prop)
   3. Replace PanelContainer styled component usage with Modal component
   4. Configure Modal with:
      - size='medium' (or adjust to match current 400px width)
      - title prop for current node's formatted name
      - onClose prop calling this.props.onClose
      - isOpen prop from component props
   5. Move breadcrumbs, search, definition, and navigation sections into Modal children
   6. Remove Close button from footer section (keep only Select button)
   7. Remove position-based styling logic (Modal centers automatically)
   8. Update generation-form.mjs usage:
      - Change from conditional render to always-render with isOpen prop
      - Pass isOpen={showTagPanel} instead of conditionally rendering
      - Remove tagPanelPosition state and related logic
   9. Update inpaint-form.mjs with same changes as generation-form
   10. Test that modal opens on right-click, centers properly, and closes on click-outside

   [x] Change the dataset of the tag selection search/autocomplete from the tags list to a merge of the tags and categories list. Convert the data like so:

   1. subcategories (anyting with `/`) are removed.
   2. underscores are changed to spaces (`about_us` -> `about us`)
   3. `tag_group:` is removed: (`tag_group:about_us` -> `about us`)
   4. duplicate entries are removed (i.e. if the tags `about_us` and `tag_group:about_us` exist, the second entry would not be added)

   Use the following logic when the user selects an autocomplete item:

   1. Try to see if the tag is a category. If it is, make the breadcrumb `tag groups -> search result` and update the list of children below the tag.
   2. Update the definition of the tag, if it exist.

   [x] Update the dataset of the tag selection to the
   following:

   1. subcategories (anything with `/`): `tag_group:about_us/user_contributions` -> `about us: user contributions`
   2. tag groups (tags starting with `tag_group:` but not a subcategory):
   `tag_group:about_us` -> `category: about us`
   3. normal tags:
   `about_us` -> `about us` (same as before)

   Update the autocomplete logic to handle all three cases, and expand on the breadcrumb handling for subcategories and tag groups:
   1. replace the breadcrumb with just the search result tag. this is the current item.
   2. try to find a node in the category tree that has the current item as its child. if a node is found, add the node to the start of the breadcrumb, set the node as the current item, and repeat.
   3. if the node is 'tag_group', stop. If a node can't be found, add 'tag_group' to the start of the breadcrumb, and stop.