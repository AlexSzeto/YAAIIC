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

