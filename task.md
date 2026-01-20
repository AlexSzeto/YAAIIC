# Goober Refactoring
## Goals
The ultimate intent of this refactoring is to separate the custom UI components into a reusable library that can be imported by future projects, allowing them to quickly establish a consistent look and feel without reimplementing the same component set.

Refactor all existing custom UI components to use Goober for styling. Do the replacement component by component, utilizing a base light/dark theme futureproofed to be extendable for future themes. Tests would be performed after each refactoring on a test page showing all refactored components, with dynamic theme switching.
## Implementation Details
- Install Goober
- Create the test page at js/custom-ui/test.html
- Create the base theme at js/custom-ui/theme.js
- Setup base case: Page custom component (covers base body font, background, etc.)
- Panel component (simple container of a rectangle with rounded corners)
- Button component adjustments: remove all implementation specific references (i.e. info-btn) and focus on features offered. The variants should be: (medium-text, medium-icon, medium-icon-text, small-text, small-icon)
- Repeat for all other components, saving global features like toast and modals for last.
- Refactor app to ONLY use custom-ui components, adding more custom components as needed.
- Completely remove all inline styles and CSS files, verifying that the page looks identical before and after sections of the CSS file are removed.

## Implementation Notes
- **Goober conditional styling**: When using conditionals in Goober's `styled` template literals, always use ternary operators with empty strings: `${condition ? \`styles\` : ''}`. Do NOT use `&&` operators like `${condition && \`styles\`}` as this outputs the string `"false"` into the CSS when the condition is falsy.

## Component Transition Guide
This section documents how to migrate existing app code from old component APIs to the new Goober-styled versions.

### Panel (NEW)
Panel is a new component. No migration needed - just start using it.
```javascript
// Usage
import { Panel } from './custom-ui/panel.mjs';
<Panel variant="default|elevated|outlined|glass">content</Panel>
```

### Button
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `variant="primary"` | `color="primary"` | Color is now separate from size |
| `variant="secondary"` | `color="secondary"` | Default color |
| `variant="success"` | `color="success"` | |
| `variant="danger"` | `color="danger"` | |
| `variant="icon"` | `variant="small-icon"` | Small square icon button (28x28) |
| `variant="icon-nav"` | `variant="medium-icon"` | Medium square icon button (44x44) |
| `variant="small-text"` | `variant="small-text"` | Same |
| `variant="primary-small-text"` | `variant="small-text" color="primary"` | Split into variant + color |
| (default with text) | `variant="medium-text"` | Default, explicit name |
| (with icon + text) | `variant="medium-icon-text"` | Explicit icon+text variant |

```javascript
// Old
<Button variant="primary" icon="play">Play</Button>
<Button variant="icon">X</Button>

// New
<Button variant="medium-icon-text" color="primary" icon="play">Play</Button>
<Button variant="small-icon" icon="x" color="secondary" />
```

### Input
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `className` | (removed) | Use styled wrapper if needed |
| All other props | Same | No changes needed |

```javascript
// Old
<Input label="Name" className="custom-class" />

// New  
<Input label="Name" />
// If custom styling needed, wrap in a styled container
```

### Select
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|---------|
| `className` | (removed) | Use styled wrapper if needed |
| All other props | Same | No changes needed |

```javascript
// Old
<Select label="Category" className="custom-class" options={options} />

// New  
<Select label="Category" options={options} />
// If custom styling needed, wrap in a styled container
```

### Textarea
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `className` | (removed) | Use styled wrapper if needed |
| `fullWidth=true` | `fullWidth=true` | Default is now true (unchanged) |
| All other props | Same | No changes needed |

```javascript
// Old
<Textarea label="Notes" className="custom-class" />

// New  
<Textarea label="Notes" />
// Additional props: rows (default 4)
```

### Checkbox
**Old API → New API:**
| Old Prop | New Prop | Notes |
|----------|----------|-------|
| `className` | (removed) | Use styled wrapper if needed |
| All other props | Same | No changes needed |

```javascript
// Old
<Checkbox label="Accept" className="custom-class" />

// New  
<Checkbox label="Accept" />
// Supports: labelPosition ('left' or 'right')
```

## Tasks
[x] Install Goober and configure for Preact integration
1. Install goober via npm (`npm install goober`)
2. Create `public/js/custom-ui/goober-setup.mjs` to configure goober with Preact's `h` function
```javascript
// goober-setup.mjs
import { h } from 'preact';
import { setup, styled, css, keyframes } from 'goober';

// Configure goober to use Preact
setup(h);

export { styled, css, keyframes };
```

[x] Create the base theme system at `public/js/custom-ui/theme.mjs`
1. Create spacing sub-theme with default values for small and medium component sizes:
   - padding (small, medium)
   - margin (small, medium)
   - border width
   - border-radius (small, medium)
2. Create light color theme with all color tokens from `variables.css`
3. Create dark color theme with all color tokens from `variables.css`
4. Merge spacing sub-theme with each color theme to produce final `light` and `dark` themes
5. Export a `currentTheme` reactive store for runtime switching
6. Export helper functions for accessing theme values
7. Document how non-custom-ui components can use theme values directly:
   - How to import and access current theme colors/spacing
   - How to subscribe to theme changes for dynamic re-styling
   - Example code patterns for partial theme adaptation
```javascript
// theme.mjs - Theme Structure
const spacingSubTheme = {
  spacing: {
    small: { padding: '4px 8px', margin: '4px', borderRadius: '4px' },
    medium: { padding: '8px 16px', margin: '8px', borderRadius: '8px' }
  },
  border: { width: '1px' }
};

const lightColors = { /* colors for light theme */ };
const darkColors = { /* colors for dark theme */ };

// Final merged themes
export const themes = {
  light: { ...spacingSubTheme, colors: lightColors },
  dark: { ...spacingSubTheme, colors: darkColors }
};

// Public API
export let currentTheme; // reactive store
export function setTheme(themeName);
export function getThemeValue(path);

// Partial adaptation example for non-custom-ui components:
// import { currentTheme, getThemeValue } from './theme.mjs';
// const color = getThemeValue('colors.primary.background');
// // Subscribe to theme changes for dynamic updates
```

[x] Establish component documentation and property standards
1. All styling (including positioning, flexbox, grid) MUST use Goober - no external CSS classes
2. Each component MUST include comprehensive JSDoc documentation specifying:
   - All props with types, whether required or optional, and default values
   - Whether the component accepts `children` and how they are rendered
   - Usage examples
3. Standard JSDoc format:
```javascript
/**
 * ComponentName - Brief description
 * 
 * @param {Object} props
 * @param {string} [props.variant='default'] - Component variant
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {preact.ComponentChildren} [props.children] - Child content, rendered inside container
 * @returns {preact.VNode}
 * 
 * @example
 * <ComponentName variant="primary">Content</ComponentName>
 */
```

[x] Create the test page at `public/js/custom-ui/test.html`
1. Create HTML page with Preact/htm setup and goober imports
2. Add theme toggle using Button component (not a separate theme switcher component)
3. Create sections for each component being refactored
4. Import and render each component with various props/states

[x] Create base Page component for global styles
1. Create `public/js/custom-ui/page.mjs`
2. Apply global styles: body font, background, text colors from theme
3. Include CSS reset/normalize as needed
4. Export as wrapper component for app root
5. Document all props with JSDoc
```javascript
/**
 * Page - Root wrapper providing global theme styles
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children - App content (required)
 */
export function Page({ children });
// Applies: font-family, background-color, color from theme
// Includes: CSS reset, scrollbar styling
```

[x] Create Panel component
1. Create or refactor `public/js/custom-ui/panel.mjs`
2. Styled container with rounded corners, background, border from theme
3. Support variants: default, elevated (with shadow), outlined
4. Document all props with JSDoc
```javascript
/**
 * Panel - Container with rounded corners and themed background
 * @param {Object} props
 * @param {'default'|'elevated'|'outlined'} [props.variant='default'] - Panel style variant
 * @param {preact.ComponentChildren} [props.children] - Panel content
 */
export function Panel({ variant, children });
```

[x] Refactor Button component to Goober
1. Remove CSS class-based styling from `button.mjs`
2. Create styled button using goober's `styled` function
3. Implement new variant system: medium-text, medium-icon, medium-icon-text, small-text, small-icon
4. Apply theme colors for primary, secondary, success, danger states
5. Include hover, focus, disabled states
6. Document all props with JSDoc
7. Update test page with all button variants
```javascript
/**
 * Button - Themed button with multiple variants and states
 * @param {Object} props
 * @param {'medium-text'|'medium-icon'|'medium-icon-text'|'small-text'|'small-icon'} [props.variant='medium-text'] - Size/content variant
 * @param {'primary'|'secondary'|'success'|'danger'} [props.color='primary'] - Color theme
 * @param {boolean} [props.loading=false] - Shows spinner, disables button
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.icon] - Box-icon name (e.g. 'play', 'trash')
 * @param {preact.ComponentChildren} [props.children] - Button text (for text variants)
 */
export function Button({ variant, color, loading, disabled, icon, children, ...props });
```

[x] Refactor Input component to Goober
1. Update `public/js/custom-ui/input.mjs` to use goober styling
2. Apply theme colors for background, border, text, focus states
3. Include disabled and error states
4. Document all props with JSDoc
5. Update test page with input examples

[x] Refactor Select component to Goober
1. Update `public/js/custom-ui/select.mjs` to use goober styling
2. Match input styling for consistency
3. Document all props with JSDoc
4. Update test page with select examples
5. Add transition notes to "Component Transition Guide" section above for select component

[x] Refactor Textarea component to Goober
5. Add transition notes to "Component Transition Guide" section above for select component
1. Update `public/js/custom-ui/textarea.mjs` to use goober styling
2. Match input styling for consistency
3. Document all props with JSDoc
4. Update test page with textarea examples
5. Add transition notes to "Component Transition Guide" section above

[x] Refactor Checkbox component to Goober
1. Update `public/js/custom-ui/checkbox.mjs` to use goober styling
2. Apply theme colors for checked/unchecked states
3. Document all props with JSDoc
4. Update test page with checkbox examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor Tags component to Goober
1. Update `public/js/custom-ui/tags.mjs` to use goober styling, renaming the component to `button-group.mjs`
2. Apply theme colors for tag chips
3. Document all props with JSDoc
4. Update test page with tags examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor Pagination component to Goober
1. Update `public/js/custom-ui/pagination.mjs` to use goober styling
2. Style navigation buttons and page indicators with theme
3. Document all props with JSDoc
4. Update test page with pagination examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor ImageCarousel component to Goober
1. Update `public/js/custom-ui/image-carousel.mjs` to use goober styling
2. Style carousel container, navigation, and indicators
3. Document all props with JSDoc
4. Update test page with carousel examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor ListSelect component to Goober
1. Update `public/js/custom-ui/list-select.mjs` to use goober styling
2. Style list items, hover, and selected states
3. Document all props with JSDoc
4. Update test page with list-select examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor FolderSelect component to Goober
1. Update `public/js/custom-ui/folder-select.mjs` to use goober styling
2. Style folder tree, icons, and selection states
3. Document all props with JSDoc
4. Update test page with folder-select examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor ImageSelect component to Goober
1. Update `public/js/custom-ui/image-select.mjs` to use goober styling
2. Style image grid, preview, and selection
3. Document all props with JSDoc
4. Update test page with image-select examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor AudioSelect component to Goober
1. Update `public/js/custom-ui/audio-select.mjs` to use goober styling
2. Match image-select styling for consistency
3. Document all props with JSDoc
4. Update test page with audio-select examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor AudioPlayer component to Goober
1. Update `public/js/custom-ui/audio-player.mjs` to use goober styling
2. Style player controls, progress bar, volume
3. Document all props with JSDoc
4. Update test page with audio-player examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor ProgressBanner component to Goober
1. Update `public/js/custom-ui/progress-banner.mjs` to use goober styling
2. Style progress bar, text, and container
3. Document all props with JSDoc
4. Update test page with progress-banner examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor Gallery component to Goober
1. Update `public/js/custom-ui/gallery.mjs` to use goober styling
2. Style grid layout, item cards, overlays, and controls
3. Document all props with JSDoc
4. Update test page with gallery examples
5. Add transition notes to "Component Transition Guide" section above

[] Refactor Toast component to Goober (global)
1. Update `public/js/custom-ui/toast.mjs` to use goober styling
2. Style toast container, animations, and variants (success, error, info, warning)
3. Ensure portal rendering works with goober styles
4. Document all props with JSDoc
5. Update test page with toast trigger buttons
6. Add transition notes to "Component Transition Guide" section above

[] Refactor Dialog component to Goober (global)
1. Update `public/js/custom-ui/dialog.mjs` to use goober styling
2. Style overlay, dialog box, buttons, and text prompt variant
3. Ensure portal rendering works with goober styles
4. Document all props with JSDoc
5. Update test page with dialog trigger buttons
6. Add transition notes to "Component Transition Guide" section above

[] Refactor Modal component to Goober (global)
1. Update `public/js/custom-ui/modal.mjs` to use goober styling
2. Style overlay, modal box, header, footer, and size variants
3. Handle image modal styling
4. Document all props with JSDoc
5. Update test page with modal trigger buttons
6. Add transition notes to "Component Transition Guide" section above

[] Refactor use-pagination hook to Goober
1. Update `public/js/custom-ui/use-pagination.mjs` for theme integration
2. Document all exported functions/hooks with JSDoc

[] Refactor GenerationForm app component to Goober
1. Update `public/js/app-ui/generation-form.mjs` to use Goober styling
2. Replace all inline flexbox styles with styled components
3. Remove CSS class dependencies (generation-form, form-row)
4. Use theme values for all spacing (gap, padding)

[] Refactor GeneratedResult app component to Goober
1. Update `public/js/app-ui/generated-result.mjs` to use Goober styling
2. Replace inline styles with styled components
3. Migrate hardcoded colors (#28a745, #dc3545) to theme colors (success, danger)
4. Remove CSS class dependencies (generated-image-display, etc.)

[] Refactor InpaintForm app component to Goober
1. Update `public/js/app-ui/inpaint-form.mjs` to use Goober styling
2. Replace inline flexbox styles with styled components
3. Remove CSS class dependencies (inpaint-form, form-row)

[] Refactor InpaintCanvas app component to Goober
1. Update `public/js/app-ui/inpaint-canvas.mjs` to use Goober styling
2. Replace inline styles with styled components
3. Remove CSS class dependencies (inpaint-canvas-container, inpaint-loading, etc.)

[] Refactor SeedControl app component to Goober
1. Update `public/js/app-ui/seed-control.mjs` to use Goober styling
2. Replace inline margin styles with styled components

[] Refactor ExtraInputsRenderer app component to Goober
1. Update `public/js/app-ui/extra-inputs-renderer.mjs` to use Goober styling
2. Replace inline margin styles with styled components

[] Refactor WorkflowSelector app component to Goober
1. Update `public/js/app-ui/workflow-selector.mjs` to use Goober styling
2. Remove CSS class dependency (workflow-selector-container)

[] Refactor inpaint-page.mjs to Goober
1. Update `public/js/inpaint-page.mjs` to use Goober styling
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

