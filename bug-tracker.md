# Bug Tracker: NotFoundError (insertBefore)

## Issue Description
**Error**: `Uncaught (in promise) NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`

**Trigger**: 
- Changing Workflow (specifically when `setWorkflow` is called)
- Clicking "Gallery" button
- Clicking "Delete" button (opens Modal)

## Findings Log

### 2026-01-29 - Analysis
- **Observation**: `Gallery` (div) and `Modal` (Portal) are conditionally rendered at the end of `AppContainer` (a styled flex container).
- **Hypothesis**: When `App` re-renders and these components toggle appearance (null <-> node), Preact attempts to insert them into `AppContainer`. If the DOM structure of `AppContainer` has shifted (e.g., due to `HiddenFileInput` `display: none` behavior or other children updating), Preact's reference node calculation might fail.
- **Specifics**: 
    - `Gallery.mjs` returns `null` or a `div` (using `position: fixed`). It does **NOT** use `createPortal`.
    - `Modal.mjs` returns `null` or a `Portal`.
    - `test.html` shows `Modal` used deep within the component tree, but in `App.mjs` it is a direct child of the main layout container.
    - They are siblings to `HiddenFileInput` inside `AppContainer`.
- **Workflow Change**: Changing workflow triggers `App` re-render. Since `GenerationForm` structure changes drastically (new inputs), this massive DOM update combined with `App`'s unstable child list (Gallery/Modal) is likely the root cause. `GenerationForm` also lacks keys on static siblings.

## Proposed Strategy
1.  **Refactor `App.mjs`**: Move `Gallery`, `Modal`, `HiddenFileInput`, and `ProgressBanner` *outside* of `AppContainer`. They should be direct children of the fragment returned by `App`. `AppContainer` should only contain the visible layout structure (Header, Form, Results).
2.  **Stabilize `GenerationForm`**: Add explicit `key` props to static sections (e.g., the Prompt Textarea) to prevent them being confused with dynamic Extra Inputs during reconciliation.
