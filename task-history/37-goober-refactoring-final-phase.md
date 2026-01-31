# Goober Refactoring - Final Phase
## Goals
Complete the Goober migration by refactoring all remaining app-ui components, removing deprecated component files, eliminating all inline styles, and cleaning up legacy CSS files to ensure the entire application uses Goober styling exclusively.

[x] Add Class Names to All Styled Components in v3
[] Add className property to all styled components in v3 folder
1. Search through all `.mjs` files in `public/v3/` directory
2. Find all `styled()` component definitions
3. Add `.className = '<descriptive-kebab-case-name>'` after each styled component definition
4. Ensure class names follow the pattern used in existing code (e.g., `GalleryItemContainer.className = 'gallery-item-container'`)

## Implementation Details
- Refactor takes place exclusively inside the v2 folder before implemetation is complete.
- Refactor remaining app-ui components (GenerationForm, GeneratedResult, InpaintForm, InpaintCanvas, SeedControl, ExtraInputsRenderer, WorkflowSelector)
- Refactor inpaint-page.mjs
- Remove all inline styles from components
- Clean up CSS files while maintaining visual parity
- Delete deprecated component files

## Implementation Notes
- app-ui refactored components are not added to the custom-ui test html.
- **Goober conditional styling**: When using conditionals in Goober's `styled` template literals, always use ternary operators with empty strings: `${condition ? \`styles\` : ''}`. Do NOT use `&&` operators like `${condition && \`styles\`}` as this outputs the string `"false"` into the CSS when the condition is falsy.
- **Goober subcomponent targeting limitation**: Goober does NOT support targeting styled subcomponents in parent selectors (e.g., `${ParentComponent}:hover &`). This syntax, which works in styled-components, does not function in Goober. **Workarounds**: Use component state to track hover status and conditionally apply props, or restructure styles to use direct pseudo-selectors and descendant selectors without interpolated component names.
- **Component Migration**: For instructions on migrating from old component APIs to new Goober-styled versions, see [component-transition-guide.md](component-transition-guide.md).
- **Button Usage**: All buttons in custom UI components should use the existing Button component with appropriate variants (medium-text, medium-icon, medium-text, small-text, small-icon) and colors (primary, secondary, success, danger). Do NOT create custom styled button elements.
- **Disabled opacity**: Use `opacity: 0.4` for opacity-based disabled states on components. This provides sufficient visual distinction while maintaining readability.
- **Theme colors**: Always add new colors to `theme.mjs` instead of hardcoding color values. If a needed color doesn't exist, add it to both light and dark themes before using it in components.

## Tasks
[x] Refactor v3 gallery preview component to use Goober
1. Update `public/v3/js/app-ui/gallery-preview.mjs` to use Goober styling
2. Create styled components for gallery-item, gallery-item-image, gallery-item-info, gallery-item-text-content, gallery-item-name, gallery-item-date, gallery-item-checkbox-container, and gallery-audio-button
3. Replace CSS class dependencies with styled components
4. Remove all inline styles
5. Use theme values for colors, spacing, and transitions
6. Maintain hover effects, disabled states, and audio button functionality

[x] Isolate and debug WorkflowSelector
1. Comment out everything except WorkflowSelector in App.mjs
2. Verify page loads

[x] Restore and verify GenerationForm
1. Uncomment GenerationForm in App.mjs
2. Verify workflow selection updates form


[x] Rebuild v2 main page skeleton
1. Start with a blank page. As components are being refactored, port over the UI section from v1 of the page over to v2 to show the newly refactored component.

[x] Refactor GenerationForm app component to Goober
1. Update `public/v2/js/app-ui/generation-form.mjs` to use Goober styling
2. Replace all inline flexbox styles with styled components
3. Remove CSS class dependencies (generation-form, form-row)
4. Use theme values for all spacing (gap, padding)
5. Port component to v2 main page. use placeholders for sections where the components are not yet refactored.

[x] Refactor GeneratedResult app component to Goober
1. Update `public/v2/js/app-ui/generated-result.mjs` to use Goober styling
2. Replace inline styles with styled components
3. Migrate hardcoded colors (#28a745, #dc3545) to theme colors (success, danger)
4. Remove CSS class dependencies (generated-image-display, etc.)
5. Port component to v2 main page

[x] Refactor SeedControl app component to Goober
1. Update `public/v2/js/app-ui/seed-control.mjs` to use Goober styling
2. Replace inline margin styles with styled components
3. Add refactored component to v2 main page

[x] Refactor ExtraInputsRenderer app component to Goober
1. Update `public/v2/js/app-ui/extra-inputs-renderer.mjs` to use Goober styling
2. Replace inline margin styles with styled components
3. Add refactored component to v2 main page

[x] Refactor WorkflowSelector app component to Goober
1. Update `public/v2/js/app-ui/workflow-selector.mjs` to use Goober styling
2. Remove CSS class dependency (workflow-selector-container)
3. Add refactored component to v2 main page

[x] Refactor v2 main page (app.mjs)
> NOTE: all supporting files (autocomplete-setup, gallery-preview, global-audio-player, sse-manager, and tags had been moved to the `app-ui` folder)
1. Rebuild `public/v2/index.html` and `public/v2/js/app.mjs` using the existing version (from `public/index.html` and `public/js/app.mjs`) as reference
2. Reference existing v1 css files and use Goober to build v2 of the main page. Do not create css files for v2.
3. Once all components are refactored, uncomment and integrate GenerationForm into the page
4. Copy util.mjs from public/js to public/v2/js
5. Add textarea-caret-position-wrapper script to v2/index.html
6. Fix import paths in gallery.mjs, folder-select.mjs, gallery-preview.mjs, workflow-selector.mjs, tags.mjs, and inpaint-page.mjs to use correct v2 paths

[x] Debug insertBefore issue - Restore GeneratedResult
1. Restore GeneratedResult section from app-backup.mjs (lines 895-925)
2. Test clicking Gallery button, Delete button, and changing Workflow
3. If no error appears, mark as complete

[x] Restore progress banner and hidden file input from backup
1. Restore AppHeader section from app-backup.mjs (lines 844-864)
2. Restore HistoryContainer section from app-backup.mjs (lines 927-937)
3. Restore ProgressBanner components from app-backup.mjs (lines 940-958)
4. Restore Gallery component from app-backup.mjs (lines 960-980)
5. Restore HiddenFileInput component from app-backup.mjs (lines 982-987)

[x] Fix v3 gallery focus error preventing gallery from displaying
1. Investigate TypeError at gallery.mjs:687 - `input.focus is not a function`
2. Replace callback ref pattern with useRef hook for SearchInput
3. Call focus() on the ref.current element when shouldFocusSearch is true
4. Verify gallery displays correctly and search input can be focused
5. Fix ref access for Goober styled components using .base property
6. Replace all ActionButton styled components with Button from custom-ui

[x] Fix v3 folder selection - Unsorted folder should be selectable
1. Review how Unsorted folder (uid === '') was handled in old folder-select.mjs
2. Add new `unselectable` property to list-select for items that cannot be selected
3. Update list-select to check `unselectable` instead of `disabled` for selection prevention
4. Keep `disabled: folder.uid === ''` for Unsorted to disable edit/delete buttons
5. Add guards in onEdit and onDelete handlers to prevent editing/deleting Unsorted folder
6. Test that Unsorted folder can be selected but not edited or deleted

[x] Refactor InpaintForm app component to Goober
1. Update `public/v3/js/app-ui/inpaint-form.mjs` to use Goober styling
2. Replace inline flexbox styles with styled components
3. Remove CSS class dependencies (inpaint-form, form-row)

[x] Refactor InpaintCanvas app component to Goober
1. Update `public/v3/js/app-ui/inpaint-canvas.mjs` to use Goober styling
2. Replace inline styles with styled components
3. Remove CSS class dependencies (inpaint-canvas-container, inpaint-loading, etc.)

[x] Refactor inpaint-page.mjs to Goober
1. Update `public/v3/js/inpaint-page.mjs` to use Goober styling
2. Ensure all styling uses theme values
3. Replace any inline styles or CSS class dependencies

[x] Create v3 inpaint.html page
1. Create `public/v3/inpaint.html` using v3/index.html and public/inpaint.html as guides
2. Use v3 structure with Goober imports (goober, goober/prefixer)
3. Point to v3/js/inpaint-page.mjs entry point
4. Update textarea-caret-position-wrapper path to v3

[x] Update v3 inpaint-page.mjs to use new v3 component structure
1. Fix import paths: toast.mjs → msg/toast.mjs
2. Fix import paths: progress-banner.mjs → msg/progress-banner.mjs
3. Replace ImageCarousel with useItemNavigation hook + NavigatorControl
4. Fix import paths: sse-manager.mjs → app-ui/sse-manager.mjs
5. Fix import paths: autocomplete-setup.mjs → app-ui/autocomplete-setup.mjs
6. Fix import paths: tags.mjs → app-ui/tags.mjs
7. Update styled import from goober-setup.mjs to use 'goober' directly
8. Wrap InpaintApp in Page component to initialize goober
9. Fix canvas ref access in InpaintCanvas to use .base property for goober styled components

[x] Remove inline styles from all components
1. Audit all V3 custom-ui components for remaining inline `style=` attributes
2. Audit all V3 app-ui components for remaining inline `style=` attributes
3. Replace with goober styled components or `css` template literals
4. Verify all styling is handled by Goober

[x] Remove deprecated component files
1. Remove all V3 imports for `public/v3/js/custom-ui/tags.mjs` - replaced by button-group.mjs
2. Remove all V3 imports for `public/v3/js/custom-ui/image-carousel.mjs` - replaced by item-navigator.mjs
3. Remove all V3 imports for `public/v3/js/custom-ui/folder-select.mjs` - moved to app-ui
4. Remove all V3 imports for `public/v3/js/custom-ui/gallery.mjs` - moved to app-ui
5. Verify no imports remain in the V3 codebase for these files
6. Update any remaining V3 references to use the new components
