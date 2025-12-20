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
    1. **Variants & CSS Mapping**:
       - `primary`: `.btn-with-icon .generate-button` (Blue, Standard).
       - `secondary`: `.btn-with-icon` (Gray/Default).
       - `success`: `.btn-with-icon .image-select-btn` (Green, e.g., "Use as Input").
       - `danger`: `.btn-with-icon .image-delete-btn` (Red, e.g., "Delete").
       - `icon`: `.info-btn` (Small 28px square, e.g., Copy/Paste icons).
       - `icon-nav`: `.carousel-btn` (Medium 36px square, e.g., Previous/Next).
    2. Specification:
       ```javascript
       export function Button({ 
         variant = 'primary', // 'primary' | 'secondary' | 'success' | 'danger' | 'icon' | 'icon-nav'
         loading = false,
         disabled = false,
         icon = null,         // box-icon name string
         onClick,
         children,
         title,               // Tooltip text
         ...props 
       }) { ... }
       ```
    3. Logic: 
       - If `loading` is true, disable button and replace icon (or content) with a spinner/loader.
       - Apply combined classes based on variant: e.g., `primary` -> `class="btn-with-icon generate-button"`.
       - For `icon` variants, ensure children (if any) are visually hidden or omitted if only an icon is desired.

[x] **Input Components (`input.mjs`, `textarea.mjs`, `select.mjs`)**
    1. **Input**: `function Input({ label, error, ...props })`. Renders `<label>` + `<input>` + error message.
    2. **Textarea**: `function Textarea({ label, error, ...props })`. Renders `<label>` + `<textarea>` + error message.
    3. **Select**: `function Select({ label, options = [], value, onChange, ...props })`. `options` is array of `{label, value}`.

[x] **Checkbox Component (`checkbox.mjs`)**
    *Custom Dark Theme Implementation to replace native browser style.*
    1. Specification:
       ```javascript
       export function Checkbox({ 
         label, 
         checked = false, 
         onChange, 
         disabled = false 
       }) { ... }
       ```
    2. **DOM Structure**:
       - Container Label (`display: flex`, `cursor: pointer`).
       - Hidden Native Input (`visually-hidden` but focusable).
       - Custom Visual Element (`div`):
         - Background: `var(--dark-background-tertiary)`.
         - Border: `var(--dark-border-primary)`.
         - Size: ~24px square (touch friendly).
         - Content: `<box-icon name='check'>` (only rendered/visible when checked).
       - Label Text (`span`).
    3. **State Styles**:
       - **Unchecked**: Dark gray background, light border.
       - **Checked**: `var(--primary-background)` border/bg? Or keep dark bg and use colored icon (Explore: Green/Primary check icon).
       - **Focus**: `box-shadow` matching other inputs.
    4. **Accessibility**: Ensure keyboard toggling (Spring/Space) works via the hidden input logic.

[x] **Modal Component (`modal.mjs`)**
    *Declarative replacement for `dialog.mjs`.*
    1. Specification:
       ```javascript
       export function Modal({ 
         isOpen, 
         onClose, 
         title, 
         size = 'medium', // 'small', 'medium', 'large', 'full'
         children,
         footer // optional VNode for buttons
       }) { ... }
       ```
    2. Logic: Render directly into the tree (or via Portal if preferred, but direct is fine for V2).
    3. Close on backdrop click (optional).

[x] **Refactor Toast (`toast.mjs`)**
    1. Create `ToastContext`.
    2. Create `ToastProvider` component that holds the state of active toasts.
    3. implementations:
       ```javascript
       export const ToastContext = createContext();
       export function ToastProvider({ children }) { ... }
       export function useToast() { return useContext(ToastContext); } 
       // returns { show(msg, type), success(msg), error(msg) }
       ```

[x] **Image Carousel (`image-carousel.mjs`)**
    1. Specification:
       ```javascript
       export function ImageCarousel({ 
         items = [], 
         selectedItem, 
         onSelect, // (item) => void
         onDelete, // (item) => void (optional)
         height = '150px' 
       }) { ... }
       ```
    2. Logic: Reuse `CarouselDisplay` logic but using state.
    3. Feature: Arrow keys navigation support (when focused/active).

[x] **VERIFICATION: Phase 1**
    1. [x] Create `public/ui-test.html`.
    2. [x] Create `public/js/ui-test-app.mjs`.
    3. [x] Render every component above in various states (loading, error, populated).
    4. [x] Confirm visually that styles match the existing app.

[x] **UI Style Unification**
    1. All interactive components (buttons, inputs) should have:
     - focus (clear white outline, see carousel button)
     - same disabled color (see carousel button)
     - same hover color (see carousel button)
    2. [x] Fix style mismatches (button borders, textarea scope).
    3. [x] Refine Checkbox & Carousel (checkbox states, carousel margin).
     
## Phase 2: Main Page Core (Form & State)

[x] **Workflow Selector (`app-ui/workflow-selector.mjs`)**
    1. Fetch logic: Call `/generate/workflows` on mount.
    2. State: Maintain list of workflows.
    3. UI: Render `Select` component.
    4. Specification:
       ```javascript
       export function WorkflowSelector({ 
         value, // selected workflow object
         onChange // (workflow) => void
       }) { ... }
       ```

[x] **Seed Control (`app-ui/seed-control.mjs`)**
    1. Specification:
       ```javascript
       export function SeedControl({ 
         seed, 
         setSeed, // function(newSeed)
         locked, 
         setLocked // function(bool)
       }) { ... }
       ```
    2. Logic: "Randomize" button calls parent callback; parent generates random seed.

[x] **Generation Form (`app-ui/generation-form.mjs`)**
    1. Component that orchestrates the inputs.
    2. Props: `state` (Signal or Object containing all form fields).
    3. Logic:
       - Show/Hide video controls based on workflow type.
       - Render `Name` (always visible), `Description` (Textarea).
       - Render video controls conditionally (Length, Frame Rate, Orientation).
       - Render `SeedControl`.

[x] **App Root (`app.mjs`)**
    1. Import `render` from Preact.
    2. Setup State using `useState`:
       ```javascript
       const [workflow, setWorkflow] = useState(null);
       const [formState, setFormState] = useState({
         name: '', description: '', seed: generateRandomSeed(),
         seedLocked: false, length: 25, framerate: 20, orientation: 'portrait'
       });
       ```
    3. Render `<ToastProvider><div class="app-container">...</div></ToastProvider>`.
    4. Compose: `<WorkflowSelector />`, `<GenerationForm />`.
    
[x] **VERIFICATION: Phase 2**
    1. Open `public/index-v2.html`.
    2. Check that Workflows load from server.
    3. Check that changing workflow shows/hides video controls.
    4. Check locking seed prevents randomization.

## Phase 3: Results & Execution

[ ] **Generated Result (`app-ui/generated-result.mjs`)**
    1. Replaces `generated-image-display.mjs`.
    2. Specification:
       ```javascript
       export function GeneratedResult({ 
         image, // { url, seed, prompt, metadata }
         onUseSeed,
         onUsePrompt,
         onDelete,
         onInpaint
       }) { ... }
       ```
    3. Logic: Show image `src`. Show metadata list below it. "Use" buttons copy data back to Form State.

[ ] **Progress Banner (`custom-ui/progress-banner.mjs`)**
    1. Update to be a standard component:
       ```javascript
       export function ProgressBanner({ 
         taskId, 
         onComplete, 
         onError 
       }) { ... }
       ```
    2. Remove the self-mounting logic (`createProgressBanner`).

[ ] **Generation Logic (`app.mjs`)**
    1. Implement `handleGenerate()`:
       - Validate inputs.
       - Call `fetchJson('/generate/image', ...)` (or video).
       - Set `taskId` state.
    2. Render `<ProgressBanner taskId={...} />` when generating.
    3. On Complete: Fetch new image data, set `currentImage` state.

[ ] **VERIFICATION: Phase 3**
    1. In `index-v2.html`, click "Generate".
    2. Verify progress bar appears and updates (SSE).
    3. Verify image appears on completion.
    4. Verify "Use Seed" updates the form seed.

## Phase 4: Carousel & Gallery

[ ] **Refactor Gallery (`custom-ui/gallery.mjs`)**
    1. Remove `createGallery` factory.
    2. Convert to `<Gallery isOpen={...} onSelect={...} onClose={...} />`.
    3. Maintain internal fetching/pagination logic (or hoist if preferred, but internal is fine for now).

[ ] **Refactor Image Upload (`custom-ui/image-upload.mjs`)**
    1. Convert to:
       ```javascript
       export function ImageUpload({ 
         label, 
         value, // uploaded image path/url
         onChange,
         onSelectFromGallery // trigger gallery modal
       }) { ... }
       ```

[ ] **Integrate into App**
    1. Add `history` state (array of images).
    2. Render `<ImageCarousel items={history} selected={currentImage} />`.
    3. Render `<Gallery />` (controlled by `isGalleryOpen` state).

[ ] **VERIFICATION: Phase 4**
    1. Check "Gallery" button opens the modal.
    2. Check selecting image from Gallery works (loads into main view or upload slot).
    3. Check Carousel shows previous generations (mock or real history).

## Phase 5: Inpaint Page Migration

[ ] **Inpaint Canvas (`app-ui/inpaint-canvas.mjs`)**
    1. Refactor existing `inpaint-canvas.mjs`.
    2. Props: `imageUrl`, `mask` (controlled), `onChangeMask`.
    3. Logic: Emit mask changes up to parent.

[ ] **Inpaint Form (`app-ui/inpaint-form.mjs`)**
    1. Reuse `GenerationForm` components or specialized inputs for Inpaint (Brush size, Strength).
    
[ ] **Inpaint Page Root (`inpaint-page.mjs`)**
    1. Similar setup to `app.mjs`.
    2. State: `sourceImage`, `mask`, `prompt`.
    3. Logic: Handle `/generate/inpaint`.

[ ] **VERIFICATION: Phase 5**
    1. Open `public/inpaint-v2.html?uid=...`.
    2. Verify image loads.
    3. Verify drawing mask works.
    4. Verify generation works.

## Phase 6: Switchover & Cleanup

[ ] **HTML Swap**
    1. Rename `public/index.html` -> `public/index-legacy.html`.
    2. Rename `public/index-v2.html` -> `public/index.html`.
    3. Rename `public/inpaint.html` -> `public/inpaint-legacy.html`.
    4. Rename `public/inpaint-v2.html` -> `public/inpaint.html`.

[ ] **File Cleanup**
    1. Delete `public/js/main.mjs`.
    2. Delete `public/js/inpaint.mjs`.
    3. Delete old UI Managers (`generated-image-display.mjs`, `carousel-setup.mjs`).
    4. Delete `public/ui-test.html`.
    5. Delete `public/js/ui-test-app.mjs`.

[ ] **Final Regression Test**
    1. Full walkthrough of "Text to Image".
    2. Full walkthrough of "Image to Video".
    3. Full walkthrough of "Inpaint".
    4. Verify Gallery search and selection.
