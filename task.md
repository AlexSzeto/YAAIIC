# Nested Workflows Feature Cleanup

## Goals
Clean up after tech debts introduced by the nested workflows feature

## Implementation Details

## Tasks
[x] Update workflows:
1. Move the remove background workflow to the bottom of the workflows list
2. Hide the `illustrious-text-to-image-no-background.json` based workflow.
3. remove all instances of `storePathAs` and replace it with direct references to the image/audio properties `image_X_filename` / `audio_X_filename`
4. Enable remove background options for all workflows based on `illustrious-text-to-image.json`, `flux-fantasy-text-to-portrait.json`, and `zimage-fantasy-portrait.json`.

[x] Delete `storePathAs` handling in source code, schema, and documentation

[x] Add the folder select button back to the Inpaint page in the same position as the main page, but set it as always disabled - it is only used to indicate the current folder name, and there's no need to build action logic for it.

[x] Failed workflows:
- AceStep 1.5
- HeartMula

[x] Untested workflows:
- Qwen Edit (Remove BG)
- Klein Edits (Remove BG)

[x] Update session history to remove entries deleted from gallery after a gallery delete