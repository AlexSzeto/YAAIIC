# Dress-Up Generation Mode

## Goal

Create a dedicated image generation page that replaces the free-text prompt with a structured clothing/outfit builder using danbooru-style tags organized by body part, layer, and wear state. The assembled outfit is compiled into a prompt string and submitted to the standard generation pipeline.

## Tasks

### Phase 1: Reusable TagInput Component
- [ ] Extract `autocomplete-setup.mjs` logic into a reusable `public/js/custom-ui/io/tag-input.mjs` component that accepts a target element/ref instead of hardcoding `#description`, can be instantiated multiple times on the same page, and exposes the same autocomplete and tag-insertion behaviour as the existing implementation
- [ ] Add a usage example for `TagInput` in `public/js/custom-ui/test.html`
- [ ] Verify the existing main app page (`index.html`) and inpaint page still work correctly after the refactor — manually test that typing in the description field still shows tag autocomplete suggestions

### Phase 2: Page Scaffolding
- [ ] Create `public/dress-up.html` using the standard page shell (mirroring `index.html` structure: loading screen, theme setup, same lib/script imports)
- [ ] Create entry point `public/js/dress-up.mjs` that initialises the theme, mounts the root Preact component, and loads tag data
- [ ] Register the page in `public/js/app-ui/hamburger-menu.mjs` as "Dress Up"
- [ ] Verify the page loads without errors and appears in the hamburger menu

### Phase 3: Page Layout
- [ ] Create `public/js/app-ui/dress-up/dress-up-page.mjs` — top-level page component with:
  - Top strip: `WorkflowSelector` filtered to Image-type workflows (`typeOptions: ["Image"]`)
  - Two-column main area: left = image viewer, right = generation parameters
  - Uses `Page`, `HorizontalLayout`, `VerticalLayout`, `Panel` from existing custom-ui components
- [ ] Verify the layout renders with correct column structure and workflow selector populates with Image workflows

### Phase 4: Image Viewer (Left Column)
- [ ] Create `public/js/app-ui/dress-up/dress-up-viewer.mjs` — image viewer panel that:
  - Displays the current image at full portrait resolution
  - Shows prev/next navigation buttons and a `{current}/{total}` counter (reuse `useItemNavigation` hook pattern from main app)
  - Newly generated images are prepended to the list (newest first)
  - Empty state when no images are loaded
  - Gallery selections populate the viewer
  - Accepts `items`, `currentIndex`, `onNavigate` props
- [ ] Integrate the `Gallery` component below the viewer (same as main app: toggle open/closed, view mode sets current image)
- [ ] Verify navigation arrows work, counter updates, and selecting a gallery item populates the viewer

### Phase 5: Clothing Item Data & Persistence
- [ ] Create `public/js/app-ui/dress-up/outfit-rules.json` — client-side JSON file containing AND-condition rules for derived outfit tags. Seed with the "underwear only" rule:
  ```json
  [
    {
      "tag": "underwear only",
      "conditions": [
        { "worn": false, "layer": "outer", "bodyPart": "upper" },
        { "worn": false, "layer": "outer", "bodyPart": "lower" },
        { "worn": true,  "layer": "inner", "bodyPart": "upper" },
        { "worn": true,  "layer": "inner", "bodyPart": "lower" }
      ]
    }
  ]
  ```
- [ ] Create `public/js/app-ui/dress-up/dress-up-state.mjs` — module managing clothing list state with `localStorage` persistence (key: `dressup-state`). Exports: `loadState()`, `saveState(state)`, `clearState()`. State shape:
  ```json
  {
    "additionalPrompts": "",
    "clothingItems": [
      {
        "id": "uuid",
        "name": "",
        "worn": true,
        "layer": "outer",
        "bodyPart": "upper",
        "attributes": [],
        "state": "",
        "relatedTags": ""
      }
    ]
  }
  ```

### Phase 6: Clothing Item Component
- [ ] Create `public/js/app-ui/dress-up/clothing-item.mjs` — single clothing item component with:
  - **Name** — text input; value used as search term for attribute/state autocomplete
  - **Worn** — checkbox; when unchecked, item is visually dimmed and excluded from prompt assembly
  - **Layer** — dropdown: `inner` / `outer`
  - **Body Part** — dropdown: `head` / `upper body` / `lower body` / `legs`
  - **State** — dropdown populated by querying `/tags` with `{name} {keyword}` for each state keyword (`lift`, `pull`, `unworn`, `removing`); these tags are excluded from the Attributes list
  - **Attributes** — autocomplete search using clothing name as search term against `/tags`; selected tags displayed as removable pill-buttons with X icon; clicking X removes the attribute
  - **Related Tags** — `TagInput` component with full autocomplete
  - Delete button to remove the item from the list
  - Calls `onChange(updatedItem)` and `onDelete(id)` props on any change
- [ ] Verify a clothing item can be added, all fields edited, attributes added/removed, and the item deleted

### Phase 7: Clothing List & Generation Parameters Panel
- [ ] Create `public/js/app-ui/dress-up/dress-up-form.mjs` — right-column panel containing:
  - **Additional Prompts** — `TagInput` with full autocomplete
  - **Clothing item list** — renders a `ClothingItem` for each entry in state
  - **Add Clothing Item** button — appends a new default item to the list
  - **Generate** button — disabled while generation is in progress; triggers prompt assembly then calls `POST /generate`
  - **Clear** button — resets clothing list and additional prompts to empty state, clears `localStorage`
  - Integrates `ProgressBanner` (same as main app, receives `taskId`)
  - All state changes trigger `saveState()` from `dress-up-state.mjs`
  - On mount, loads state from `localStorage` via `loadState()`
- [ ] Verify the full form renders, state persists across page reloads, and the Clear button resets everything

### Phase 8: Prompt Assembly
- [ ] Implement `assemblePrompt(clothingItems, additionalPrompts, outfitRules)` in `public/js/app-ui/dress-up/prompt-assembler.mjs`:
  1. Filter to worn items only
  2. For each worn item, collect: `attributes` (array), `state` (string, if set), `relatedTags` (string)
  3. Evaluate each rule in `outfit-rules.json`: a rule fires if every condition in its `conditions` array is satisfied. A condition `{ worn, layer, bodyPart }` is satisfied if there exists at least one clothing item where `item.worn === condition.worn && item.layer === condition.layer && item.bodyPart === condition.bodyPart`. Append the rule's `tag` for each rule that fires.
  4. Append `additionalPrompts`
  5. Return the assembled comma-separated tag string
- [ ] Wire `assemblePrompt` into the Generate button handler in `dress-up-form.mjs`
- [ ] Manual test: add a shirt (upper/inner/worn) and skirt (lower/inner/worn) with no outer layers — confirm the assembled prompt includes "underwear only"

### Phase 9: Generation Integration
- [ ] Wire the Generate button to `POST /generate` with `{ workflow: selectedWorkflow.name, description: assembledPrompt }` (all other fields use server defaults); handle response `taskId` to show `ProgressBanner`
- [ ] On generation complete (SSE completion event), fetch the result via `/media-data/{uid}`, prepend to the viewer's image list, and set it as the current image
- [ ] Verify end-to-end: select a workflow, add a clothing item, click Generate, observe progress banner, and see the generated image appear in the viewer

## Implementation Details

### File Structure
```
public/
  dress-up.html
  js/
    dress-up.mjs                          ← page entry point
    app-ui/
      dress-up/
        dress-up-page.mjs                 ← root page component
        dress-up-viewer.mjs               ← left-column image viewer
        dress-up-form.mjs                 ← right-column generation params
        clothing-item.mjs                 ← single clothing item UI
        dress-up-state.mjs                ← localStorage persistence
        prompt-assembler.mjs              ← prompt assembly logic
        outfit-rules.json                 ← AND-condition derived tags
    custom-ui/
      io/
        tag-input.mjs                     ← refactored reusable TagInput
```

### Prompt Assembly Rule Engine
A rule fires when ALL conditions are simultaneously satisfied by the current clothing list. Each condition checks: does there exist any clothing item with `worn === condition.worn AND layer === condition.layer AND bodyPart === condition.bodyPart`?

### State Keywords for State Dropdown
Query `/tags` with: `{name} lift`, `{name} pull`, `{name} unworn`, `{name} removing`. Any tag returned that matches `{name} {keyword}` pattern is treated as a state tag and excluded from the Attributes autocomplete list.

### Tag Autocomplete Reuse
`TagInput` wraps the `autoComplete.js`-based setup from `autocomplete-setup.mjs`. It must support multiple simultaneous instances. Each instance is scoped to its own textarea element (no shared global ID). The existing `#description` usage in `app.mjs` and `inpaint.mjs` must be migrated to use the new `TagInput` component.

### localStorage Key
`dressup-state` — stores the full state object (additionalPrompts + clothingItems array).

### Workflow Filtering
Pass `typeOptions={["Image"]}` to `WorkflowSelector`. No seed, orientation, name, or extraInputs fields are shown — all use server/workflow defaults.

### Generation API Call
```json
POST /generate
{
  "workflow": "workflow-name",
  "description": "assembled, prompt, string"
}
```
Response: `{ "taskId": "uuid" }` — passed to `ProgressBanner`.

