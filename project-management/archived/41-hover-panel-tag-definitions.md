# Show Danbooru Tag Definitions on Hover

## Goals
Create a new custom-ui component for mouse hover. By default, it is a context that can be passed to other components that needs to show a panel with content on hover, but it can also be activated by a function call. This component should be standalone at the custom-ui level.

Update the test within custom-ui to showcase the hover-panel.

The tags CSV file had been augmented with a new column "definition" that contains the definition of the tag. The tag definitions need to be loaded into a dictionary for quick lookup. The dictionary should be available at the app-ui level. Beware that entries may contain strings with commas (i.e. `"this is still, one column"`), so a proper CSV parser should be used.

Once the hover-panel is created, add a selection change listener to the tag-input component. When the user selects a tag, the hover-panel should show the tag definition of the selected tag.

## Implementation Details

### Hover Panel Component (`public/js/custom-ui/overlays/hover-panel.mjs`)
A standalone component that displays content on hover. Features:
- **HoverPanelProvider**: A Preact context provider that manages the global hover panel state
- **useHoverPanel()**: Hook that returns `{ show(content, anchorElement), hide() }` to programmatically control the panel
- **withHoverPanel(Component, getContent)**: Optional HOC for wrapping components that need hover functionality
- Panel positioned relative to anchor element, with smart positioning to stay within viewport
- Styled using Goober consistent with existing `Panel` component (glass variant)
- Auto-hides on mouse leave from both trigger and panel

### Tag Definitions Dictionary (`public/js/app-ui/tag-definitions.mjs`)
A module that loads tag definitions from the server:
- Server endpoint `GET /tags` now returns both tags list AND definitions dictionary in single response
- Old `GET /tag-definitions` endpoint deprecated (redirects to `/tags` for backwards compatibility)
- Server parses CSV properly handling quoted fields with commas
- Client-side module exports `loadTagDefinitions()`, `getTagDefinition(tagName)`, `isTagDefinitionsLoaded()`
- Lazy-loads on first request, caches result
- Definitions are collected for ALL tags (not filtered), while tags list respects query filters

### Autocomplete Selection Listener (`public/js/app-ui/autocomplete-setup.mjs`)
Integrate hover panel with tag selection:
- Import and use `useHoverPanel` context
- On tag selection event, look up definition and show hover panel
- Position panel near the autocomplete dropdown or cursor position

## Tasks

[x] Create HoverPanel component in custom-ui
   1. Create `public/js/custom-ui/overlays/hover-panel.mjs` with HoverPanelProvider context
   2. Implement `useHoverPanel()` hook with `show(content, anchorElement)` and `hide()` methods
   3. Style panel using Goober with glass variant, matching existing Panel component
   4. Implement smart positioning logic to keep panel within viewport bounds
   5. Add auto-hide behavior on mouse leave with small delay to allow hovering over panel
   ```javascript
   // Planned exports:
   export function HoverPanelProvider({ children })  // Context provider
   export function useHoverPanel()                   // Returns { show, hide, isVisible }
   export function HoverPanel()                      // Internal: The actual panel component (rendered by Provider)
   ```

[x] Update custom-ui test.html with hover-panel examples
   1. Import HoverPanelProvider and useHoverPanel
   2. Wrap test app with HoverPanelProvider
   3. Add a "Hover Panel" test section with example buttons that trigger hover content
   4. Demonstrate both programmatic show/hide and hover-triggered display

[x] Create tag definitions endpoint and client module
   1. Add `GET /tags` endpoint in `server/server.mjs` that:
      - Reads `danbooru_tags.csv` using the existing csv-parser
      - Returns `{ tags: [...], definitions: { [tagName]: definition }, filters: {...} }` JSON
      - Tags list is filtered per query parameters (noCharacters, minLength, minUsageCount, categories)
      - Definitions dictionary includes ALL tags with non-empty definitions (not filtered)
   2. Deprecated `GET /tag-definitions` endpoint (redirects to `/tags`)
   3. Create `public/js/app-ui/tag-definitions.mjs` with:
      - `loadTagDefinitions()` - async function to fetch from `/tags` and cache definitions
      - `getTagDefinition(tagName)` - sync lookup returning definition or null
      - `isTagDefinitionsLoaded()` - check if loaded
   ```javascript
   // Exports:
   export async function loadTagDefinitions()     // Fetches from /tags, caches result
   export function getTagDefinition(tagName)      // Returns string definition or null
   export function isTagDefinitionsLoaded()       // Returns boolean
   ```

[x] Integrate hover panel with autocomplete tag selection
   1. Modify `public/js/app-ui/autocomplete-setup.mjs`:
      - Export a setup function that accepts hover panel show/hide callbacks
      - On selection event, look up tag definition and show panel if definition exists
   2. Modify `public/js/app.mjs`:
      - Wrap app with HoverPanelProvider
      - Pass hover panel callbacks to autocomplete setup
      - Load tag definitions on app startup
