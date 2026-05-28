# AnyTale Video Generation

**Priority:** low

## Goal

Extend AnyTale with video generation capabilities by adding keyframe and action-tag data to the plot schema, and introducing three video generation modes: keyframes-only, looping-for-all, and fully-animated. The fully-animated mode also changes how images are generated — foreground characters are rendered with a transparent background and composited onto a separately generated background image, enabling clean frame-to-frame transitions.

## Notes

- New plot data points: per-page keyframe flag; a list of action tags (filtered subset of image generation tags) used as the video prompt.
- Video generation modes:
  - **Keyframes only**: generate videos only for pages flagged as keyframes.
  - **Looping for all**: convert all page images into short looping videos.
  - **Fully animated**: all looping videos + transition videos between consecutive pages; requires foreground/background split on image generation.
- Fully animated mode needs a pipeline change: character rendered on transparent background, composited over a matching background image.
- Depends on general video format support being in place so generated videos can be displayed in the viewer.
- Open question: which video generation model/workflow is used (e.g. ComfyUI video node)?
- Open question: transition videos — what drives the motion between two keyframes?
