# Goober Refactoring
## Goals
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
## Tasks
[] Install Goober and configure for Preact integration
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

[] Create the base theme system at `public/js/custom-ui/theme.mjs`
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
```

[] Establish component documentation and property standards
1. All custom-ui components MUST accept a `layoutClass` prop for external CSS layout classes (flexbox/grid positioning)
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
 * @param {string} [props.layoutClass] - Optional CSS class for external layout/positioning
 * @param {string} [props.variant='default'] - Component variant
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {preact.ComponentChildren} [props.children] - Child content, rendered inside container
 * @returns {preact.VNode}
 * 
 * @example
 * <ComponentName layoutClass="flex-item" variant="primary">Content</ComponentName>
 */
```

[] Create the test page at `public/js/custom-ui/test.html`
1. Create HTML page with Preact/htm setup and goober imports
2. Add theme toggle using Button component (not a separate theme switcher component)
3. Create sections for each component being refactored
4. Import and render each component with various props/states

[] Create base Page component for global styles
1. Create `public/js/custom-ui/page.mjs`
2. Apply global styles: body font, background, text colors from theme
3. Include CSS reset/normalize as needed
4. Export as wrapper component for app root
5. Document all props with JSDoc (layoutClass, children)
```javascript
/**
 * Page - Root wrapper providing global theme styles
 * @param {Object} props
 * @param {string} [props.layoutClass] - Optional CSS class for layout
 * @param {preact.ComponentChildren} props.children - App content (required)
 */
export function Page({ layoutClass, children });
// Applies: font-family, background-color, color from theme
// Includes: CSS reset, scrollbar styling
```

[] Create Panel component
1. Create or refactor `public/js/custom-ui/panel.mjs`
2. Styled container with rounded corners, background, border from theme
3. Support variants: default, elevated (with shadow), outlined
4. Document all props with JSDoc (layoutClass, variant, children)
```javascript
/**
 * Panel - Container with rounded corners and themed background
 * @param {Object} props
 * @param {string} [props.layoutClass] - Optional CSS class for layout
 * @param {'default'|'elevated'|'outlined'} [props.variant='default'] - Panel style variant
 * @param {preact.ComponentChildren} [props.children] - Panel content
 */
export function Panel({ layoutClass, variant, children });
```

[] Refactor Button component to Goober
1. Remove CSS class-based styling from `button.mjs`
2. Create styled button using goober's `styled` function
3. Implement new variant system: medium-text, medium-icon, medium-icon-text, small-text, small-icon
4. Apply theme colors for primary, secondary, success, danger states
5. Include hover, focus, disabled states
6. Document all props with JSDoc (layoutClass, variant, color, loading, disabled, icon, children)
7. Update test page with all button variants
```javascript
/**
 * Button - Themed button with multiple variants and states
 * @param {Object} props
 * @param {string} [props.layoutClass] - Optional CSS class for layout
 * @param {'medium-text'|'medium-icon'|'medium-icon-text'|'small-text'|'small-icon'} [props.variant='medium-text'] - Size/content variant
 * @param {'primary'|'secondary'|'success'|'danger'} [props.color='primary'] - Color theme
 * @param {boolean} [props.loading=false] - Shows spinner, disables button
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.icon] - Box-icon name (e.g. 'play', 'trash')
 * @param {preact.ComponentChildren} [props.children] - Button text (for text variants)
 */
export function Button({ layoutClass, variant, color, loading, disabled, icon, children, ...props });
```

[] Refactor Input component to Goober
1. Update `public/js/custom-ui/input.mjs` to use goober styling
2. Apply theme colors for background, border, text, focus states
3. Include disabled and error states
4. Add `layoutClass` prop and document all props with JSDoc
5. Update test page with input examples

[] Refactor Select component to Goober
1. Update `public/js/custom-ui/select.mjs` to use goober styling
2. Match input styling for consistency
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with select examples

[] Refactor Textarea component to Goober
1. Update `public/js/custom-ui/textarea.mjs` to use goober styling
2. Match input styling for consistency
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with textarea examples

[] Refactor Checkbox component to Goober
1. Update `public/js/custom-ui/checkbox.mjs` to use goober styling
2. Apply theme colors for checked/unchecked states
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with checkbox examples

[] Refactor Tags component to Goober
1. Update `public/js/custom-ui/tags.mjs` to use goober styling
2. Apply theme colors for tag chips
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with tags examples

[] Refactor Pagination component to Goober
1. Update `public/js/custom-ui/pagination.mjs` to use goober styling
2. Style navigation buttons and page indicators with theme
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with pagination examples

[] Refactor ImageCarousel component to Goober
1. Update `public/js/custom-ui/image-carousel.mjs` to use goober styling
2. Style carousel container, navigation, and indicators
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with carousel examples

[] Refactor ListSelect component to Goober
1. Update `public/js/custom-ui/list-select.mjs` to use goober styling
2. Style list items, hover, and selected states
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with list-select examples

[] Refactor FolderSelect component to Goober
1. Update `public/js/custom-ui/folder-select.mjs` to use goober styling
2. Style folder tree, icons, and selection states
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with folder-select examples

[] Refactor ImageSelect component to Goober
1. Update `public/js/custom-ui/image-select.mjs` to use goober styling
2. Style image grid, preview, and selection
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with image-select examples

[] Refactor AudioSelect component to Goober
1. Update `public/js/custom-ui/audio-select.mjs` to use goober styling
2. Match image-select styling for consistency
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with audio-select examples

[] Refactor AudioPlayer component to Goober
1. Update `public/js/custom-ui/audio-player.mjs` to use goober styling
2. Style player controls, progress bar, volume
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with audio-player examples

[] Refactor ProgressBanner component to Goober
1. Update `public/js/custom-ui/progress-banner.mjs` to use goober styling
2. Style progress bar, text, and container
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with progress-banner examples

[] Refactor Gallery component to Goober
1. Update `public/js/custom-ui/gallery.mjs` to use goober styling
2. Style grid layout, item cards, overlays, and controls
3. Add `layoutClass` prop and document all props with JSDoc
4. Update test page with gallery examples

[] Refactor Toast component to Goober (global)
1. Update `public/js/custom-ui/toast.mjs` to use goober styling
2. Style toast container, animations, and variants (success, error, info, warning)
3. Ensure portal rendering works with goober styles
4. Add `layoutClass` prop and document all props with JSDoc
5. Update test page with toast trigger buttons

[] Refactor Dialog component to Goober (global)
1. Update `public/js/custom-ui/dialog.mjs` to use goober styling
2. Style overlay, dialog box, buttons, and text prompt variant
3. Ensure portal rendering works with goober styles
4. Add `layoutClass` prop and document all props with JSDoc
5. Update test page with dialog trigger buttons

[] Refactor Modal component to Goober (global)
1. Update `public/js/custom-ui/modal.mjs` to use goober styling
2. Style overlay, modal box, header, footer, and size variants
3. Handle image modal styling
4. Add `layoutClass` prop and document all props with JSDoc
5. Update test page with modal trigger buttons

[] Audit and refactor app to use only custom-ui components
1. Review `public/js/app.mjs` and `public/js/app-ui/` components
2. Replace any inline styles with styled components or custom-ui components
3. Create additional custom-ui components as needed for app-specific UI

[] Remove inline styles from custom-ui components
1. Audit each component for remaining inline `style=` attributes
2. Replace with goober styled components or `css` template literals
3. Verify all styling is handled by goober

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
