# Goober Refactoring - Final Phase
## Goals
Complete the Goober migration by refactoring all remaining app-ui components, removing deprecated component files, eliminating all inline styles, and cleaning up legacy CSS files to ensure the entire application uses Goober styling exclusively.

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
[] Rebuild v2 main page skeleton
1. Start with a blank page. As components are being refactored, port over the UI section from v1 of the page over to v2 to show the newly refactored component.

[] Refactor GenerationForm app component to Goober
1. Update `public/v2/js/app-ui/generation-form.mjs` to use Goober styling
2. Replace all inline flexbox styles with styled components
3. Remove CSS class dependencies (generation-form, form-row)
4. Use theme values for all spacing (gap, padding)
5. Port component to v2 main page. use placeholders for sections where the components are not yet refactored.

[] Refactor GeneratedResult app component to Goober
1. Update `public/v2/js/app-ui/generated-result.mjs` to use Goober styling
2. Replace inline styles with styled components
3. Migrate hardcoded colors (#28a745, #dc3545) to theme colors (success, danger)
4. Remove CSS class dependencies (generated-image-display, etc.)
5. Port component to v2 main page

[] Refactor SeedControl app component to Goober
1. Update `public/v2/js/app-ui/seed-control.mjs` to use Goober styling
2. Replace inline margin styles with styled components
3. Port component to v2 main page

[] Refactor ExtraInputsRenderer app component to Goober
1. Update `public/v2/js/app-ui/extra-inputs-renderer.mjs` to use Goober styling
2. Replace inline margin styles with styled components
3. Port component to v2 main page

[] Refactor WorkflowSelector app component to Goober
1. Update `public/v2/js/app-ui/workflow-selector.mjs` to use Goober styling
2. Remove CSS class dependency (workflow-selector-container)
3. port component to v2 main page

[] Refactor v2 main page (app.mjs)
> NOTE: all supporting files (autocomplete-setup, gallery-preview, global-audio-player, sse-manager, and tags had been moved to the `app-ui` folder)
1. Rebuild `public/v2/index.html` and `public/v2/js/app.mjs` using the existing version as reference
2. Reference existing v1 css files and use Goober to build v2 of the main page. Do not create css files for v2.

[] Refactor InpaintForm app component to Goober
1. Update `public/v2/js/app-ui/inpaint-form.mjs` to use Goober styling
2. Replace inline flexbox styles with styled components
3. Remove CSS class dependencies (inpaint-form, form-row)

[] Refactor InpaintCanvas app component to Goober
1. Update `public/v2/js/app-ui/inpaint-canvas.mjs` to use Goober styling
2. Replace inline styles with styled components
3. Remove CSS class dependencies (inpaint-canvas-container, inpaint-loading, etc.)

[] Refactor inpaint-page.mjs to Goober
1. Update `public/v2/js/inpaint-page.mjs` to use Goober styling
2. Ensure all styling uses theme values
3. Replace any inline styles or CSS class dependencies

[] Remove inline styles from all components
1. Audit all custom-ui components for remaining inline `style=` attributes
2. Audit all app-ui components for remaining inline `style=` attributes
3. Replace with goober styled components or `css` template literals
4. Verify all styling is handled by Goober

[] Clean up CSS files and verify visual parity
1. Take before-screenshots of all UI pages/components
2. Audit `custom-ui.css` and remove all color/border/margin/padding properties that are now handled by Goober
   - Take after-screenshot after each block removal
   - Compare before-after to verify flexbox/grid layout remains intact
   - Keep any layout-only CSS (display, flex, grid, position, etc.)
3. Audit `variables.css` and remove color variables now managed by theme.mjs
   - Compare before-after screenshots
4. Leave `style.css` intact - it contains page layout and positioning CSS
5. Delete `custom-ui.css` only when empty or containing only comments
6. Delete `variables.css` only when all color variables have been migrated
7. Final verification: compare original before-screenshots with final state to ensure no visual regressions

[] Remove deprecated component files
1. Delete `public/v2/js/custom-ui/tags.mjs` - replaced by button-group.mjs
2. Delete `public/v2/js/custom-ui/image-carousel.mjs` - replaced by item-navigator.mjs
3. Delete `public/v2/js/custom-ui/folder-select.mjs` - moved to app-ui
4. Delete `public/v2/js/custom-ui/gallery.mjs` - moved to app-ui
5. Verify no imports remain in the codebase for these files
6. Update any remaining references to use the new components

