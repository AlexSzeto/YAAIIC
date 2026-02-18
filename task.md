# Workflow Import and Edit UI - Bug Fixing

## Goals
Fix design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws
- I am seeing copious uses of new styled components when existing pre-styled custom UI components are available. The usage of components from custom-ui is a rule, not a guideline. buttons/checkboxes/inputs/selects/textareas MUST use those components unless explicitly stated otherwise. For small cosmetic changes, expand the variations available to the custom components, and then use them.
- All of the new files created are breaking naming conventions. source files should all be lowercase with dashes.
- The button that triggers the HamburgerMenu, and the configuration of the menu specific to this project, should be in app-ui. The reusable floating panel of buttons is the only section of code that should have been converted into a custom-ui component. For example, this panel can be reconfigured to act as a context menu.
- In the hamburger nav menu (which should be a custom-ui component), remove the text decoration from the hover state of the links.
- Reorganize the hamburger nav menu content to be the following: Home (returns to index.html), Workflow Editor (functions the same as it is currently), and Change Theme, with the icon of the Change Theme option reflecting the theme it would change to. Remove the Home and Theme buttons from the header of the index and inpaint page.
- the correct icon mapping for chevron_down (b0x) is keyboard_arrow_down (material), and chevron_up to keyboard_arrow_up.
- For the extra inputs "select" type subform, the options is an array of objects and therefore requires its
own dynamic list. Refer to the schema for the inputs required per item.
- The ordering of pre-generation tasks, replacements, and post-generation tasks is incorrect. It should be in the order I just listed (pre, replace, post).
- The Condition Logic AND/OR option should be disabled when there is zero conditions associated with the object. 
- NodeInputSelector needs a rewrite - it should be a pair of selects. The left select choose the root node, and the right select chooses the input inside that node.
- Dynamic lists with add buttons should place its add button to the right edge on the same row as the section title. For example, The Add Input button should be placed to the right of the title Extra Inputs. Reduce the the add button's size by one (if it's large, make it medium; if it's medium, make it small).

## Tasks


## Implementation Details

