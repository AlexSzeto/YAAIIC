# Client-Side Refactoring Plan

## Overview
The goal of this refactor is to transition the client-side codebase from a hybrid approach (mixing vanilla JS DOM manipulation with isolated Preact components) to a fully React-like architecture using Preact. Each entry point (`index.html` and `inpaint.html`) will be treated as a Single Page Application (SPA) with a single root Preact component managing the entire page state.

This will improve maintainability, reduce bugs related to DOM state synchronization, and enable better code reuse.

## Scope
- **Root Files**: `public/index.html`, `public/inpaint.html` (cleaning up static HTML).
- **Entry Points**: `public/js/main.mjs`, `public/js/inpaint.mjs` (converting to root Preact components).
- **Existing Components**: Refactoring vanilla JS "Managers" into pure Preact components.
- **New Components**: Creating a library of generic UI elements and application-specific business logic components.

## Existing Components to Refactor

| Current Component / File | Status | Refactoring Plan |
|--------------------------|--------|------------------|
| `generated-image-display.mjs` | **Vanilla JS Class** | Convert to `generated-image-result.mjs` (Preact). Remove manual event listeners and direct DOM updates. Use props for data and callbacks for actions. |
| `carousel-setup.mjs` (`CarouselDisplay`) | **Vanilla JS Class** | Convert to `image-carousel.mjs` (Preact). Integrate directly into the parent component instead of passing DOM elements. |
| `gallery.mjs` (`GalleryDisplay`) | **Preact Class** | Component is already Preact, but usage is via `createGallery` wrapper. Remove wrapper and use `<GalleryDisplay />` directly in the new App component. |
| `image-upload.mjs` | **Preact Functional** | Good state. Ensure it accepts `value` and `onChange` props to be fully controlled by the parent form. |
| `inpaint.mjs` (`InpaintApp`) | **Preact Class** | Expand scope to include the entire page logic (form, validation) or wrap in a new `inpaint-page.mjs` component. |
| `pagination.mjs` | **Preact Functional** | Keep as is, ensure easy integration. |
| `progress-banner.mjs` | **Preact Functional** | Keep as is. |

## New Generic Components (`custom-ui`)
These components should be dumb, presentational components located in `public/js/custom-ui/`.

*   **`button.mjs`**: Standardize button styles (primary, secondary, icon-only) and loading states.
*   **`input.mjs`**: Wrapper for `<input>` with label, error message, and standard styling.
*   **`textarea.mjs`**: Wrapper for `<textarea>` (integrating `textarea-caret-position-wrapper` if needed).
*   **`select.mjs`**: Wrapper for `<select>` with label.
*   **`checkbox.mjs`**: Wrapper for toggle/checkbox inputs.
*   **`modal.mjs`**: A declarative Preact component for Modals (replacing the imperative `dialog.mjs` logic).
*   **`toast.mjs`**: A Toast context/provider to allow triggering toasts from anywhere via hooks.

## New App-Specific Components (`app-ui`)
These components contain business logic and are specific to this application. Locate in `public/js/app-ui/`.

*   **`workflow-selector.mjs`**: Handles fetching workflows, displaying the dropdown, and triggering parent updates.
*   **`generation-form.mjs`**: Encapsulates the entire form logic for the main page (Prompt, Negative Prompt, Seed, Dimensions, Batch Size). Manage state locally or via signals.
*   **`seed-control.mjs`**: Specialized component for the Seed input + Randomize button + Lock checkbox.
*   **`app.mjs`**: The root component for `index.html`. Manages global state (current image, history, active workflow) and layout.
*   **`inpaint-page.mjs`**: The root component for `inpaint.html`.

## Refactoring Steps

1.  **Preparation**:
    *   Create `public/js/app-ui` folder.
    *   Create `public/js/custom-ui` folder (if not clean).

2.  **Generic UI Library**:
    *   Build `button.mjs`, `input.mjs`, `select.mjs`, `modal.mjs` components first.

3.  **Component Conversion**:
    *   Convert `generated-image-display.mjs` -> `generated-image-result.mjs`.
    *   Convert `carousel-setup.mjs` -> `image-carousel.mjs`.

4.  **Root Migration (Iterative)**:
    *   **Phase 1 (Main Page)**: Create `app.mjs`. Move `loadWorkflows` and `handleGenerate` logic into it. Replace `index.html` body with `<div id="app"></div>`. Render `App`.
    *   **Phase 2 (Inpaint Page)**: Create `inpaint-page.mjs`. Move `handleInpaint` logic into it. Replace `inpaint.html` body.

5.  **Cleanup**:
    *   Remove unused files (`main.mjs` legacy code, old vanilla classes).
    *   Update `index.html` and `inpaint.html` imports.

## File Overview and Disposition

This section lists every file currently in `public/js` (and subdirectories) alongside the proposed new files, defining the complete target state of the `public/js` folder.

| File Location | Type | Disposition | Details |
|---------------|------|-------------|---------|
| **`public/js/`** | | | |
| `app.mjs` | **New** | **Create** | Root component for the main generation page. Replaces logic in `main.mjs`. |
| `autocomplete-setup.mjs` | Existing | **Refactor** | Logic moves to `useAutocomplete` or `input.mjs`. File will eventually be deleted. |
| `carousel-setup.mjs` | Existing | **Delete** | Replaced by `custom-ui/image-carousel.mjs`. |
| `gallery-preview.mjs` | Existing | **Delete** | Merged into `custom-ui/gallery.mjs`. |
| `generated-image-display.mjs` | Existing | **Delete** | Replaced by `app-ui/generated-image-result.mjs`. |
| `inpaint-canvas.mjs` | Existing | **Refactor** | Rename/move to `app-ui/inpaint-canvas.mjs`. |
| `inpaint-page.mjs` | **New** | **Create** | Root component for the inpaint page. Replaces logic in `inpaint.mjs`. |
| `inpaint.mjs` | Existing | **Replace** | Replaced by `inpaint-page.mjs`. Entry point logic moves here. |
| `main.mjs` | Existing | **Replace** | Replaced by `app.mjs`. Entry point logic moves here. |
| `sse-manager.mjs` | Existing | **Keep** | Standard utility. |
| `tags.mjs` | Existing | **Keep** | Standard utility. |
| `textarea-caret-position-wrapper.mjs` | Existing | **Keep** | Dependency for autocomplete. |
| `util.mjs` | Existing | **Keep** | Standard utility. |
| **`public/js/app-ui/`** | | | |
| `app-ui/generated-image-result.mjs` | **New** | **Create** | Replaces `generated-image-display.mjs`. |
| `app-ui/generation-form.mjs` | **New** | **Create** | Container for the main generation form inputs. |
| `app-ui/seed-control.mjs` | **New** | **Create** | Reusable seed input with randomize/lock. |
| `app-ui/workflow-selector.mjs` | **New** | **Create** | Workflow dropdown logic. |
| **`public/js/custom-ui/`** | | | |
| `custom-ui/button.mjs` | **New** | **Create** | Generic button component. |
| `custom-ui/checkbox.mjs` | **New** | **Create** | Generic checkbox component. |
| `custom-ui/dialog.mjs` | Existing | **Delete** | Replaced by `custom-ui/modal.mjs`. |
| `custom-ui/gallery.mjs` | Existing | **Update** | Refactor to stand-alone component. |
| `custom-ui/image-carousel.mjs` | **New** | **Create** | Replaces `carousel-setup.mjs`. |
| `custom-ui/image-upload.mjs` | Existing | **Update** | Refactor to controlled component. |
| `custom-ui/input.mjs` | **New** | **Create** | Generic input component. |
| `custom-ui/modal.mjs` | **New** | **Create** | Generic modal component (replaces `dialog.mjs` and old `modal.mjs`). |
| `custom-ui/pagination.mjs` | Existing | **Keep** | Generic pagination. |
| `custom-ui/progress-banner.mjs` | Existing | **Update** | Refactor to standard component usage. |
| `custom-ui/select.mjs` | **New** | **Create** | Generic select component. |
| `custom-ui/textarea.mjs` | **New** | **Create** | Generic textarea component. |
| `custom-ui/toast.mjs` | Existing | **Refactor** | Convert to Context-based Toast system. |
