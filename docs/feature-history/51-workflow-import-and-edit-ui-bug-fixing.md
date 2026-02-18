# Workflow Import and Edit UI - Bug Fixing

## Goals
Fix design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws

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
