# TagInput Autocomplete and Right-Click Modal Fixes

## Goal

Fix three regressions in `tag-input.mjs` on the dress-up page: only the last TagInput on the page has working autocomplete (list ID collision), the styled dropdown is unstyled (style selector mismatch), and right-clicking any TagInput does not open the tag-selection modal.

## Tasks

- [x] Fix `tag-input.mjs` so each instance explicitly sets `resultsList.id` to `autoComplete_list_${styleIndex}` when constructing the autoComplete instance, ensuring the injected style sheet selector matches the actual DOM list ID and each instance has its own non-colliding list
- [x] Add right-click tag-selection modal support to `tag-input.mjs`: on contextmenu, call `suppressContextMenu`, extract the word at the cursor, save cursor position, and show a `TagSelectorPanel`; on tag select/replace, insert or replace the tag at the saved cursor position and call `onInput` with the updated value

## Implementation Details

### Root Cause: List ID Mismatch

`injectAutocompleteStyles(idx)` injects CSS targeting `#autoComplete_list_${idx}`. The `idx` value is `instanceCounter` captured at TagInput mount time. However, `autoComplete.js` auto-generates its list ID as `autoComplete_list_${e.id}` where `e.id` is a **separate global counter** inside the library (`autoComplete.instances`). These two counters are independent and will diverge when any other autoComplete instance exists on the page, causing styles to target the wrong element and leaving only the last-created instance visually functional.

Fix: pass `resultsList.id` explicitly so both the style injection and the DOM list use the same ID:

```js
const listId = `autoComplete_list_${styleIndexRef.current}`;
injectAutocompleteStyles(styleIndexRef.current);

acRef.current = new autoComplete({
  // ...
  resultsList: {
    id: listId,          // ← CRITICAL: forces the list DOM id to match the style selector
    tabSelect: true,
    maxResults: 30,
    destination: () => document.body,
    position: 'afterbegin',
  },
  // ...
});
```

### Right-Click Modal Wiring

Import the required utilities and components inside `tag-input.mjs`:

```js
import { TagSelectorPanel } from './tag-selector-panel.mjs';
import { suppressContextMenu } from '../../custom-ui/util.mjs';
import { extractWordAtCursor, insertTagAtCursorPos, replaceTagInPrompt } from './tag-insertion-util.mjs';
import { isTagDefinitionsLoaded } from './tag-data.mjs';
```

Add state inside `TagInput`:
```js
const [showTagPanel, setShowTagPanel] = useState(false);
const [initialSearchTerm, setInitialSearchTerm] = useState('');
const savedCursorPosRef = useRef(null);
```

Inside the existing `useEffect`, after obtaining the `textarea` reference, add:
```js
const cleanupContextMenu = suppressContextMenu(textarea, () => {
  if (!isTagDefinitionsLoaded()) return;
  setInitialSearchTerm(extractWordAtCursor(textarea));
  savedCursorPosRef.current = textarea.selectionStart;
  setShowTagPanel(true);
});
// …add cleanupContextMenu to the return cleanup function
```

Handle tag selection:
```js
const handleTagSelect = (tagName) => {
  const current = document.getElementById(uniqueId)?.value ?? '';
  const next = insertTagAtCursorPos(current, tagName, savedCursorPosRef.current);
  if (onInput) onInput(next);
  setShowTagPanel(false);
};

const handleTagReplace = (tagName) => {
  const current = document.getElementById(uniqueId)?.value ?? '';
  const next = replaceTagInPrompt(current, initialSearchTerm, tagName);
  if (onInput) onInput(next);
  setShowTagPanel(false);
};
```

Render inside the returned `html`:
```jsx
<${TagSelectorPanel}
  isOpen=${showTagPanel}
  initialSearchTerm=${initialSearchTerm}
  onSelect=${handleTagSelect}
  onReplace=${handleTagReplace}
  onClose=${() => setShowTagPanel(false)}
/>
```

### Generate Payload

Mirror the pattern from `app.mjs`:
```js
const seed = Math.floor(Math.random() * 4294967295);
const payload = {
  workflow: selectedWorkflow.name,
  name: formState.name || '',
  description: assembledPrompt,
  prompt: assembledPrompt,
  seed,
  orientation: selectedWorkflow.orientation,
};
// Add extraInputs defaults
(selectedWorkflow.extraInputs || []).forEach(input => {
  if (input.default !== undefined) {
    payload[input.id] = input.default;
  }
});
```

