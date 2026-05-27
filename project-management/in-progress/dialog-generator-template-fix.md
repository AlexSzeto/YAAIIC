# Dialog Generator Template Substitution Fix

## Goal

Fix broken `{{profile}}` and `{{outfit}}` template substitutions in the AnyTale dialog generator, both in the page editor's dialog preview and in play mode. Ensure the system message is assembled correctly in all paths before any dialog generation call.

## Tasks

- [x] In `play-dialog.mjs`, add `outfit` parameter to `renderSystemMessage` and substitute `{{outfit}}`; add `outfitText` parameter to `generateDialog`; use `character.profile || character.personality` for the `{{profile}}` slot so both naming conventions are supported; update JSDoc
- [x] In `plot-section.mjs`, fix the dialog preview: import `assemblePrompt`; change `character.personality` → `character.profile` sourced from `dialogPreview.profile`; replace `locationAttributeValue = dialogPreview.outfit || ''` with `outfitText = assemblePrompt(nonCharacterParts, null, null)`; pass `outfitText` to `generateDialog` in both `handlePreviewDialog` and `bulkDialogGenerate`; fix `previewDialogDisabled` to check `dialogPreview.profile?.trim()`
- [x] In `anytale-play.mjs`, fix play-mode dialog: add a `slotStatusesForPage` parameter to `queuePageDialog`; inside, call `buildEnabledPartsForPage` to get visibility-filtered parts; filter to non-character parts (exclude parts where every type is in `recommendedCharacterPartTypes`); compute `outfitText = assemblePrompt(nonCharOutfitParts, null, null)` and pass it to `generateDialog`; update the call in `initChapter` to pass `slotStatuses[plotPageIdx]`
- [ ] Manually verify: open the AnyTale editor, configure `dialogPreview` with `name`/`profile`, load a plot with a `dialogPrompt`, click "Preview Dialog" — the generated dialog should reflect the character profile and visible outfit parts; confirm no literal `{{outfit}}` or `{{profile}}` appears in the Ollama request log
- [x] Review and update affected living docs: `docs/features/anytale.md`

#### Fixes and Changes
- [x] Add `dialogPreview.location` sourcing: in `config.default.json` add a `location` field to `dialogPreview`; update the `2-to-3` migration to include it; in `plot-section.mjs` pass `dialogPreview.location || ''` as `locationAttributeValue` in both `handlePreviewDialog` and `bulkDialogGenerate`; verify play mode already uses the first attribute value from `sess.location.attributeMap`; update docs
- [x] Tighten outfit assembly: in `plot-section.mjs`, load `recommendedOutfitPartTypes` from config and compute outfit text by filtering `enabledParts` to those with at least one type in `recommendedOutfitPartTypes` (replaces the `nonCharacterParts` filter); in `anytale-play.mjs`, simplify `queuePageDialog` to assemble outfit directly from `outfitParts` via `buildPartForPrompt` (remove `slotStatusesForPage` parameter and `buildEnabledPartsForPage` call); revert the `initChapter` call to the original 6-argument form

## Implementation Details

### config.default.json `dialogPreview` shape (already correct — no schema changes needed)
```json
"dialogPreview": {
  "name": "Alice",
  "profile": "A cheerful and good natured young woman."
}
```

### `renderSystemMessage` fix (`play-dialog.mjs`)
```js
function renderSystemMessage(template, name, profile, location, outfit) {
  return template
    .replace('{{name}}', name || '')
    .replace('{{profile}}', profile || '')
    .replace('{{location}}', location || '')
    .replace('{{outfit}}', outfit || '');
}
```

### `generateDialog` signature change (`play-dialog.mjs`)
Add `outfitText` to the destructured params. Change the `renderSystemMessage` call:
```js
export async function generateDialog({ character, locationAttributeValue, outfitText, page, dialogConfig, history = [], signal, onChunk }) {
  // ...
  const systemMessage = renderSystemMessage(
    systemTemplate,
    character.name || '',
    character.profile || character.personality || '',   // play-session uses .personality; preview uses .profile
    locationAttributeValue || '',
    outfitText || ''
  );
```

### `plot-section.mjs` preview object fix
```js
// Before
const character = {
  name: dialogPreview.name || '',
  personality: dialogPreview.personality || '',  // WRONG: field doesn't exist
};
const locationAttributeValue = dialogPreview.outfit || '';  // WRONG: routes outfit to {{location}}

// After
const character = {
  name: dialogPreview.name || '',
  profile: dialogPreview.profile || '',
};
const outfitText = assemblePrompt(nonCharacterParts, null, null);
```

The `outfitText` variable replaces `locationAttributeValue` in the `generateDialog` call. `locationAttributeValue` can be omitted or passed as `''` — no location is available in the preview context.

`previewDialogDisabled` line change:
```js
// Before
|| !(dialogPreview.name?.trim() && dialogPreview.personality?.trim())
// After
|| !(dialogPreview.name?.trim() && dialogPreview.profile?.trim())
```

`assemblePrompt` is already exported from `prompt-assembler.mjs`; add it to the import line in `plot-section.mjs`.

`nonCharacterParts` is already computed at component level (line ~337) — use it directly inside the callbacks.

### `anytale-play.mjs` `queuePageDialog` fix

Add `slotStatusesForPage` parameter (default `null`):
```js
const queuePageDialog = useCallback(async (
  plotPageIdx, plot, sess, data, cacheKey, history = [], slotStatusesForPage = null
) => {
```

Inside, after building `partsMap` and `outfitParts`, derive visible non-character outfit parts:
```js
const characterSlotTypes = new Set(
  (data.config.recommendedCharacterPartTypes || []).map(t => t.trim().toLowerCase())
);

let outfitText = '';
if (slotStatusesForPage) {
  const { enabledParts: visibleParts } = buildEnabledPartsForPage(
    sess, outfitParts, partsMap, slotStatusesForPage, data.config.slotRules || ''
  );
  const nonCharParts = visibleParts.filter(p => {
    const types = Array.isArray(p.config?.type)
      ? p.config.type.map(t => t.trim().toLowerCase()) : [];
    return types.length === 0 || !types.every(t => characterSlotTypes.has(t));
  });
  outfitText = assemblePrompt(nonCharParts, null, null);
}
```

Pass `outfitText` to `generateDialog`:
```js
const text = await generateDialog({
  character: sess.character,
  locationAttributeValue: locationAttrValue,
  outfitText,
  page: { ...page, dialogPrompt: expandedPrompt },
  dialogConfig,
  history,
  onChunk: ...
});
```

Update the `initChapter` call to `queuePageDialog` to pass the slot statuses:
```js
const result = await queuePageDialog(
  plotPageIdx, plot, sess, data, cacheKey, history, slotStatuses[plotPageIdx]
);
```

`assemblePrompt` is already imported at the top of `anytale-play.mjs`.
`buildEnabledPartsForPage` is already imported from `play-utils.mjs`.
