# AnyTale Parts System

## Goal

Replace the AnyTale creation UI's rigid clothing items and prompt groups with a single, generic "Parts" system. Each part has a reusable config (template) and instance data, supporting category-based and custom tag attribute dropdowns, per-part preview generation, and an Edit/Play tab layout. This lays the groundwork for future server-side part library storage and retrieval.

## Tasks

- [x] **Task 1: Create the new state module (`anytale-state.mjs`)**
  Create `public/js/app-ui/anytale/anytale-state.mjs` with the new data model, localStorage persistence (`anytale-state` key), and factory functions. Delete `dress-up-state.mjs`. This task produces no visible UI but establishes the data foundation. Verify by importing the module in the browser console and calling `loadState()` / `saveState()` / `createDefaultPart()`.

- [x] **Task 2: Rewrite the prompt assembler for Parts**
  Update `prompt-assembler.mjs` to replace clothing-based assembly with Parts-based assembly. Implement two functions: `assemblePrompt(parts)` for the final image (baseline + attribute values from enabled parts, excluding previewBaseline) and `assemblePartPreviewPrompt(part)` for per-part preview (previewBaseline + baseline + attribute values from that single part). Remove outfit-rules evaluation and additionalPrompts handling. Delete `outfit-rules.json`. Verify by importing in the browser console and calling both functions with sample part data.

- [x] **Task 3: Extend DynamicList to support custom header actions**
  Add an optional `headerActions` prop to `DynamicList` and `DynamicListItem` in `dynamic-list.mjs`. Each action is `{ icon, title, onClick(item, index) }`. Render these buttons in the item header alongside existing controls (before drag/delete). Verify by temporarily adding a test `headerActions` entry to an existing DynamicList usage and confirming the button renders and fires its callback.

- [x] **Task 4: Create the Part item component (`part-item.mjs`)**
  Create `public/js/app-ui/anytale/part-item.mjs` — the inner form rendered inside each DynamicList item. Layout: two-column top row (128×128 preview image on left; Enabled checkbox + Name input stacked on right), then full-width fields below (Type, Preview Baseline Tags, Baseline Tags, Category Attributes nested condensed DynamicList, Custom Attributes nested condensed DynamicList). Wire all field changes through the `onChange` callback. For the preview image, display a placeholder when no URL is set, and show the stored `previewImageUrl` scaled to 128×128 when available. Clicking the preview opens `createImageModal` with the full URL. For now, the refresh/preview-generation button is wired but only logs to console — actual generation is wired in a later task. Verify by viewing the AnyTale page with a scaffolded parts list that uses this component.

- [x] **Task 5: Build category attribute value dropdown logic**
  Within `part-item.mjs`, implement the category attribute's value dropdown population. When the `category` field changes, look up the value in `categoryTree` (from `tag-data.mjs`). If found as a category key, populate the dropdown with its direct leaf children only (no recursive subcategories). If it resolves to an individual tag, show just that tag. Always include `(none)` (empty string) as the first option. Verify by adding a category attribute, typing a category name, and confirming the dropdown populates correctly.

- [x] **Task 6: Build the category attribute's autocomplete input**
  The category attribute's `category` field needs merged tag/category/subcategory autocomplete, same as the tag search modal. Use `getMergedAutocompleteData()` from `tag-data.mjs` and either reuse the autoComplete.js pattern from `TagInput` or build a simpler inline autocomplete. The selected item's `internal` name is stored as the `category` value. Verify by typing in the category field and seeing both tags and category suggestions appear.

- [x] **Task 7: Replace the right panel with TabPanels (Edit/Play)**
  Rename `dress-up-form.mjs` to `anytale-form.mjs`. Replace the outer `<Panel variant="outlined">` with `<TabPanels variant="outlined">` containing Edit and Play tabs. Move all existing form content into the Edit tab (no inner panel). The Play tab renders a `<div>` with "Coming Soon" text. Update `anytale.mjs` to import the renamed component. Update the import of state from `anytale-state.mjs`. Keep: Character Name input, Prompt Preview, Generate/Delete/Clear buttons. Replace both existing DynamicLists with a single Parts DynamicList using `part-item.mjs` as the render function. Wire the `headerActions` prop with a refresh icon button (preview generation placeholder for now). Verify by loading the AnyTale page and confirming both tabs render, the Edit tab shows the parts list with all fields, and the Play tab shows "Coming Soon."

- [x] **Task 8: Wire per-part preview generation**
  Implement the preview generation flow: clicking the refresh button in the part header calls `POST /generate/sync` with `workflow: 'Text to Image (Illustrious Portrait)'`, the assembled preview prompt (via `assemblePartPreviewPrompt`), a random seed, and `orientation: 'square'`. On success, store the returned `imageUrl` in `part.data.previewImageUrl`, persist to localStorage, and display the image in the 128×128 preview area. Show a loading indicator while the sync request is in-flight. Verify by adding a part with baseline tags, clicking refresh, and confirming a preview image appears.

- [x] **Task 9: Clean up removed files and dead references**
  Delete `clothing-item.mjs` and `outfit-rules.json`. Search for and remove any remaining imports or references to these files, `dress-up-form.mjs`, `dress-up-state.mjs`, `createDefaultItem`, `createDefaultPromptItem`, or `outfitRules` across the codebase. Verify by running the server and loading the AnyTale page with no console errors or 404s.

## Implementation Details

### Part Data Model

Each part stored in localStorage as:

```js
{
  id: 'part-' + Date.now(),
  config: {
    name: '',                    // String — identification label
    type: '',                    // String — comma-separated, data-storage only
    previewBaseline: '',         // String — comma-separated tags for preview only
    baseline: '',                // String — comma-separated tags always included
    categoryAttributes: [        // Array — nested condensed DynamicList items
      { name: '', category: '' }
    ],
    customAttributes: [          // Array — nested condensed DynamicList items
      { name: '', options: '' }
    ],
  },
  data: {
    enabled: true,               // Boolean — toggle visibility + prompt inclusion
    categoryAttributeValues: {}, // { [index]: 'selected_tag' }
    customAttributeValues: {},   // { [index]: 'selected_tag' }
    previewImageUrl: '',         // String — URL from /generate/sync result
  },
}
```

### localStorage Shape (`anytale-state`)

```js
{
  name: '',       // Character name (top-level, kept from current UI)
  parts: [],      // Array of Part objects (config + data)
}
```

### Prompt Assembly

**Final prompt** (`assemblePrompt(parts)`):
1. Filter to `part.data.enabled === true`
2. For each part: split `config.baseline` by comma → collect tags
3. For each part: collect all values from `data.categoryAttributeValues` and `data.customAttributeValues` (skip empty strings)
4. `config.previewBaseline` is **excluded**
5. Deduplicate (case-insensitive), join with `, `

**Preview prompt** (`assemblePartPreviewPrompt(part)`):
1. Split `config.previewBaseline` by comma → collect tags
2. Split `config.baseline` by comma → collect tags
3. Collect all values from `data.categoryAttributeValues` and `data.customAttributeValues` (skip empty strings)
4. Deduplicate, join with `, `

### Category Attribute Value Dropdown Population

```js
import { getCategoryTree } from '../tags/tag-data.mjs';

function getCategoryOptions(categoryInternal) {
  if (!categoryInternal) return [{ label: '(none)', value: '' }];
  const tree = getCategoryTree();
  const children = tree[categoryInternal];
  const options = [{ label: '(none)', value: '' }];
  if (Array.isArray(children)) {
    // Direct leaf children only — entries that are NOT keys in the tree
    for (const child of children) {
      if (!tree[child]) {
        const display = child.replace(/_/g, ' ');
        options.push({ label: display, value: child });
      }
    }
  } else {
    // Individual tag selected — offer it as the sole option
    const display = categoryInternal.replace(/_/g, ' ');
    options.push({ label: display, value: categoryInternal });
  }
  return options;
}
```

### Custom Attribute Value Dropdown Population

```js
function getCustomOptions(optionsString) {
  const options = [{ label: '(none)', value: '' }];
  if (!optionsString || !optionsString.trim()) return options;
  const tags = optionsString.split(',').map(t => t.trim()).filter(t => t);
  for (const tag of tags) {
    options.push({ label: tag, value: tag });
  }
  return options;
}
```

### Preview Generation Call

```js
const response = await fetch('/generate/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflow: 'Text to Image (illustrious Portrait)',
    name: part.config.name || 'preview',
    prompt: assemblePartPreviewPrompt(part),
    seed: Math.floor(Math.random() * 4294967295),
    orientation: 'square',
  }),
});
const result = await response.json();
// result.imageUrl contains the preview URL to store in part.data.previewImageUrl
```

### DynamicList `headerActions` Prop Extension

```js
// New prop shape:
// headerActions: Array<{ icon: string, title: string, onClick: (item, index) => void }>

// In DynamicListItem header rendering, before the drag/delete buttons:
${headerActions && headerActions.map(action => html`
  <${Button}
    variant="small-icon"
    icon=${action.icon}
    onClick=${(e) => { e.stopPropagation(); action.onClick(item, index); }}
    title=${action.title}
  />
`)}
```

### Part Item Layout (inside DynamicList body)

```
┌──────────────────────────────────────────────┐
│ ┌─────────┐  ☑ Enabled                      │  ← HorizontalLayout
│ │ 128×128 │  [Name ___________]              │     preview on left (flex: 0 0 128px)
│ │ preview │                                  │     enabled+name on right (flex: 1)
│ └─────────┘                                  │
│                                              │
│ [Type ________________]                      │  ← VerticalLayout, full width
│                                              │
│ Preview Baseline Tags                        │  ← TagInput (textarea + autocomplete)
│ [textarea with autocomplete]                 │
│                                              │
│ Baseline Tags                                │  ← TagInput
│ [textarea with autocomplete]                 │
│                                              │
│ Category Attributes                    [+]   │  ← DynamicList condensed
│ ┌ name | category autocomplete | value ▾ ┐   │     each item: Input + autocomplete + Select
│ └────────────────────────────────────────┘   │
│                                              │
│ Custom Attributes                      [+]   │  ← DynamicList condensed
│ ┌ name | options TagInput | value ▾      ┐   │     each item: Input + TagInput + Select
│ └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Files Changed Summary

| Action | File |
|--------|------|
| NEW | `public/js/app-ui/anytale/anytale-state.mjs` |
| NEW | `public/js/app-ui/anytale/part-item.mjs` |
| NEW | `public/js/app-ui/anytale/anytale-form.mjs` (renamed from `dress-up-form.mjs`) |
| MODIFY | `public/js/app-ui/anytale/prompt-assembler.mjs` |
| MODIFY | `public/js/app-ui/anytale/anytale.mjs` |
| MODIFY | `public/js/custom-ui/layout/dynamic-list.mjs` |
| DELETE | `public/js/app-ui/anytale/dress-up-form.mjs` |
| DELETE | `public/js/app-ui/anytale/dress-up-state.mjs` |
| DELETE | `public/js/app-ui/anytale/clothing-item.mjs` |
| DELETE | `public/js/app-ui/anytale/outfit-rules.json` |

### Key Existing APIs

- **`TagInput`** (`app-ui/tags/tag-input.mjs`): Textarea with autoComplete.js tag autocomplete. Props: `label`, `value`, `onInput(text)`, `placeholder`, `rows`, `disabled`.
- **`getMergedAutocompleteData()`** (`app-ui/tags/tag-data.mjs`): Returns `Array<{display, internal, isCategory}>` for tag/category autocomplete.
- **`getCategoryTree()`** (`app-ui/tags/tag-data.mjs`): Returns `{ [categoryKey]: string[] }` mapping categories to direct children.
- **`DynamicList`** (`custom-ui/layout/dynamic-list.mjs`): Props include `title`, `items`, `renderItem`, `getTitle`, `createItem`, `onChange`, `addLabel`, `condensed`, `showDragButton`, `showMoveUpDownButtons`.
- **`TabPanels`** (`custom-ui/nav/tab-panels.mjs`): Props: `tabs: [{id, label, content}]`, `activeTab`, `onTabChange`, `variant` (use `'outlined'`).
- **`createImageModal(imageUrl)`** (`custom-ui/overlays/modal.mjs`): Opens a full-size image modal.
- **`POST /generate/sync`**: Synchronous generation endpoint. Body: `{ workflow, name, prompt, seed, orientation }`. Returns JSON with `imageUrl`. Does not log to media-data.json.
