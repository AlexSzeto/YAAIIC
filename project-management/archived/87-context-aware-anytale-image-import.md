# Context-Aware AnyTale Image Import
## Goal
Rename the "Reprompt" action for AnyTale generated images to "Import", update its UI (icon and tooltips) alongside the delete button, add confirmation safeguards against data loss, and implement tab-specific import behaviors (e.g., populating parts/plot vs. overwriting character details).

## Tasks
- [x] Update UI: Rename "Reprompt" to "Import", change the import button's icon to something more appropriate, and add custom-ui tooltips to both the import and delete buttons (similar to the navigation UI).
- [x] Implement global confirmation logic: Before any import action executes, display a confirmation warning the user that their current data will be cleared and overwritten.
- [x] Implement Character tab import behavior: When confirmed, clear the current character data, replace the character name with the image name, and populate the character's parts data using the data from the image generation record.
- [x] Update Parts & Plot tab import behavior: Ensure the existing populate logic is executed only after the new confirmation prompt.

## Implementation Details
- Rename all references of "Reprompt" to "Import" in the generated images view.
- Update the import button icon to signify an "import" or "load" action.
- Use the custom-ui tooltip component for the import and delete buttons' hover text on the same row.
- Ensure the confirmation prompt triggers regardless of the active tab.
- When on the Character tab, the import logic must specifically map the image name to the character name and populate the parts list, completely clearing the existing data first.
- The Parts and Plot tab will retain their existing functionality but now gated behind the confirmation prompt.
