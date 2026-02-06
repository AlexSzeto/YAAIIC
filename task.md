# Post Goober Refactor Cleanup
## Goals
Implement fixes and small changes after the Goober Refactor, adding more workflows, cleaning up unnecessary config parameters, etc.
## Implementation Details
## Tasks

[x] Replace `replaceBlankFieldOnly` with conditional objects
1. Update all uses of `replaceBlankFieldOnly` in `comfyui-workflows.json` to use conditional objects that check if the field is an empty string
2. Update the `checkExecutionCondition` function in `server/util.mjs` to treat `undefined`, `null`, and whitespace-only strings as blank strings when comparing with `""`
3. Update the `modifyDataWithPrompt` function in `server/llm.mjs` to remove the `replaceBlankFieldOnly` parameter handling
4. Test the changes with various workflows to ensure blank field detection works correctly

[x] Implement "and" condition variant and update workflow schema
1. Add "and" condition support to `checkExecutionCondition` in `server/util.mjs` (same array format as "or" conditions)
2. Update `comfyui-workflows.schema.json` to add proper condition definitions with support for simple, "or", and "and" conditions
3. Remove the unused `replaceBlankFieldOnly` property from the schema

[x] Fix regenerate endpoint data mismatch between server and client
1. Update the `/regenerate` endpoint completion message to send `mediaData` instead of `imageData` to match client expectations ✓
2. Verify that the client's `handleRegenerateComplete` function properly updates the generated image display and history ✓

[x] Fix unsorted folder not showing selected highlight in folder select UI
1. Update ListSelectModal constructor in `list-select.mjs` to properly handle empty string as selectedId value (use nullish coalescing instead of logical OR) ✓
2. Test that unsorted folder (uid='') shows as selected when it is the current folder ✓

[x] Add Figtree font and update default typography
1. Add Figtree font links to `index.html` and `inpaint.html` ✓
2. Create new `figtreeTypographySubTheme` with Figtree font family ✓
3. Rename existing `typographySubTheme` to `arialTypographySubTheme` ✓
4. Update the themes to use Figtree as the default typography ✓

[x] Create theme-aware Icon component and replace Box-icons with Material Symbols support
1. Create Icon component at `/public/js/custom-ui/layout/icon.mjs` with theme-based conditional rendering, with the possibility of using either box-icons or material symbols depending on the theme.
> Note: developer's guide to material symbols are available at https://developers.google.com/fonts/docs/material_symbols
2. Add icon name mapping object to translate box-icon names to Material Symbol names
3. Update theme configuration in `/public/js/custom-ui/theme.mjs` to add `iconSystem` property
4. Add Material Symbols stylesheet to `/public/index.html` and `/public/inpaint.html`
5. Replace box-icon usage in Button component (`/public/js/custom-ui/io/button.mjs`)
6. Replace box-icon usage in Checkbox component (`/public/js/custom-ui/io/checkbox.mjs`)
7. Replace box-icon usage in Modal component (`/public/js/custom-ui/overlays/modal.mjs`)
8. Replace box-icon usage in ListSelect component (`/public/js/custom-ui/overlays/list-select.mjs`)
9. Replace box-icon usage in ProgressBanner component (`/public/js/custom-ui/msg/progress-banner.mjs`)
10. Replace box-icon usage in AudioSelect component (`/public/js/custom-ui/media/audio-select.mjs`)
11. Replace box-icon usage in ImageSelect component (`/public/js/custom-ui/media/image-select.mjs`)
12. Replace styled box-icon usage in Gallery component (`/public/js/app-ui/gallery.mjs`)
13. Verify all box-icon usages have been replaced and test icon rendering

