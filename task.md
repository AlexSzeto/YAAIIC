# Plot Data for AnyTale

## Goal
Add a "plot data" entity to the anytale feature — a named, sequenced list of pages that augment prompt generation with base tags and per-part overrides, enabling image-to-image story progressions. Users manage plot blocks in a dedicated section of the anytale editor below parts.

## Tasks

### Backend
- [ ] Add `"plot": []` to `server/database/anytale-data.json` as a new top-level array alongside `"parts"`.
- [ ] Extend `server/features/anytale/repository.mjs` to read and write plot entries (CRUD by `uid`).
- [ ] Extend `server/features/anytale/service.mjs` with plot business logic (list, upsert, delete).
- [ ] Add plot endpoints to `server/features/anytale/router.mjs`:
  - `GET /anytale/plot` — return array of `{ uid, name }` for autocomplete
  - `PUT /anytale/plot/:uid` — upsert a full plot block
  - `DELETE /anytale/plot/:uid` — delete a plot by uid

### Frontend — State & Data Layer
- [ ] Add plot state management to `public/js/app-ui/anytale/anytale-state.mjs`: persist the active plot block in localStorage under a dedicated key. On init, if no plot exists in localStorage, create a blank plot block (one empty page).
- [ ] Create `public/js/app-ui/anytale/plot-api.mjs` with functions to fetch the plot list, save a plot, and delete a plot (mirroring the parts API pattern).

### Frontend — Plot Section UI Component
- [ ] Create `public/js/app-ui/anytale/plot-section.mjs` as a functional Preact component. It should always show: name input, section (free-text) input, an autocomplete input to load a plot by name, and Save / Delete / Clear buttons.
- [ ] Wire the Save button to `PUT /anytale/plot/:uid`, Delete to `DELETE /anytale/plot/:uid` (with dialog confirmation), and Clear to reset the active plot to a new blank block (with dialog confirmation). Use the existing custom-ui dialog for confirmations.
- [ ] Add the page navigation row: use `NavigatorControl` for first/prev/page-N-of-M/next/last, plus an Add Page icon button and a Delete Page icon button — all in a single compact row following the pattern in `anytale-viewer.mjs`.
- [ ] Add the page editor fields: a `TagInput` for page base tags, and a compact dynamic list of part modifier rows (identifier text input, force-disable checkbox, template tag text input).
- [ ] Mount `PlotSection` in `anytale-form.mjs` below the parts list.

### Frontend — Generation Integration
- [ ] Update `public/js/app-ui/anytale/prompt-assembler.mjs` to accept an optional `activePage` argument. When provided:
  1. Append the page's `tags` to the assembled prompt.
  2. For each enabled part, check the page's `parts` list for a matching entry (by `identifier` against part `name` or `type`):
     - If `forceDisable` is true, skip that part's tags entirely.
     - If `templateTag` is non-empty, substitute `{{name}}` with the part's name and append the result.
- [ ] Update the anytale generate action to pass the currently active plot page into `assemblePrompt`.

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

### Template Substitution
`{{name}}` in `templateTag` is replaced with the matched part's `name` at prompt-assembly time. Write a small helper (similar to server-side template-utils) in the client to handle this substitution.

### NavigatorControl Usage (from anytale-viewer.mjs)
```js
html`<${NavigatorControl}
  currentPage=${currentPageIndex}
  totalPages=${plot.pages.length}
  onPrev=${...} onNext=${...} onFirst=${...} onLast=${...}
  showFirstLast=${true}
/>`
```
Add Page and Delete Page buttons sit in the same row as extra icon buttons.

### Autocomplete for Plot Load
Fetch `GET /anytale/plot` on component mount to populate the autocomplete suggestions list. Selecting an entry fetches and loads the full plot block into state.

### Manual Test Curls
```bash
# List plots
curl http://localhost:3000/anytale/plot

# Upsert a plot
curl -X PUT http://localhost:3000/anytale/plot/test-uid \
  -H "Content-Type: application/json" \
  -d '{"uid":"test-uid","name":"Test Plot","section":"prelude","pages":[{"tags":"sunny day","parts":[{"identifier":"Hero","forceDisable":false,"templateTag":"{{name}} stands tall"}]}]}'

# Delete a plot
curl -X DELETE http://localhost:3000/anytale/plot/test-uid
```

