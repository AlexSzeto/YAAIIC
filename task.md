# Untitled
## Goal
## Tasks
## Implementation Details

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

