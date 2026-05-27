# AnyTale Expanded Text Descriptions

## Goal

Expand the user-facing textual data throughout AnyTale by: (1) separating technical prompt identifiers from human display names in parts, characters, and outfits data; (2) adding character profile fields for player-facing self-descriptions and voice generation; (3) wiring these new fields into play mode selection screens; and (4) adding a dialog preview tool and a view-image shortcut to the plot page editor.

## Tasks

### Phase 1 — Data migration and server update

- [x] **Migration script `scripts/migrate/anytale-data/4-to-5.mjs`:** On each part: rename `name` → `referenceTag`, add `name: ''`. On each character: add `selfProfile: ''`, `voiceProfile: ''`. On each outfit: add `description: ''`. On each genre: add `disabled: false`. Bump `anytale-data.currentVersion` to 5 in `server/core/data-versions.mjs`.
- [x] **Server voice endpoint:** In `server/features/anytale/router.mjs` `generate-voice`, accept `voiceProfile` from request body alongside existing fields; include `voiceProfile` in `requestData` sent to the workflow.
- [x] **Config default:** Add `anytale.dialogPreview: { name: '', personality: '', outfit: '' }` to `server/config.default.json`.

### Phase 2 — Prompt assembler and editor UI

- [x] **Prompt assembler:** In `public/js/app-ui/anytale/prompt-assembler.mjs`, update `expandPageTags`, `assemblePrompt`, and `assemblePartPreviewPrompt` to use `config.referenceTag` instead of `config.name` for prompt token substitution and baseline deduplication.
- [x] **Part editor fields:** In `public/js/app-ui/anytale/part-item.mjs`, add "Name" input (`name` field, display name) as the first field above "Reference Tag" (`referenceTag` field, formerly "Name"); update `anytale-state.mjs` part defaults accordingly.
- [x] **Outfit description field:** In `public/js/app-ui/anytale/outfit-section.mjs`, add a "Description" textarea below the outfit "Name" field; update `anytale-state.mjs` outfit defaults to include `description: ''`.
- [x] **Genre hidden toggle:** In `public/js/app-ui/anytale/music-section.mjs`, add a "Hidden from AnyTale Play" toggle as the very first field in the genre edit form (before "Genre Name"), bound to `genre.disabled`.
- [x] **Character profile fields:** In `public/js/app-ui/anytale/character-section.mjs`:
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

### Phase 6 — LLM text generation buttons

- [ ] **Config migration:** Add `scripts/migrate/config/1-to-2.mjs` that sets `config.anytale.generateText` from the default values if absent; bump `config.currentVersion` to 2 in `server/core/data-versions.mjs`.
- [ ] **Character editor — selfProfile generate button:** In `public/js/app-ui/anytale/character-section.mjs`, extend the `/anytale/config` fetch (or add one if absent) to read `generateText` into local state. Wrap the "Self Profile" `Input` in a `HorizontalLayout`; add a styled `div` with `padding-bottom: 4px` containing an icon-only `Button` (icon: `caption`) to the right. On click, fill `{{name}}` and `{{personality}}` into `generateText.templates.selfProfile`, POST to `/api/chat` with `{ model: generateText.model, messages: [{ role: 'user', content: filledTemplate }], stream: false, mode: 'chat' }`, and apply `response.message.content` to `character.selfProfile`. Disable the button when `generateText` config is absent or a generation is in flight.
- [ ] **Character editor — voiceProfile generate button:** Same pattern in `character-section.mjs` for the "Voice Profile" `Input`. Fill `{{personality}}` into `generateText.templates.voiceProfile`, POST to `/api/chat`, apply result to `character.voiceProfile`.
- [ ] **Outfit editor — description generate button:** In `public/js/app-ui/anytale/outfit-section.mjs`, extend the `/anytale/config` fetch to read `generateText`. Wrap the "Description" `Input` in a `HorizontalLayout`; add the same styled icon button. On click, fill `{{name}}` (outfit name) and `{{parts}}` (comma-separated list of `libraryParts.find(p => p.uid === op.partUid)?.name || ''` for each `outfit.parts` entry, filtered to non-empty) into `generateText.templates.outfitDescriptions`, POST to `/api/chat`, apply result to `outfit.description`.

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

### Config migration (config v1 → v2)

```js
// scripts/migrate/config/1-to-2.mjs
export const fromVersion = 1;
export const toVersion = 2;

export function migrate(config) {
  const anytale = config.anytale ?? {};
  if (!anytale.generateText) {
    anytale.generateText = {
      model: 'ssfdre38/gemma4-nano:latest',
      templates: {
        selfProfile: 'You are {{name}}, with the following personality profile: {{personality}}. Write a single sentence describing yourself on a dating profile, using the personality profile as a guide. Do not use more than 20 words.',
        voiceProfile: 'Write two lines of text as a description of the vocal characteristics of a character with the following personality profile: {{personality}}. \n\nUse the following example as a template:\nA female voice, clear and natural, moderate speed, stable tone, suitable for news broadcasting or daily conversation.\n\nALWAYS start the output with either \"A female voice\" or \"A male voice\". Output the vocal characteristics as prose ONLY.',
        outfitDescriptions: 'Write a short, one line description for an outfit named {{name}}, consisting of the following parts: {{parts}}. Do not use more than 20 words.',
      },
    };
  }
  return { ...config, anytale };
}
```

### LLM text generation — button layout

Each generate button uses the same layout:
```
<HorizontalLayout align="end" gap="small">
  <Input ... widthScale="full" />           ← grows to fill
  <StyledGenerateDiv>                        ← padding-bottom: 4px, flex-shrink: 0
    <Button variant="icon" icon="caption" onClick=... disabled=... />
  </StyledGenerateDiv>
</HorizontalLayout>
```

### LLM text generation — request shape

```js
const filled = template
  .replace('{{name}}', name)
  .replace('{{personality}}', personality)
  .replace('{{parts}}', parts);

const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: generateText.model,
    messages: [{ role: 'user', content: filled }],
    stream: false,
    mode: 'chat',
  }),
});
const data = await res.json();
// data.message.content → apply to field
```

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
