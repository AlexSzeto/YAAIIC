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

- [ ] **Visual cross-check of both components**
  - Open `public/js/custom-ui/test.html` and verify both range slider and discrete slider side by side.
  - Confirm that dragging each thumb to the extreme ends shows the label centers aligned with the thumb positions.
  - Confirm no horizontal overflow or clipping occurs at the container edges.

## Implementation Details

### Layout Strategy

The core idea: each label is a fixed-width box (`40px`), and the slider track is inset by half that width on each side. This ensures that the center of each endpoint label aligns perfectly with the slider's min/max positions.

```
|<-- LABEL_WIDTH/2 -->|<------- slider track ------->|<-- LABEL_WIDTH/2 -->|
|<--- LABEL_WIDTH --->|                               |<--- LABEL_WIDTH --->|
|    "min label"      |                               |    "max label"      |
         ^-- center aligns with track start                  ^-- center aligns with track end
```

### `range-slider.mjs` Changes

**New constant (top of styled components section):**
```js
const LABEL_WIDTH = 40; // px — fixed width for endpoint labels
```

**`RangeLabel` — add fixed width and centering:**
```js
const RangeLabel = styled('span')`
  font-size: ${props => props.fontSize};
  color: ${props => props.color};
  width: ${LABEL_WIDTH}px;
  text-align: center;
  flex-shrink: 0;
`;
```

**`TrackContainer` — add horizontal margin:**
```js
const TrackContainer = styled('div')`
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;
  margin: 0 ${LABEL_WIDTH / 2}px;
  /* ... rest unchanged ... */
`;
```

### `discrete-slider.mjs` Changes

**New constant (top of styled components section):**
```js
const LABEL_WIDTH = 40; // px — fixed width for option labels
```

**`OptionLabel` — fixed width, centered, remove edge overrides:**
```js
const OptionLabel = styled('span')`
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
  color: ${props => props.color};
  cursor: pointer;
  user-select: none;
  transition: color ${props => props.transition};
  text-align: center;
  width: ${LABEL_WIDTH}px;
  flex-shrink: 0;
`;
```
Note: The `flex: 1`, `&:first-child { text-align: left; }`, and `&:last-child { text-align: right; }` rules are removed.

**`LabelsRow` — change from `space-between` to `space-between` (no change needed since the fixed label widths will naturally handle spacing).**

**`RangeWrapper` — add horizontal margin:**
```js
const RangeWrapper = styled('div')`
  height: 28px;
  display: flex;
  align-items: center;
  margin: 0 ${LABEL_WIDTH / 2}px;
`;
```
