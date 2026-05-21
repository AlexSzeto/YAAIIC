# UI Consistency Polish

## Goal

Improve visual and interaction consistency across the app by formalizing reusable UI patterns: convert action lists to use a compact dynamic list component, refactor the collapse panel into a reusable component and remove ad-hoc usages, unify delete/clear/close iconography with distinct icons, and audit all hover interactions to migrate them to `TooltipProvider`.

## Notes

- Three related sub-tasks: page UI formalization, icon unification, and tooltip/mouseover migration.
- Slot preview currently has an unnecessary collapse panel wrapper that should be removed.
- All hover/title attributes in `public/js/` should be replaced with `TooltipProvider` calls.
