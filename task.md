# Goober Refactoring
## Goals
Refactor all existing custom UI components to use Goober for styling. Do the replacement component by component, utilizing a base light/dark theme futurproofed to be extendable for future themes. Tests would be performed after each refactoring on a test page showing all refactored components, with dynamic theme switching.
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