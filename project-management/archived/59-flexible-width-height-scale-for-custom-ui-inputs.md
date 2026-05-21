# Flexible Width/Height Scale for Custom UI Inputs

## Goal

Refactor the `fullWidth` boolean prop on Input, Select, and Textarea into a `widthScale` enum (`normal` | `compact` | `full`), and add a `heightScale` enum (`normal` | `compact`) to Input and Select. Shared helper functions in `util.mjs` keep the size logic DRY.

## Tasks

- [x] Add `getWidthScaleStyle(widthScale)` and `getHeightScaleStyle(heightScale)` helper functions to `public/js/custom-ui/util.mjs`
- [x] Refactor `public/js/custom-ui/io/input.mjs`: replace `fullWidth` with `widthScale='normal'` and add `heightScale='normal'`, using the new helpers
- [x] Refactor `public/js/custom-ui/io/select.mjs`: replace `fullWidth` with `widthScale='normal'` and add `heightScale='normal'`, using the new helpers
- [x] Refactor `public/js/custom-ui/io/textarea.mjs`: replace `fullWidth` with `widthScale='normal'` (no `heightScale`), using the new helper
- [x] Migrate all `fullWidth` call sites: `fullWidth={true}` / `fullWidth` / `fullWidth="true"` → `widthScale="full"`, and remove `fullWidth={false}` (covered by default)
- [x] Update `public/js/custom-ui/test.html` with examples for all `widthScale` and `heightScale` variants on Input and Select
