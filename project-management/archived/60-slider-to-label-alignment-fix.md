# Slider-to-Label Alignment Fix

## Goal

Fix the alignment between slider tracks and their labels in `range-slider.mjs` and `discrete-slider.mjs`. Currently, sliders use the full container width while labels are flush to left/right edges, causing misalignment. The fix gives each label a fixed width and adds horizontal margin to the slider so that label centers align with the corresponding slider positions.

## Tasks

- [x] **Add `LABEL_WIDTH` constant and update `RangeLabel` in `range-slider.mjs`**
  - Add `const LABEL_WIDTH = 40;` near the top of the styled components section.
  - Update the `RangeLabel` styled component to include `width: ${LABEL_WIDTH}px`, `text-align: center`, and `flex-shrink: 0`.
  - Update the `TrackContainer` styled component to add `margin: 0 ${LABEL_WIDTH / 2}px` so the slider track is inset by half the label width on each side.
  - **Manual test:** Open `public/js/custom-ui/test.html` in a browser. Verify that the range slider's min and max value labels are centered under their respective thumb endpoints.

- [x] **Add `LABEL_WIDTH` constant and update `OptionLabel` / `LabelsRow` in `discrete-slider.mjs`**
  - Add `const LABEL_WIDTH = 40;` near the top of the styled components section.
  - Update the `OptionLabel` styled component: replace `flex: 1` with `width: ${LABEL_WIDTH}px` and `flex-shrink: 0`. Remove the `&:first-child { text-align: left; }` and `&:last-child { text-align: right; }` overrides so all labels use `text-align: center` uniformly.
  - Update the `RangeWrapper` styled component to add `margin: 0 ${LABEL_WIDTH / 2}px` so the slider track is inset by half the label width on each side.
  - **Manual test:** Open `public/js/custom-ui/test.html` in a browser. Verify that every discrete option label is centered under its corresponding slider stop position, including the first and last labels.

- [x] **Visual cross-check of both components**
  - Open `public/js/custom-ui/test.html` and verify both range slider and discrete slider side by side.
  - Confirm that dragging each thumb to the extreme ends shows the label centers aligned with the thumb positions.
  - Confirm no horizontal overflow or clipping occurs at the container edges.
