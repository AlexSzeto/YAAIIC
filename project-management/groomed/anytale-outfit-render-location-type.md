# AnyTale Outfit Render, Preferred Locations & "location" Part Type

## Goal

Add rendered image generation for outfits (`renderUrl`), add a `preferredLocations` field to outfit data so the play mode bootstrap can chain character → outfit → location, and rename the `"background"` part type to `"location"` throughout data, config, and spec files. As part of the rename, unify the render endpoint naming convention: `generate-portrait` → `render-portrait`, with the new outfit endpoint following as `render-outfit`.

## Tasks

### Phase 1 — Data migration and spec alignment

- [ ] Rename `"background"` → `"location"` in all part `type` arrays in `server/database/anytale-data.json`; rename the `previewBasePromptByType.background` key to `previewBasePromptByType.location` in both `server/config.json` and `server/config.default.json`. Manual check: no remaining `"background"` values in part type arrays.

- [ ] Update all play mode spec files (`project-management/groomed/anytale-play-mode.md` and rollouts 1–6) with a search-replace pass on part-type references (`"background"` → `"location"`, `background-typed` → `location-typed`, `backgroundPartUid` → `locationPartUid`, `backgroundAttributes` → `locationAttributes`, `type.includes('background')` → `type.includes('location')`), then a manual review pass to preserve prompt strings (e.g. `"simple background, grey background"`, CSS property values, and plain-English uses of "background" that don't refer to the part type). Also update the Rollout 3 bootstrap section to reflect the new location selection logic: pick randomly from `outfit.preferredLocations`; fall back to all location-typed parts if the array is empty.

### Phase 2 — Endpoint rename

- [ ] Rename `POST /anytale/characters/:uid/generate-portrait` → `render-portrait` in `router.mjs` (route path, JSDoc header comment); update the matching `endpointKey` from `'anytale-portrait'` to `'anytale-render-portrait'` in both the router and `orchestrator.mjs` (`silent` set check and completion handler). Update every client-side call to this endpoint.

### Phase 3 — Data model and server

- [ ] Add `preferredLocations: string[]` and `renderUrl: string` to the `Outfit` typedef in `repository.mjs`; add `updateOutfitField(uid, field, value)` to `service.mjs`, mirroring `updateCharacterField`.

- [ ] Add `POST /anytale/outfits/:uid/render-outfit` to `router.mjs`:
  - Load the outfit from the DB; load all library parts.
  - Assemble prompt: start with `portraitBasePrompt` from config, then for each outfit part find its library config and append `baseline` + selected `attributeValues`, matching the portrait generation prompt assembly pattern.
  - Use `portraitWorkflow` from config.
  - Enqueue via `queueService.enqueue` with `endpointKey: 'anytale-render-outfit'`, `outfitUid: uid`, `subLabel: 'Outfit Render'`, `source: 'anytale'`.

- [ ] Update `orchestrator.mjs`:
  - Add `'anytale-render-outfit'` to the `silent` set.
  - Store `outfitUid` from `taskData` via `updateTask` (alongside existing `characterUid` handling).
  - Add completion handler: when `endpointKey === 'anytale-render-outfit'` and `result?.imageUrl` and `taskData.outfitUid`, call `updateOutfitField(outfitUid, 'renderUrl', result.imageUrl)`.

- [ ] Add test coverage for the new `render-outfit` endpoint and the `render-portrait` rename in `router.test.mjs`.

### Phase 4 — Frontend

- [ ] Update `anytale-state.mjs`: add `preferredLocations: []` and `renderUrl: ''` to `createBlankOutfit()` and the `loadOutfit()` deserializer.

- [ ] Update `outfit-section.mjs`:
  - Include `preferredLocations` in `outfitsEqual` comparison (exclude `renderUrl` — it is server-set).
  - Add a preferred locations chip input following the same pattern as `preferredOutfits` in `character-section.mjs`: source names from `libraryParts.filter(p => p.type?.includes('location'))`, display names as chips, store UIDs in `outfit.preferredLocations`.
  - Add an outfit render image display: show `outfit.renderUrl` when set (same placement as character portrait in the character section).
  - Add a "Generate Render" button that calls `POST /anytale/outfits/:uid/render-outfit`; disabled when `!outfit.uid` (outfit must be saved first). Subscribe to SSE via `queueSSEManager` to track the in-flight task; on completion update `outfit.renderUrl` and `libraryOutfit.renderUrl` from `data.result.imageUrl` without re-fetching.

- [ ] Add `renderOutfit(uid)` to `outfit-api.mjs`.

- [ ] Review and update affected living docs: `docs/features/anytale.md`, `docs/server.md`

## Implementation Details

### Renamed endpoint convention

All entity-specific image generation endpoints follow the `render-<type>` pattern:

| Entity | Endpoint | endpointKey |
|---|---|---|
| Character | `POST /anytale/characters/:uid/render-portrait` | `anytale-render-portrait` |
| Outfit | `POST /anytale/outfits/:uid/render-outfit` | `anytale-render-outfit` |

Future entity renders (e.g. location) follow the same convention. Voice and part-preview endpoints are unaffected (different generation category).

### Outfit render prompt assembly

Mirrors the character portrait prompt assembly in `router.mjs` — see the existing `render-portrait` handler as the reference implementation. Key difference: portrait filters library parts by `portraitPartMatchers`; outfit render uses **all** parts in the outfit's `parts` array without type filtering.

```js
const tags = [];
if (portraitBasePrompt) tags.push(portraitBasePrompt);

for (const outfitPart of outfit.parts) {
  const libPart = libraryParts.find(p => p.uid === outfitPart.partUid);
  if (!libPart) continue;
  if (libPart.baseline) tags.push(libPart.baseline);
  for (const val of Object.values(outfitPart.attributeValues || {})) {
    if (val?.trim()) tags.push(val.trim());
  }
}

const prompt = tags.filter(Boolean).join(', ');
```

### Outfit typedef (updated)

```js
/**
 * @typedef {Object} Outfit
 * @property {string} uid
 * @property {string} name
 * @property {CharacterPart[]} parts
 * @property {string[]} [preferredLocations=[]] - UIDs of preferred location-typed parts
 * @property {string} [renderUrl=''] - URL of the generated render image
 */
```

### Play mode bootstrap — preferred location selection

The cold-start bootstrap (Rollout 3) picks a location by:
1. Read `outfit.preferredLocations` (array of location part UIDs).
2. If non-empty, pick a random UID from the array and use that part.
3. If empty (or the referenced part no longer exists), fall back to picking a random part from all location-typed parts.

### Spec file search-replace guidance

Terms to replace in play mode spec files (part-type references only):

| Find | Replace |
|---|---|
| `type.includes('background')` | `type.includes('location')` |
| `` `background`-typed `` | `` `location`-typed `` |
| `background-typed` | `location-typed` |
| `backgroundPartUid` | `locationPartUid` |
| `backgroundAttributes` | `locationAttributes` |
| `background part` (when referring to the part type) | `location part` |
| `background: { partUid` | `location: { partUid` |
| `section === 'background'` | `section === 'location'` (if any) |

Terms to **preserve** (not part-type references):
- `simple background`, `grey background` — Stable Diffusion prompt tags
- `background-color`, `background:` — CSS
- `background music` — audio feature
- General English usage: "in the background", "background context"
