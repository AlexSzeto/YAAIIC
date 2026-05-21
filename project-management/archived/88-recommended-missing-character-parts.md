# Recommended Missing Character Parts
## Goal
Speed up character creation by displaying a dynamic list of recommended character parts on the AnyTale Character tab, helping users identify which essential parts are missing.

## Tasks
- [x] Ensure `recommendedCharacterPartTypes` configuration is available: Verify the frontend receives the new `recommendedCharacterPartTypes` property from the server configuration and make it accessible within the AnyTale `CharacterSection` component.
- [x] Implement dynamic filtering logic: Create a computed value in `CharacterSection` that determines the `missingRecommendedTypes`. Iterate over the `recommendedCharacterPartTypes` array and filter out any types that are already fulfilled by the character's current parts. (Note: A single character part can have multiple types and fulfill multiple recommendations simultaneously).
- [x] Render the recommended parts UI: Add a static text element between the "Add Part from Library" autocomplete input and the Character Parts DynamicList. It should display the text "**Recommended Missing Character Parts:**" followed by a comma-separated list of the missing types.
- [x] Implement empty state hiding: Ensure the entire recommended parts text section is hidden when all recommended types have been fulfilled by the character's parts.

## Implementation Details
- The component to modify is `public/js/app-ui/anytale/character-section.mjs`.
- The styling for the new text should exactly match the "Preview plot" display label in the same file (e.g., `<div style=${{ padding: currentTheme.value.spacing.small.padding, fontSize: currentTheme.value.typography.fontSize.small, color: currentTheme.value.colors.text.secondary }}>...</div>`).
- When checking if a part fulfills a type requirement, remember that `character.parts` only stores `partUid`. You will need to look up the part in the `libraryParts` array to find its assigned `type` array.
- Ensure the filtering logic is reactive, updating immediately as parts are added or removed from the character.
