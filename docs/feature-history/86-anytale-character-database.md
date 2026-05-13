# AnyTale Character Database

## Goal

Allow users to create and persist named characters in the AnyTale editor. Each character stores a name, personality profile, portrait and audio URLs, an intro transcript, and a saved snapshot of attribute values for a set of parts. Characters can be loaded, generated, saved, updated, and deleted from a dedicated tab in the AnyTale right-column panel.

## Bugs
[x] Character parts attribute selection input should be a dropdown (custom-ui select), not an autocomplete input
[x] The debounce is not working correctly. Every input is triggering a generation request. Also, while a preview generation is in progress, all subsequent requests should be ignored.
[x] The audioURL data should be show in the UI as an audio preview. It is disabled when an audio URL is not yet available.
[x] Use a valid microphone icon for the generate voice button
[x] The autocomplete hint data for the Preview Plot input is broken - there should be no server fetching to obtain this info after the UI loads completely. If the data is missing, load it on initial page load and update it when plots are saved in the Parts and Plot tab.

On the anytale page, character tab:
[x] restore the hover definition previews of the attribute inputs from the Parts and Plot tab counterpart
[x] restore the click to see full sized image action for all image previews (including the portrait preview and parts preview). Standardized this as an app-ui component and reuse it throughout the anytale page.
[x] remove the prompt preview section of the text in the Generation and Actions section, keeping only the current plot name as the only visible info.
[x] voice generation failed:
```
Error in task task_1778645664576_viiggypnm: Error: audioFormat is required for audio workflows but not found in generation data. Check workflow configuration and extra inputs.
    at processGenerationTask (file:///F:/YAAIIC/server/features/generation/orchestrator.mjs:479:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async file:///F:/YAAIIC/server/features/anytale/router.mjs:263:20
Buffered error-event message for task task_1778645664576_viiggypnm (no clients connected yet)
Error generating voice for anytale character: Error: audioFormat is required for audio workflows but not found in generation data. Check workflow configuration and extra inputs.
    at processGenerationTask (file:///F:/YAAIIC/server/features/generation/orchestrator.mjs:479:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async file:///F:/YAAIIC/server/features/anytale/router.mjs:263:20
Cleaned up task task_1778645378152_dfyotiu2m
```
it is missing default inputs from the selected workflow like other attempts at manully triggering workflows.

## Tasks

- [x] Add `anytale` section to `config.default.json` and `config.json` with: `portraitWorkflow` (default `"Text to Image (Illustrious Portrait)"`), `generationWorkflow` (default `"Text to Image (Illustrious Portrait)"`), `voiceWorkflow` (default `"Personality to Voice Design (Qwen3-TTS)"`), `portraitBasePrompt` (default `""`), and `portraitParts` (default `[]` — array of name/type matchers used to select parts for portrait generation; each entry is a string matched against a library part's `name` or any value in its `type` array).
- [x] Add `characters` array to the AnyTale repository (`server/features/anytale/repository.mjs`): `listCharacters`, `upsertCharacter(uid, character)`, `deleteCharacter(uid)`. Persist to `anytale-data.json` alongside `parts` and `plot`.
- [x] Add REST endpoints for characters to `server/features/anytale/router.mjs`: `GET /anytale/characters`, `PUT /anytale/characters/:uid`, `DELETE /anytale/characters/:uid`. Mirror the existing parts endpoint pattern.
- [x] Add a `POST /anytale/characters/:uid/generate-portrait` endpoint that uses config `anytale.portraitParts` (name/type matchers) to select matching parts from the library, assembles their tags from the character's saved attribute values, prepends `anytale.portraitBasePrompt`, sends a sync generation request using `anytale.portraitWorkflow`, and returns `{ portraitUrl }`.
- [x] Add a `POST /anytale/characters/:uid/generate-voice` endpoint that sends a sync generation request using `anytale.voiceWorkflow` with the character's personality as the prompt, and returns `{ audioUrl, transcript }` (mapped from the workflow result's `audioUrl` and `summary` fields).
- [x] Add character state helpers to `anytale-state.mjs`: `loadCharacter()`, `saveCharacterState(character)`, `createBlankCharacter()`. Character shape: `{ uid, name, personality, portraitUrl, audioUrl, introTranscript, parts: [ { partUid, categoryAttributeValues, customAttributeValues } ] }`.
- [x] Create `public/js/app-ui/anytale/character-api.mjs` with `fetchCharacterList()`, `saveCharacter(uid, character)`, `deleteCharacter(uid)`, `generateCharacterPortrait(uid, parts)`, `generateCharacterVoice(uid, personality)`. Mirror `plot-api.mjs`.
- [x] Create `public/js/app-ui/anytale/character-part-item.mjs` — a simplified part form for the Character tab. Renders a 128×128 preview image (display-only, auto-regenerated) and a flat list of labelled attribute value inputs (one per `categoryAttribute` and `customAttribute` from the library config). On mount and after any attribute value change (300 ms debounce), trigger an automatic preview regeneration via `/generate/sync` using `assemblePartPreviewPrompt`. Accepts props: `part` (character part entry merged with library config), `libraryConfig` (full part config from library), `onPartChange(updated)`.
- [x] Create `public/js/app-ui/anytale/character-section.mjs` — the full Character tab component. Structure:
  - **Character section** (`H2` "Character"): Name `Input`, Personality `Input` (multi-line / `widthScale="full"`), Portrait preview (128×128, same style as parts preview, URL stored in `portraitUrl`), Audio URL `Input`, hidden intro transcript stored in state (not visible in UI). Below these fields: two buttons in a `ButtonRow` — **Generate Portrait** (primary, icon `"image"`) that calls `generateCharacterPortrait` and populates `portraitUrl`; **Generate Voice** (secondary, icon `"volume-2"`) that calls `generateCharacterVoice` and populates `audioUrl` and `introTranscript`.
  - **Parts section** (`H2` "Parts"): `AutocompleteInput` "Add Part from Library", then a `DynamicList` using `CharacterPartItem` for each character part. Part titles show the part name. Parts are matched to library configs by `partUid`.
  - **Sticky "Generation and Actions" section** (`H2` "Generation and Actions"): `AutocompleteInput` for preview plot name (searches `/anytale/plot` list; selection stored in local component state only, not in saved character data). A styled label below showing the active preview plot name (same font size/style as `PromptPreview` in the other tab). Then a `ButtonRow` with: **Generate** (primary, icon `"play"`) — calls `onGenerate` with a prompt assembled from the character's parts attribute values and page 0 of the selected preview plot; **Save/Update** (primary, icon `"save"`, context-aware disabled state matching PlotSection); **Delete** (secondary, icon `"trash"`, disabled if not in library); **Clear** (secondary, icon `"x"`).
  - Accepts props: `libraryParts`, `onGenerate`, `isGenerating`, `onLibraryPartsChange`.
- [x] In `anytale-form.mjs`, track whether any part preview is currently generating. Expose this as an `isAnyPreviewGenerating` boolean derived from the existing `generatingPreviews` state (truthy if any key is present). Pass it as a prop to the Parts & Plot tab content and use it to: (a) show a loading overlay or spinner on the preview image of the part currently generating (already done by `headerActions`), and (b) disable ALL Generate buttons (preview or main image generate buttons) while any preview is in-flight.
- [x] Restore the tab interface in `anytale-form.mjs`. Replace the current single-panel render with a `TabPanels` component (from `custom-ui/nav/tab-panels.mjs`) with two tabs: **"Parts & Plot"** (all existing `editContent`) and **"Character"** (renders `CharacterSection`). Manage `activeTab` state in `AnyTaleForm`. Pass `libraryParts` and `onGenerate`/`isGenerating` down to `CharacterSection`. When `refreshLibraryParts` runs, the updated `libraryParts` state flows into `CharacterSection` automatically via props.
- [x] Wire the Character tab's **Generate** action: in `AnyTaleForm`, when `CharacterSection` calls `onGenerate`, retrieve the selected preview plot by UID from `/anytale/plot/:uid`, use page index 0, assemble the prompt from character part values + that plot page (reuse `assemblePrompt`), then call the parent `onGenerate` callback with the assembled prompt and character name — matching the same signature as the existing `handleGenerate`.

## Implementation Details

### Config shape (`config.default.json` addition)
```json
"anytale": {
  "portraitWorkflow": "Text to Image (Illustrious Portrait)",
  "generationWorkflow": "Text to Image (Illustrious Portrait)",
  "voiceWorkflow": "Personality to Voice Design (Qwen3-TTS)",
  "portraitBasePrompt": "1girl, solo, portrait, looking at viewer, outdoors",
  "portraitParts": ["head"]
}
```
`portraitParts` is an array of name/type matcher strings. At generation time the server checks each library part's `name` and `type` array against these matchers (case-insensitive); all matches are included. This allows config entries like `"character-body"` (matches by name) or `"body"` (matches any part whose type array contains `"body"`).

### Character data shape (stored in `anytale-data.json` under `"characters"` array)
```json
{
  "uid": "alice",
  "name": "Alice",
  "personality": "...",
  "portraitUrl": "/storage/...",
  "audioUrl": "/storage/...",
  "introTranscript": "...",
  "parts": [
    {
      "partUid": "character-body",
      "categoryAttributeValues": { "Hair Colour": "blonde" },
      "customAttributeValues": { "Style Notes": "..." }
    }
  ]
}
```

### Character localStorage key
- `anytale-character` — active character state (parallel to `anytale-plot`)

### `POST /anytale/characters/:uid/generate-portrait` request body
```json
{ "parts": [ { "partUid": "...", "categoryAttributeValues": {}, "customAttributeValues": {} } ] }
```

### `POST /anytale/characters/:uid/generate-portrait` server flow
1. Read `config.anytale.portraitParts` (array of name/type matcher strings).
2. For each library part, check if its `name` or any entry in its `type` array case-insensitively matches any entry in `portraitParts`. Collect all matching parts; if none match, the prompt is assembled from the base prompt only.
3. For each matched library part, find the corresponding entry in the request body's `parts` array by `partUid`. Assemble tags from those attribute values merged with the part's baseline using the existing prompt assembly logic. Prepend `config.anytale.portraitBasePrompt`.
4. Call `processGenerationTask` (silent mode) with `config.anytale.portraitWorkflow`. Extract `imageUrl` → `portraitUrl`.
5. Return `{ portraitUrl }`.

### `POST /anytale/characters/:uid/generate-voice` request body
```json
{ "personality": "brave and witty" }
```

### `POST /anytale/characters/:uid/generate-voice` server flow
1. Call `processGenerationTask` (silent mode) with `config.anytale.voiceWorkflow`, using `personality` as the `prompt`.
2. Extract `audioUrl` and `summary` → `transcript`.
3. Return `{ audioUrl, transcript }`.

### Auto-preview debounce in `CharacterPartItem`
- Use `useEffect` watching attribute value changes with a `useRef` debounce timer.
- Debounce delay: 1000 ms.
- Call `/generate/sync` using the same payload shape as `handlePreviewGenerate` in `anytale-form.mjs` (workflow: `"Text to Image (Illustrious Portrait)"`, `assemblePartPreviewPrompt`).
- Update `previewImageUrl` on the character part via `onPartChange`.
- Show a loading indicator on the 128×128 preview while the request is in-flight.

### Part config sync between tabs
- `libraryParts` is already fetched and managed in `AnyTaleForm`.
- `CharacterSection` receives `libraryParts` as a prop; `CharacterPartItem` receives the matching `libraryConfig` entry.
- `CharacterPartItem` renders attribute inputs derived from `libraryConfig.categoryAttributes` and `libraryConfig.customAttributes`, showing `part.categoryAttributeValues[attr.name]` / `part.customAttributeValues[attr.name]` as the current values.
- When `libraryParts` updates, `CharacterPartItem` re-renders with fresh attribute definitions. Values for attributes that no longer exist are retained in state but not displayed.

### Tab structure in `anytale-form.mjs`
- `activeTab` state defaults to `'parts-plot'`.
- Tab IDs: `'parts-plot'` and `'character'`.
- `TabPanels` `variant` prop: `'outlined'` (replaces the current `Panel` wrapper).
- The existing `Panel` wrapping the form is removed; `TabPanels` provides its own panel body.

### Manual test instructions
- **Config**: Add `"anytale": { "portraitParts": ["body", "face"], "portraitBasePrompt": "test prompt" }` to `config.json` (using name or type values matching parts in your library) and restart the server.
- **Character CRUD endpoints**:
  - `curl -X PUT http://localhost:3000/anytale/characters/alice -H "Content-Type: application/json" -d '{"uid":"alice","name":"Alice","personality":"cheerful","parts":[]}'` → expect `{ saved: {...} }`
  - `curl http://localhost:3000/anytale/characters` → expect array containing Alice
  - `curl -X DELETE http://localhost:3000/anytale/characters/alice` → expect `{ deleted: "alice" }`
- **Generate portrait endpoint**: `curl -X POST http://localhost:3000/anytale/characters/alice/generate-portrait -H "Content-Type: application/json" -d '{"parts":[]}'` → expect `{ portraitUrl }`.
- **Generate voice endpoint**: `curl -X POST http://localhost:3000/anytale/characters/alice/generate-voice -H "Content-Type: application/json" -d '{"personality":"brave and witty"}'` → expect `{ audioUrl, transcript }`.
- **Character tab UI**: Open AnyTale page, verify two tabs "Parts & Plot" and "Character" appear. Switch to Character tab, fill name + personality. Click "Generate Portrait" — portrait image should populate. Click "Generate Voice" — audio URL and transcript should populate. Add a part from library — verify its attribute inputs render. Edit an attribute value — verify preview image regenerates automatically after ~300 ms.
- **Generate from Character tab**: Select a preview plot in the autocomplete, click Generate — verify a gallery generation fires using the character's parts and the plot's page 1.
- **Save/Update/Delete/Clear**: Save a character, reload page, verify it appears in the load autocomplete. Modify a field and verify the button switches to "Update" and becomes active. Delete and verify removal from the list.
