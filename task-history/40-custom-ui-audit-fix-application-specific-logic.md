# Custom-UI Audit: Fix Application-Specific Logic

## Tasks

[x] Move ComfyUI step names to app-ui
1. Create `public/js/app-ui/comfyui-step-names.mjs` with `NODE_STEP_NAMES` and `getStepName()`
2. Update `progress-banner.mjs` to accept `getStepName` as a prop instead of importing
3. Update `progress-context.mjs` to pass through `getStepName` prop
4. Update `app.mjs` and `inpaint.mjs` to import and pass `getStepName`
5. Remove `NODE_STEP_NAMES` and `getStepName()` from `util.mjs`

[x] Fix hardcoded defaults
1. Change `PageTitleManager` default in `util.mjs` from `'YAAIIG'` to `''`
2. Change `showDialog` default title in `dialog.mjs` from `'Generate Image'` to `'Dialog'`
