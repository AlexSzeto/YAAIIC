# AnyTale Parts Library

## Goal

Add a server-side parts library to the AnyTale system so part configs can be saved, searched, and reloaded across sessions. Attribute value keys are migrated from index-based to name-based to enable reliable reconstruction from stored generation data. Parts data (the `data` portion keyed by name) is persisted alongside each generation record in `media-data.json`.

## Tasks

- [x] **Task 1: Create the `anytale` server feature domain**
  Create `server/features/anytale/` with `repository.mjs`, `service.mjs`, and `router.mjs`. Create `server/database/anytale-data.json` with initial shape `{ "parts": [] }`. Mount the router in `server/server.mjs` under `/anytale`. Expose three endpoints: `GET /anytale/parts` (returns array of all saved part configs), `PUT /anytale/parts/:uid` (upsert by uid — create or overwrite), `DELETE /anytale/parts/:uid` (remove by uid). Verify with curl examples below.

- [x] **Task 2: Refactor attribute value keys from index-based to name-based**
  In `anytale-state.mjs`, change `categoryAttributeValues` and `customAttributeValues` in the part `data` model from `{ [index]: value }` to `{ [attributeName]: value }`. Update `part-item.mjs` to read/write using `attribute.name` as the key. Update `prompt-assembler.mjs` to iterate over the part's `config.categoryAttributes` / `config.customAttributes` arrays and look up values by `attribute.name`. Existing localStorage data will be wiped manually — no migration needed. Verify by adding category and custom attributes, selecting values, refreshing the page, and confirming selections are restored.

- [x] **Task 3: Add "Save to Library" and "Delete from Library" buttons in `part-item.mjs`**
  Add two buttons at the bottom of the part item form, below the Custom Attributes list:
  - **Save to Library** (icon: `save`): On click, derive the uid from the current name (see uid derivation below), then send `PUT /anytale/parts/:uid` with the part's `config` (including the derived `uid`) as the request body. Show a toast success "Saved [name] to library" on success or a toast error on failure. If `part.config.name` is empty, show a toast warning "Part must have a name before saving" and do nothing.
  - **Delete from Library** (icon: `delete`, variant: destructive or secondary): On click, confirm with a `window.confirm` dialog ("Delete '[name]' from the library? This cannot be undone."). If confirmed, send `DELETE /anytale/parts/:uid` using `part.config.uid`. Show a toast success "Deleted [name] from library" on success, a toast warning "[name] is not in the library" on 404, or a toast error on other failures. If `part.config.name` is empty, do nothing.
  Both buttons should be disabled and show a loading state while their respective requests are in-flight. Neither button removes the part from the current generation list — that remains the DynamicList delete button's responsibility. Verify Save by naming a part, clicking Save, and checking `GET /anytale/parts`. Verify Delete by saving a part, clicking Delete from Library, and confirming `GET /anytale/parts` no longer includes it.

- [x] **Task 4: Add Parts Library lookup input in `anytale-form.mjs`**
  Below the character name input, add a labelled autocomplete text input ("Add Part from Library"). On mount, fetch `GET /anytale/parts` and store the result. Wire the autocomplete to suggest part names from the fetched list (display `config.name`, match on `config.name`). When the user selects a suggestion or presses Tab/Enter with a non-empty value: find the matching part config from the fetched list by name (case-insensitive), create a new part using `createDefaultPart()` and merge the saved config into it (preserving the config's `uid`), then append it to the parts list and persist to localStorage. Clear the input after adding. If the typed name matches no saved part, show a toast warning "No saved part named '[name]' found". Verify by saving a part in Task 3, reloading the page, typing the name in the lookup input, and confirming it is added to the list.

- [x] **Task 5: Add Reprompt button in `anytale-form.mjs`**
  Add a "Reprompt" button (icon: `refresh`, label: "Reprompt") near the Generate button. On click:
  1. Fetch `GET /anytale/parts` to get current library definitions.
  2. For each existing part in the list, find its matching library config by `part.config.uid` (fall back to name match if uid is absent for older local data).
  3. If a match is found: replace `part.config` with the library config, then reconstruct `data.categoryAttributeValues` and `data.customAttributeValues` using name-based keys — attributes present in the new config that have a saved value keep that value; attributes missing a saved value default to `''`; saved values for attributes no longer in the config are discarded.
  4. If no match is found: keep the part unchanged.
  5. Update state and persist to localStorage.
  Verify by saving a part to the library, modifying its config there externally (e.g. via PUT), then clicking Reprompt and confirming the part reflects the updated config while retaining any still-valid attribute selections.

- [x] **Task 6: Add `parts` field to media schema and pass parts data through generation**
  Add `"parts": { "type": "object", "default": null }` to `server/resource/media-data-schema.json` as a core field. In `anytale.mjs`, when building the generation request body, include a `parts` field: an object keyed by `part.config.name` containing only the `data` portion of each part (i.e. `{ enabled, categoryAttributeValues, customAttributeValues, previewImageUrl }`). Only include parts that have a non-empty name. Verify by triggering a generation from AnyTale and checking the saved media entry in `GET /media-data/:uid` has a `parts` field containing the expected data.

## Implementation Details

### Server: `anytale-data.json` initial shape
```json
{
  "parts": []
}
```

### Server: Part config shape stored in library
Only the `config` portion of a part is stored. `uid` is derived from `name` on save (lower kebab-case) and is the stable identifier used in all API routes:
```js
{
  uid: 'dynamic-posture',   // derived: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  name: 'Dynamic Posture',
  type: '',
  previewBaseline: '',
  baseline: '',
  categoryAttributes: [{ name: '', category: '' }],
  customAttributes: [{ name: '', options: '' }],
}
```

### Client: uid derivation function
```js
function toPartUid(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
// 'Dynamic Posture' → 'dynamic-posture'
// 'Hair Color!' → 'hair-color'
```

### Server: `router.mjs` endpoints
- `GET /anytale/parts` → `200 [config, ...]`
- `PUT /anytale/parts/:uid` → `200 { saved: config }` (upsert by uid)
- `DELETE /anytale/parts/:uid` → `200 { deleted: uid }` or `404`

### Server: curl verification examples (Task 1)
```sh
# List all parts
curl http://localhost:3000/anytale/parts

# Save a part (uid = lower-kebab of name)
curl -X PUT http://localhost:3000/anytale/parts/my-part \
  -H "Content-Type: application/json" \
  -d "{\"uid\":\"my-part\",\"name\":\"My Part\",\"type\":\"hair\",\"previewBaseline\":\"\",\"baseline\":\"blue_hair\",\"categoryAttributes\":[],\"customAttributes\":[]}"

# Delete a part
curl -X DELETE http://localhost:3000/anytale/parts/my-part
```

### Client: Updated `data` shape (name-based attribute keys)
```js
data: {
  enabled: true,
  categoryAttributeValues: { 'Hair Color': 'blue_hair' },  // keyed by attribute name
  customAttributeValues: { 'Outfit Style': 'dress' },       // keyed by attribute name
  previewImageUrl: '',
}
```

### Client: Parts data stored in generation record (`extraInputs.parts` replaced by top-level `parts`)
```js
// Stored in media entry as top-level `parts` field (new schema field):
parts: {
  'Hair': {
    enabled: true,
    categoryAttributeValues: { 'Color': 'blue_hair' },
    customAttributeValues: {},
    previewImageUrl: '/media/preview_123.png'
  },
  'Outfit': {
    enabled: true,
    categoryAttributeValues: {},
    customAttributeValues: { 'Style': 'dress' },
    previewImageUrl: ''
  }
}
```

### Client: Reprompt value reconstruction logic
```js
// For each part in the current list, find its library config:
// Prefer uid match; fall back to name match for older local data without uid.
const libraryConfig = libraryParts.find(p => p.uid === part.config.uid)
  ?? libraryParts.find(p => p.name === part.config.name);
if (!libraryConfig) return part; // unchanged

const newCategoryValues = {};
for (const attr of libraryConfig.categoryAttributes) {
  newCategoryValues[attr.name] = part.data.categoryAttributeValues[attr.name] ?? '';
}
const newCustomValues = {};
for (const attr of libraryConfig.customAttributes) {
  newCustomValues[attr.name] = part.data.customAttributeValues[attr.name] ?? '';
}
return {
  ...part,
  config: libraryConfig,
  data: { ...part.data, categoryAttributeValues: newCategoryValues, customAttributeValues: newCustomValues }
};
```

### Files to create/modify
| Action | File |
|--------|------|
| NEW | `server/features/anytale/repository.mjs` |
| NEW | `server/features/anytale/service.mjs` |
| NEW | `server/features/anytale/router.mjs` |
| NEW | `server/database/anytale-data.json` |
| MODIFY | `server/server.mjs` (mount anytale router) |
| MODIFY | `server/resource/media-data-schema.json` (add `parts` field) |
| MODIFY | `public/js/app-ui/anytale/anytale-state.mjs` (name-based keys) |
| MODIFY | `public/js/app-ui/anytale/part-item.mjs` (name-based keys + Save button) |
| MODIFY | `public/js/app-ui/anytale/prompt-assembler.mjs` (name-based keys) |
| MODIFY | `public/js/app-ui/anytale/anytale-form.mjs` (library lookup + Reprompt button) |
| MODIFY | `public/js/app-ui/anytale/anytale.mjs` (include `parts` in generation request) |

