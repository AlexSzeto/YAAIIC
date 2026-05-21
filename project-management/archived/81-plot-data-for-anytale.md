# Plot Data for AnyTale

## Goal
Add a "plot data" entity to the anytale feature — a named, sequenced list of pages that augment prompt generation with base tags and per-part overrides, enabling image-to-image story progressions. Users manage plot blocks in a dedicated section of the anytale editor below parts.

## Bugs
[x] Use a tag autocomplete input for page tags
[x] The Part Modifiers section is not using a custom-ui compact dynamic list. When the add modifier button is pressed (which shouldn't exist in its current form), it throws the following error:
```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'error')
    at plot-section.mjs:87:53
    at goober.js:2:1457
    at Array.reduce (<anonymous>)
    at N (goober.js:2:1409)
    at Object.h (goober.js:2:1671)
    at W.c [as constructor] (goober.js:2:2076)
    at W.fe [as render] (preact.js:2:8828)
    at B (preact.js:2:6330)
    at ee (preact.js:2:1851)
    at ue (preact.js:2:8074)
```
[x] Rearrange the plot UI to the following:
- Place the "Load Plot by Name" input above the Plot title text
- Plot title text (keep the modified H2 tag)
- Plot name and section
- An outline panel to enclose the page UI:
  - Page tags
  - Modifiers
  - navigation
- Save, delete, clear buttons for the plot
[x] Add a 'Generation' title (use H2) before the prompt preview text
[x] Intelligently update the management buttons for the parts actions. Change the wording from "Save to Library" to just "Save", and change the wording to "Update" if the part already exists in the library. Disable the "Update" button if the deep compare version of the part data is the same as its library counterpart. Similarly, change the wording from "Delete from Library" to just "Delete", and disable the button if the part isn't already in the library.
[x] Make the same modifications for the parts action buttons to the plot action buttons.

## Tasks

### Backend
- [x] Add `"plot": []` to `server/database/anytale-data.json` as a new top-level array alongside `"parts"`.
- [x] Extend `server/features/anytale/repository.mjs` to read and write plot entries (CRUD by `uid`).
- [x] Extend `server/features/anytale/service.mjs` with plot business logic (list, upsert, delete).
- [x] Add plot endpoints to `server/features/anytale/router.mjs`:
  - `GET /anytale/plot` — return array of `{ uid, name }` for autocomplete
  - `PUT /anytale/plot/:uid` — upsert a full plot block
  - `DELETE /anytale/plot/:uid` — delete a plot by uid

### Frontend — State & Data Layer
- [x] Add plot state management to `public/js/app-ui/anytale/anytale-state.mjs`: persist the active plot block in localStorage under a dedicated key. On init, if no plot exists in localStorage, create a blank plot block (one empty page).
- [x] Create `public/js/app-ui/anytale/plot-api.mjs` with functions to fetch the plot list, save a plot, and delete a plot (mirroring the parts API pattern).

### Frontend — Plot Section UI Component
- [x] Create `public/js/app-ui/anytale/plot-section.mjs` as a functional Preact component. It should always show: name input, section (free-text) input, an autocomplete input to load a plot by name, and Save / Delete / Clear buttons.
- [x] Wire the Save button to `PUT /anytale/plot/:uid`, Delete to `DELETE /anytale/plot/:uid` (with dialog confirmation), and Clear to reset the active plot to a new blank block (with dialog confirmation). Use the existing custom-ui dialog for confirmations.
- [x] Add the page navigation row: use `NavigatorControl` for first/prev/page-N-of-M/next/last, plus an Add Page icon button and a Delete Page icon button — all in a single compact row following the pattern in `anytale-viewer.mjs`.
- [x] Add the page editor fields: a `TagInput` for page base tags, and a compact dynamic list of part modifier rows (identifier text input, force-disable checkbox, template tag text input).
- [x] Mount `PlotSection` in `anytale-form.mjs` below the parts list.

### Frontend — Generation Integration
- [x] Update `public/js/app-ui/anytale/prompt-assembler.mjs` to accept an optional `activePage` argument. When provided:
  1. Append the page's `tags` to the assembled prompt.
  2. For each enabled part, check the page's `parts` list for a matching entry (by `identifier` against part `name` or `type`):
     - If `forceDisable` is true, skip that part's tags entirely.
     - If `templateTag` is non-empty, substitute `{{name}}` with the part's name and append the result.
- [x] Update the anytale generate action to pass the currently active plot page into `assemblePrompt`.

## Implementation Details

### Plot Data Schema
```json
{
  "uid": "string",
  "name": "string",
  "section": "string (free-text metadata, e.g. 'prelude')",
  "pages": [
    {
      "tags": "string (base tags added to prompt for this page)",
      "parts": [
        {
          "identifier": "string (matches part name or type)",
          "forceDisable": false,
          "templateTag": "string (supports {{name}} substitution)"
        }
      ]
    }
  ]
}
```

### localStorage Key
Store the active plot block under a key such as `"anytale-plot"` in the existing anytale localStorage namespace.

### Blank Plot Block (default on init)
```json
{
  "uid": "",
  "name": "",
  "section": "",
  "pages": [{ "tags": "", "parts": [] }]
}
```
