# Client-Side Refactor: Pure Preact Architecture

## Preparation
[x] **Setup Directories & Indices**
    1. [x] Create `public/js/app-ui` directory.
    2. [x] Create `public/js/custom-ui` directory.
    3. [x] Create `public/index-v2.html` by copying `index.html`.
       - clear the `<body>` content (keep the structure but remove inner specific divs like `#workflow-controls`, `#generated-image-display`).
       - Add `<div id="app"></div>` as the single root.
       - Comment out old script imports (`main.mjs`, etc.) and add `<script type="module" src="/js/app.mjs"></script>`.
    4. [x] Create `public/inpaint-v2.html` by copying `inpaint.html`.
       - Clear body content, add `<div id="app"></div>`.
       - Update script import to `<script type="module" src="/js/inpaint-page.mjs"></script>`.

## Phase 1: Foundation (Generic UI Library)
*Build these as dumb, stateless components in `public/js/custom-ui/`.*

[x] **Button Component (`button.mjs`)**
[x] **Input Components (`input.mjs`, `textarea.mjs`, `select.mjs`)**
[x] **Checkbox Component (`checkbox.mjs`)**
[x] **Modal Component (`modal.mjs`)**
[x] **Refactor Toast (`toast.mjs`)**
[x] **Image Carousel (`image-carousel.mjs`)**
[x] **VERIFICATION: Phase 1**
[x] **UI Style Unification**
     
## Phase 2: Main Page Core (Form & State)

[x] **Workflow Selector (`app-ui/workflow-selector.mjs`)**
[x] **Seed Control (`app-ui/seed-control.mjs`)**
[x] **Generation Form (`app-ui/generation-form.mjs`)**
[x] **App Root (`app.mjs`)**
[x] **VERIFICATION: Phase 2**

## Phase 3: Results & Execution

[x] **Generated Result (`app-ui/generated-result.mjs`)**
[x] **Progress Banner (`custom-ui/progress-banner.mjs`)**
[x] **Generation Logic (`app.mjs`)**
[x] **VERIFICATION: Phase 3**

## Phase 4: Carousel & Gallery

[x] **Refactor Gallery (`custom-ui/gallery.mjs`)**
[x] **Refactor Image Upload (`custom-ui/image-upload.mjs`)**
[x] **Integrate into App**
[x] **Missing features and fixes** (30 items completed)
[x] **VERIFICATION: Phase 4**

## Phase 5: Inpaint Page Migration

[x] **Inpaint Canvas (`app-ui/inpaint-canvas.mjs`)**
[x] **Inpaint Form (`app-ui/inpaint-form.mjs`)**
[x] **Inpaint Page Root (`inpaint-page.mjs`)**
[x] **VERIFICATION: Phase 5** (partial - generation verification pending)

## Phase 6: Switchover & Cleanup

[x] **HTML Swap**
[x] **File Cleanup**
[x] **Final Regression Test**
