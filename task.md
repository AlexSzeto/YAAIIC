# Image to Video Cleanup

## Goal
Tweak the UI to prevent user errors, clarify UI intent, and improve usability

[] Disable inpainting for videos
- Disable the inpainting option when a workflow type is set to video
[] Disable input image (upload image) during generation
- Add a disabled state to the custom upload image component and disable it during image generation
[] filter videos (show image but grey out and make non-selectable) when gallery is in selection mode (add optional file type filter)
- Update the gallery preview component to grey out and make non-selectable when in selection mode
