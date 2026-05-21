# Image Cropping Tool

## Goal

Add a cropping tool similar to inpaint: the user draws a crop region over an image, selects an output aspect ratio, and executing the crop produces a cropped image rather than triggering a generation. Optionally show a rule-of-thirds guide overlay to assist composition.

## Notes

- Execution action is a deterministic crop (no generation queue), unlike inpaint.
- UI should offer common ratio presets (1:1, 4:3, 16:9, 9:16, etc.).
- Rule-of-thirds guide is a toggle, displayed as an overlay on the crop canvas.
- Modeled after the inpaint UI but with a simplified menu (no generation params).
