# AnyTale Expanded Text Descriptions

## Goal

Expand the user-facing textual data throughout AnyTale by: (1) separating technical prompt identifiers from human display names in parts, characters, and outfits data; (2) adding character profile fields for player-facing self-descriptions and voice generation; (3) wiring these new fields into play mode selection screens; and (4) adding a dialog preview tool and a view-image shortcut to the plot page editor.

## Tasks

### Phase 1 — Data migration and server update

- [x] **Migration script `scripts/migrate/anytale-data/4-to-5.mjs`:** On each part: rename `name` → `referenceTag`, add `name: ''`. On each character: add `selfProfile: ''`, `voiceProfile: ''`. On each outfit: add `description: ''`. On each genre: add `disabled: false`. Bump `anytale-data.currentVersion` to 5 in `server/core/data-versions.mjs`.
- [x] **Server voice endpoint:** In `server/features/anytale/router.mjs` `generate-voice`, accept `voiceProfile` from request body alongside existing fields; include `voiceProfile` in `requestData` sent to the workflow.
- [x] **Config default:** Add `anytale.dialogPreview: { name: '', personality: '', outfit: '' }` to `server/config.default.json`.

### Phase 2 — Prompt assembler and editor UI

- [ ] **Prompt assembler:** In `public/js/app-ui/anytale/prompt-assembler.mjs`, update `expandPageTags`, `assemblePrompt`, and `assemblePartPreviewPrompt` to use `config.referenceTag` instead of `config.name` for prompt token substitution and baseline deduplication.
- [ ] **Part editor fields:** In `public/js/app-ui/anytale/part-item.mjs`, add "Name" input (`name` field, display name) as the first field above "Reference Tag" (`referenceTag` field, formerly "Name"); update `anytale-state.mjs` part defaults accordingly.
- [ ] **Outfit description field:** In `public/js/app-ui/anytale/outfit-section.mjs`, add a "Description" textarea below the outfit "Name" field; update `anytale-state.mjs` outfit defaults to include `description: ''`.
- [ ] **Genre hidden toggle:** In `public/js/app-ui/anytale/music-section.mjs`, add a "Hidden from AnyTale Play" toggle as the very first field in the genre edit form (before "Genre Name"), bound to `genre.disabled`.
- [ ] **Character profile fields:** In `public/js/app-ui/anytale/character-section.mjs`:
  - Add "Self Profile" multiline textarea below "Personality"; add "Voice Profile" multiline textarea below "Self Profile".
  - Update `handleGenerateVoice` to pass `character.voiceProfile` to the endpoint; remove the `!character.personality?.trim()` disable guard (voice profile is optional).
  - Update `applyVoiceResult` to accept a third `voiceProfile` arg and apply `result.description` back to `character.voiceProfile`.
  - Update `charactersEqual` to include `selfProfile` and `voiceProfile`.
  - Update `anytale-state.mjs` character defaults and loader to include `selfProfile: ''`, `voiceProfile: ''`.
  - Update `character-api.mjs`: rename the `personality` param to `voiceProfile`, update the request body accordingly.
  - Update `anytale-form.mjs` voice `onComplete` handlers to pass `data.result?.description || null` as the third arg to `applyVoiceRef.current`.

### Phase 3 — Play mode display

- [ ] **Data normalizers:** In `public/js/app-ui/anytale-play/play-normalizer.mjs`, add `selfProfile` and `voiceProfile` to `normalizeCharacter`; add `referenceTag` and `name` defaults to `normalizePart`; add `description` to `normalizeOutfit`; add a new `normalizeGenre` function defaulting `disabled: false`.
- [ ] **Session shape:** In `public/js/app-ui/anytale/play/play-session.mjs`, add `selfProfile` to the `SessionCharacter` typedef and `DEFAULT_SESSION.character`.
- [ ] **Play mode selection screens:** In `public/js/app-ui/anytale-play/anytale-play.mjs`:
  - Character pick: use `char.selfProfile` as subtitle instead of `char.personality`.
  - Outfit pick: add `subtitle: outfit.description || undefined`.
  - Cold start bootstrap and `pickCharacter`: include `selfProfile` in the session character object.
  - Cold start and `enterMusicPick`: filter genres to `!g.disabled` before random selection; fall back to full list if all are disabled.

### Phase 4 — Plot page dialog preview

- [ ] **Dialog preview in plot editor:** In `public/js/app-ui/anytale/plot-section.mjs`:
  - Extend the existing `/anytale/config` fetch to also read the `dialog` and `dialogPreview` config objects into local state.
  - Below the "Action Description for Dialog Prompt" input, render a "Dialog Preview" label (secondary text style) and a "Preview Dialog" icon-text button (icon: `message-detail`).
  - On click, generate dialog for pages 0 through the current page sequentially — same history-building process as play mode (`generateDialog` from `../anytale-play/play-dialog.mjs`, accumulating `{ role, content }` history entries). Use `dialogPreview.name` as `character.name`, `dialogPreview.personality` as `character.personality`, `dialogPreview.outfit` as `locationAttributeValue`.
  - Store per-page preview results in a `dialogPreviews` local state map (keyed by page index); display the current page's result in the label area below the button.
  - Disable the button when `dialogPrompt` is empty or `dialogConfig` is not configured.

### Phase 5 — View Image button and Reject/Extend relayout

- [ ] **View Image button:** In `public/js/app-ui/anytale/plot-section.mjs`:
  - Add `onViewPageImage` prop (called with `{ plotUid, pageIndex }`).
  - Insert a new `HorizontalEdgesLayout` row between the "Page Tags" input and the navigation controls row: "View Image" icon-text button (icon: `image-alt`) on the left; Reject and Extend buttons on the right edge.
  - Remove the old standalone Reject/Extend `HorizontalLayout` row.
- [ ] **Wire callback in parent:** In `public/js/app-ui/anytale/anytale.mjs`, define `handleViewPageImage({ plotUid, pageIndex })` that searches `history` for the first item where `item.plot?.uid === plotUid && item.plot?.page === pageIndex`, calls `nav.selectByIndex` with that index, or toasts `'Page image not found'` if none matches. Pass as `onViewPageImage` to `AnyTaleForm`; thread through `AnyTaleForm` down to `PlotSection`.
- [ ] Review and update affected living docs: `docs/features/anytale.md`, `docs/server.md`

## Implementation Details

### Data migration (anytale-data v4 → v5)

```js
// scripts/migrate/anytale-data/4-to-5.mjs
export const fromVersion = 4;
export const toVersion = 5;

export function migrate(data) {
  // Parts: rename name → referenceTag, add display name field
  if (Array.isArray(data.parts)) {
    data.parts = data.parts.map(p => {
      const { name, ...rest } = p;
      return { ...rest, referenceTag: name ?? '', name: '' };
    });
  }
  // Characters: add selfProfile and voiceProfile
  if (Array.isArray(data.characters)) {
    data.characters = data.characters.map(c => ({
      ...c,
      selfProfile: c.selfProfile ?? '',
      voiceProfile: c.voiceProfile ?? '',
    }));
  }
  // Outfits: add description
  if (Array.isArray(data.outfits)) {
    data.outfits = data.outfits.map(o => ({
      ...o,
      description: o.description ?? '',
    }));
  }
  // Genres: add disabled flag
  if (Array.isArray(data.genres)) {
    data.genres = data.genres.map(g => ({
      ...g,
      disabled: g.disabled ?? false,
    }));
  }
  return data;
}
```

### Prompt assembler: referenceTag usage

After migration, `config.referenceTag` holds the prompt token (formerly `config.name`). Three call sites in `prompt-assembler.mjs` must change:

- `expandPageTags` (~line 88): `.map(p => p.config?.referenceTag || '')`
- `assemblePrompt` (~line 159): `const partName = (part.config.referenceTag || '').toLowerCase()`
- `assemblePartPreviewPrompt` (~line 195): `const partName = (part.config.referenceTag || '').toLowerCase()`

### Voice generation flow

```
Client: generateCharacterVoice(uid, voiceProfile, name)
  → POST /anytale/characters/:uid/generate-voice { voiceProfile, name, clientId }

Server: requestData.voiceProfile = voiceProfile (workflow accepts as optional param)

Result (SSE complete): { audioUrl, summary, description, characterUid }
  → applyVoiceResult(audioUrl, summary, description)
  → character.audioUrl      = audioUrl
  → character.introTranscript = summary
  → character.voiceProfile  = description   ← workflow returns generated description
```

### Dialog preview config shape

`anytale.dialogPreview` in `config.json`:
```json
{
  "name": "Emma",
  "personality": "A seductive, confident woman who speaks with poise.",
  "outfit": "dimly lit bar"
}
```
These substitute into the dialog system message template as `{{name}}`, `{{profile}}`, and `{{location}}` respectively. If `dialogPreview` is absent or any field is empty, the "Preview Dialog" button is disabled.

### Session character shape (updated)

```js
character: {
  uid, name, personality, selfProfile,
  portraitUrl, voiceSampleUrl, introTranscript, parts
}
```
`personality` is retained — it is still used by `queuePageDialog` / `generateDialog` for dialog generation. `selfProfile` is display-only (shown in character pick subtitle).

### Genre disabled filtering (play mode)

```js
const eligibleGenres = (playData.genres || []).filter(g => !g.disabled);
const genres = eligibleGenres.length > 0 ? eligibleGenres : (playData.genres || []);
```
Apply in both cold-start bootstrap (initial genre pick) and `enterMusicPick`.

### View Image button — history search

```js
const handleViewPageImage = useCallback(({ plotUid, pageIndex }) => {
  const idx = history.findIndex(
    item => item.plot?.uid === plotUid && item.plot?.page === pageIndex
  );
  if (idx === -1) { toast.show('Page image not found', 'warning'); return; }
  nav.selectByIndex(idx);
}, [history, nav, toast]);
```
`item.plot.page` is the 0-based page index stored on generation records (same field the existing `handleReject` filter uses).
