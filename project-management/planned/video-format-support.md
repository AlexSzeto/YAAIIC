# Video Format Support

**Priority:** medium

## Goal

Add general video file support (mp4, webm, etc.) across the app so that video media items render in place of images in all existing viewers — the main page viewer, AnyTale editor, gallery, and any other image-display surface. A simple inline playback UI reuses elements from the existing audio player component.

## Notes

- Affected surfaces: main page viewer, AnyTale editor, gallery mode, and any other place that currently renders image media.
- Playback UI should be minimal — play/pause, scrubber — and reuse existing audio player UI elements where possible.
- Videos should be stored and indexed in the media database alongside images (same pipeline, different mime type).
- Open question: autoplay vs. manual play on load? Muted by default?
- Open question: thumbnail/poster frame extraction for gallery thumbnails?
