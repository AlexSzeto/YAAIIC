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

- [x] Rename all new PascalCase files to lowercase-with-dashes: `WorkflowEditor.mjs` → `workflow-editor.mjs`, `NodeInputSelector.mjs` → `node-input-selector.mjs`, `ConditionBuilder.mjs` → `condition-builder.mjs`, `TaskForm.mjs` → `task-form.mjs`, `DynamicList.mjs` → `dynamic-list.mjs`, `HamburgerMenu.mjs` → `hamburger-menu.mjs` (both custom-ui and old app-ui). Update all imports.
- [x] Add `small-icon-text` to Button variants (JSDoc + `isIconOnly` guard). Add a `title` prop to `dynamic-list.mjs`: render a header row with the title on the left and the add button (`small-icon-text`) on the right; remove the standalone `AddRow` below items.
- [x] Replace all custom styled `input`/`select`/`textarea`/`checkbox` elements in `workflow-editor.mjs`, `condition-builder.mjs`, and `task-form.mjs` with the `Input`, `Select`, `Textarea`, `Checkbox` components from `custom-ui/io/`.
- [x] Split hamburger menu: rename `custom-ui/nav/hamburger-menu.mjs` to export only a generic `NavPanel` (dropdown + nav items, no trigger button, accepts `items`, `open`, `onClose`, `theme`). Create `app-ui/hamburger-menu.mjs` that wires the `Button` trigger + `NavPanel` with the project-specific items.
- [x] Fix icon mapping: change `chevron-down` → `keyboard_arrow_down` and `chevron-up` → `keyboard_arrow_up` in `custom-ui/layout/icon.mjs`.
- [x] Update `app-ui/hamburger-menu.mjs` nav items to: Home (href=`/`), Workflow Editor (href=`/workflow-editor.html`), Change Theme (calls `toggleTheme`, icon reflects next theme: `moon` when light, `sun` when dark). Remove theme toggle and Home buttons from `app.mjs` and `inpaint.mjs` headers.
- [x] Remove `text-decoration` from the `&:hover` state of the `NavItem` styled component in `custom-ui/nav/hamburger-menu.mjs`.
- [x] Reorder panels in `workflow-editor.mjs`: Basic Info → Extra Inputs → Pre-generation Tasks → Replace Mappings → Post-generation Tasks.
- [x] Disable the AND/OR toggle button in `condition-builder.mjs` when `conditions.length === 0`.
- [x] Rewrite `node-input-selector.mjs` as two side-by-side `Select` dropdowns: left lists all nodes (label = title, value = nodeId), right lists the input fields of the selected node (appears only after a node is chosen). On selecting a right item, call `onChange([nodeId, 'inputs', inputName])`.

## Implementation Details

### NavPanel props
```js
NavPanel({ items, open, anchorRight, theme })
// items: Array<{ label, href?, onClick?, icon, active? }>
// open: boolean
// anchorRight: boolean (position absolute right:0)
```

### Button small-icon-text variant
The existing Button sizing logic already handles any `small-*` variant correctly.
Only the JSDoc and `isIconOnly` check need to be updated to acknowledge `small-icon-text`.
