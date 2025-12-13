# Client-Side Refactor: Pure Preact Architecture

[ ] **Preparation**
    [ ] Create `public/js/app-ui` directory
    [ ] Create `public/js/custom-ui` directory (ensure it exists)
    [ ] Create dummy `public/index-v2.html` and `public/inpaint-v2.html` for parallel testing

[ ] **Phase 1: Foundation (Generic UI)**
    [ ] Create `public/js/custom-ui/button.mjs` (Primary, Secondary, Icon-only styles)
    [ ] Create `public/js/custom-ui/input.mjs` (Wrapped input with label/error)
    [ ] Create `public/js/custom-ui/textarea.mjs` (Wrapped textarea, support caret wrapper)
    [ ] Create `public/js/custom-ui/select.mjs` (Wrapped select with label)
    [ ] Create `public/js/custom-ui/checkbox.mjs` (Wrapped checkbox/toggle)
    [ ] Create `public/js/custom-ui/modal.mjs` (Declarative replacement for `dialog.mjs`)
    [ ] Refactor `public/js/custom-ui/toast.mjs` to be Context/Signal-based
    [ ] **VERIFICATION**: Create `public/ui-test.html`, render all components, and verify styles/events manually.

[ ] **Phase 2: Main Page Core (Form & State)**
    [ ] Create `public/js/app-ui/workflow-selector.mjs` (Dropdown + business logic)
    [ ] Create `public/js/app-ui/seed-control.mjs` (Input + Randomize + Lock)
    [ ] Create `public/js/app-ui/generation-form.mjs` (Main form container: Prompt, Params, Batch)
    [ ] Create `public/js/app.mjs` (V2 Root Component) - Initialize Signals
    [ ] **VERIFICATION**: Open `public/index-v2.html`. Verify Workflow dropdown loads. Verify Form logic (seeds, visibility).

[ ] **Phase 3: Results & Execution**
    [ ] Create `public/js/app-ui/generated-image-result.mjs` (Pure Preact display)
    [ ] Update `public/js/app.mjs`: Implement `handleGenerate` with `sse-manager.mjs`
    [ ] Update `public/js/custom-ui/progress-banner.mjs` to be component-friendly
    [ ] **VERIFICATION**: In `index-v2.html`, run a generation. Verify Progress Banner and Result Display.

[ ] **Phase 4: Carousel & Gallery Integration**
    [ ] Create `public/js/custom-ui/image-carousel.mjs`
    [ ] Update `public/js/custom-ui/gallery.mjs` (Controlled Component)
    [ ] Update `public/js/custom-ui/image-upload.mjs` (Controlled Component)
    [ ] Integrate into `public/js/app.mjs`
    [ ] **VERIFICATION**: In `index-v2.html`, verify History loading and Gallery interaction.

[ ] **Phase 5: Inpaint Page Migration**
    [ ] Move/Refactor `inpaint-canvas.mjs` -> `public/js/app-ui/inpaint-canvas.mjs`
    [ ] Create `public/js/inpaint-page.mjs` (V2 Root for Inpaint)
    [ ] **VERIFICATION**: Open `public/inpaint-v2.html`. Verify Canvas drawing and Inpaint generation.

[ ] **Phase 6: Switchover & Cleanup**
    [ ] Rename `public/index.html` -> `public/index-legacy.html`
    [ ] Rename `public/index-v2.html` -> `public/index.html`
    [ ] Rename `public/inpaint.html` -> `public/inpaint-legacy.html`
    [ ] Rename `public/inpaint-v2.html` -> `public/inpaint.html`
    [ ] Delete Legacy Files: `main.mjs`, `inpaint.mjs`, `generated-image-display.mjs`, `carousel-setup.mjs`, `gallery-preview.mjs`
    [ ] **VERIFICATION**: Full Regression Test of the new main pages.
