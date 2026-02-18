# Client-Side Refactoring Plan

## Overview
The goal is to transition from a hybrid Vanilla JS/Preact app to a pure Preact architecture. To ensure the application remains stable and verifiable throughout the process, we will adopt a **Parallel Implementation Strategy**. We will build the new application alongside the existing one using new entry points (`index-v2.html`, `inpaint-v2.html`).

## Architecture Decisions
- **State Management**: Use **`@preact/signals`** for shared application state (Workflow config, Form data, UI State). This reduces prop drilling and re-renders.
- **Styling**: Continue using `public/css/style.css` and `custom-ui.css`. Components should use standard CSS classes.
- **Components**: Functional components with Hooks.
- **Entry Points**:
    - `public/js/app.mjs`: Main SPA root.
    - `public/js/inpaint-page.mjs`: Inpaint SPA root.

## Implementation Details & Verification Plan

### Phase 1: Foundation (Generic UI)
**Goal**: Create a robust library of "dumb" controls.
- **Spec**: All form components (`input`, `select`, `checkbox`, `textarea`) must:
    - Accept `value` (controlled) and `onChange` (events).
    - Accept `label`, `error`, and `disabled` props.
    - Use standard CSS classes from `style.css`.
- **New Files**: `public/js/custom-ui/*.mjs` (button, input, select, textarea, checkbox, modal, toast, image-carousel).
- **Verification Task**:
    - Create `public/ui-test.html`.
    - Import and render *every* generic component in a showroom style.
    - **Check**: Visually verify styling and console log events on interaction.

### Phase 2: Main Page Core (Form & State)
**Goal**: Replicate the "Workflow Selection" and "Generation Parameters" logic in `index-v2.html`.
- **New Files**:
    - `public/js/app-ui/workflow-selector.mjs`: Validates logic for "locking" seeds, hiding/showing fields based on workflow.
    - `public/js/app-ui/generation-form.mjs`: Consumes `Workflow` signal, renders appropriate Inputs.
    - `public/js/app.mjs` (Root): Sets up Signals (`workflow`, `prompt`, `seed`, etc.).
    - `public/index-v2.html`: New mount point.
- **Verification Task**:
    - Open `index-v2.html`.
    - **Check**: Workflow dropdown populates from server.
    - **Check**: "Video" fields appear/disappear when switching between Image/Video workflows.
    - **Check**: Seed randomization works.

### Phase 3: Results & Execution
**Goal**: Implement the Generation loop and Result display.
- **New Files**:
    - `public/js/app-ui/generated-image-result.mjs`: pure Preact version of the old class.
    - Update `app.mjs`: Add `handleGenerate` function relying on `sse-manager.mjs`.
- **Verification Task**:
    - In `index-v2.html`, click Generate.
    - **Check**: Progress banner appears (using existing `progress-banner.mjs` refactored/wrapped).
    - **Check**: Result image displays upon completion.
    - **Check**: Metadata (workflow, seed) in the result view matches the request.

### Phase 4: Carousel & Gallery Integration
**Goal**: Connect the history and gallery to `v2`.
- **New Files**:
    - `public/js/custom-ui/image-carousel.mjs`: New component.
    - `public/js/custom-ui/gallery.mjs`: Refactor to be a standard component `<Gallery isOpen={...} />`.
- **Verification Task**:
    - **Check**: Carousel shows historical images in `index-v2.html`.
    - **Check**: Clicking "Gallery" button opens the modal.
    - **Check**: Selecting an image in Gallery brings it into the "Input Image" slot (if needed) or carousel.

### Phase 5: Inpaint Page Migration
**Goal**: Move Inpaint to V2.
- **New Files**:
    - `public/inpaint-v2.html`.
    - `public/js/inpaint-page.mjs`.
    - `public/js/app-ui/inpaint-canvas.mjs` (Refactored to accept Signals or controlled props for mask data).
- **Verification Task**:
    - Open `inpaint-v2.html?uid=123`.
    - **Check**: Image loads into canvas.
    - **Check**: Masking works.
    - **Check**: Inpaint generation works.

### Phase 6: Switchover & Cleanup
**Goal**: Replace V1 with V2.
- **Tasks**:
    - Rename `index.html` -> `index-legacy.html` / `index-v2.html` -> `index.html`.
    - Rename `inpaint.html` -> `inpaint-legacy.html` / `inpaint-v2.html` -> `inpaint.html`.
    - Delete legacy JS files (`main.mjs`, `generated-image-display.mjs`, etc.).
    - Delete `ui-test.html` and legacy htmls.
- **Final Verification**:
    - Run full manual regression test on the new `index.html` and `inpaint.html`.

## File Overview

| File Location | Type | Disposition | Details |
|---------------|------|-------------|---------|
| **`public/js/`** | | | |
| `app.mjs` | **New** | **Create** | V2 Root for Main Page. |
| `inpaint-page.mjs` | **New** | **Create** | V2 Root for Inpaint Page. |
| `autocomplete-setup.mjs` | Existing | **Refactor** | Convert to `useAutocomplete` hook. |
| `sse-manager.mjs` | Existing | **Keep** | |
| `tags.mjs` | Existing | **Keep** | |
| `textarea-caret-position-wrapper.mjs` | Existing | **Keep** | |
| `util.mjs` | Existing | **Keep** | |
| **`public/js/app-ui/`** | | | |
| `generated-image-result.mjs` | **New** | **Create** | Displays success result + metadata. |
| `generation-form.mjs` | **New** | **Create** | Orchestrates inputs based on Workflow. |
| `inpaint-canvas.mjs` | **Move** | **Refactor** | Move from root, ensure prop-based control. |
| `seed-control.mjs` | **New** | **Create** | Seed Input + Lock + Random. |
| `workflow-selector.mjs` | **New** | **Create** | Dropdown logic. |
| **`public/js/custom-ui/`** | | | |
| `button.mjs` | **New** | **Create** | |
| `checkbox.mjs` | **New** | **Create** | |
| `gallery.mjs` | Existing | **Refactor** | Convert to controlled `<Gallery />`. |
| `image-carousel.mjs` | **New** | **Create** | |
| `image-upload.mjs` | Existing | **Refactor** | Convert to controlled component. |
| `input.mjs` | **New** | **Create** | |
| `modal.mjs` | **New** | **Create** | Replacement for old dialog/modal logic. |
| `pagination.mjs` | Existing | **Keep** | |
| `progress-banner.mjs` | Existing | **Update** | Integrate into App hierarchy. |
| `select.mjs` | **New** | **Create** | |
| `textarea.mjs` | **New** | **Create** | |
| `toast.mjs` | Existing | **Refactor** | Signal/Context based. |
