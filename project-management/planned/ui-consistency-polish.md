# UI Consistency Polish

**Priority:** low

## Goal

Improve visual and interaction consistency across the app by formalizing reusable UI patterns: convert action lists to use a compact dynamic list component, refactor the collapse panel into a reusable component and remove ad-hoc usages, unify delete/clear/close iconography with distinct icons, and audit all hover interactions to migrate them to `TooltipProvider`.

## Notes

- Three related sub-tasks: page UI formalization, icon unification, and tooltip/mouseover migration.
- Slot preview currently has an unnecessary collapse panel wrapper that should be removed.
- All hover/title attributes in `public/js/` should be replaced with `TooltipProvider` calls.
- Add a standardized generic list layout component: list items optionally rendered as buttons, with an optional right-edge action button group per row. Unify the following list-like sections/components under this layout (non-exhaustive): select folder, compact dynamic lists, search select, list select, queue modal, music playlist modal.
- Update the Select component to use a custom dropdown panel like MultiSelect (instead of native `<select>`), but fix the highlight coloring so the hover color doesn't visually blend with the checkbox outline color in the deselected state.
- Reorganize the workflow editor page: move the upload section out of its modal and into the main page layout.
- Use drag-and-drop UI for list rearrangement throughout the app.
