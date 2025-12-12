# Bugs / Fixes

- Update the video length frame number so it must fit in the formula (X * 4) + 1
- Unify gallery behavior so new generations are always added to the start and gallery resets to viewing the first item
- Refactor all custom-ui into preact components

# Features
- Rename generated image
- Image tagging
- Auto download models from Hugging Face
- Use freezeframe.js to freeze animations in gallery preview
- Export to destination (customizable)
