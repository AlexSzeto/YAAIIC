# Character & Outfits Split

## Goal

Split the AnyTale character data into two entities — **characters** (personality, portrait, voice, body/head parts) and **outfits** (name + clothing/accessory parts) — each stored server-side with their own endpoints. Expand the "Character" tab into "Character & Outfits" with both editors stacked vertically, each with its own save/delete/clear actions. When generating, parts from both are merged (outfit parts win on conflict). Add a preferred-outfits list to characters and a description field to plots.

## Tasks

- [x] Add `outfits` CRUD to `server/features/anytale/repository.mjs`
  - Add `outfits` array to the `readData` default shape: `{ parts: [], plot: [], characters: [], outfits: [] }`
  - Add `listOutfits`, `upsertOutfit(uid, outfit)`, `deleteOutfit(uid)` — mirror the character CRUD pattern

- [x] Add outfit service functions to `server/features/anytale/service.mjs`
  - Add `getAllOutfits`, `saveOutfit(uid, outfit)`, `removeOutfitByUid(uid)` — each delegates to the matching repository function

- [x] Add outfit endpoints to `server/features/anytale/router.mjs`
  - `GET /anytale/outfits` — returns all outfits
  - `PUT /anytale/outfits/:uid` — upsert an outfit; body is `{ uid, name, parts }`
  - `DELETE /anytale/outfits/:uid` — delete an outfit
  - Mirror the error-handling pattern of the existing character endpoints
  - Test: `curl http://localhost:3000/anytale/outfits`, then `curl -X PUT ... /anytale/outfits/test-uid -d '{"uid":"test-uid","name":"Test","parts":[]}'`, then `curl -X DELETE .../test-uid`

- [x] Add `preferredOutfits` field to character state in `server/features/anytale/repository.mjs` (no structural change needed — the field is just passed through as part of the character object; confirm `upsertCharacter` already stores it verbatim)

- [x] Add outfit localStorage state to `public/js/app-ui/anytale/anytale-state.mjs`
  - Add `OUTFIT_STORAGE_KEY = 'anytale-outfit'`
  - Add `createBlankOutfit()` returning `{ uid: '', name: '', parts: [] }` (parts use the same `{ partUid, categoryAttributeValues, customAttributeValues, previewImageUrl }` shape as character parts)
  - Add `loadOutfit()`, `saveOutfitState(outfit)`, `clearOutfitState()` — mirror the character state helpers

- [x] Update character state helpers in `anytale-state.mjs` to include `preferredOutfits`
  - `createBlankCharacter` should include `preferredOutfits: []`
  - `loadCharacter` should deserialise `preferredOutfits: Array.isArray(parsed.preferredOutfits) ? parsed.preferredOutfits : []`

- [x] Add `description` field to plot state in `anytale-state.mjs`
  - `createBlankPlot` should include `description: ''`
  - `loadPlot` should deserialise `description: parsed.description ?? ''`

- [x] Create `public/js/app-ui/anytale/outfit-api.mjs`
  - Mirror `character-api.mjs` with functions: `fetchOutfitList`, `saveOutfit(uid, outfit)`, `deleteOutfit(uid)`
  - No portrait/voice generation endpoints needed for outfits

- [x] Create `public/js/app-ui/anytale/outfit-section.mjs`
  - Structure (top to bottom):
    1. `H2` "Outfit"
    2. Load outfit `AutocompleteInput` (label "Load Outfit", options from `outfitList`, selects by name, loads outfit state)
    3. `Input` for outfit name
    4. `H3` "Parts"
    5. Recommended-parts label (lists missing types from `recommendedOutfitPartTypes` from `/anytale/config`; hidden when all present)
    6. `AutocompleteInput` to add a part from the library by name (filtered or unfiltered — same pattern as character section)
    7. `DynamicList` of `CharacterPartItem` entries for outfit parts
    8. `ButtonRow` with Save, Delete, Clear buttons (Save disabled when no uid/name; Delete disabled when not saved; Clear always enabled)
  - State: load/save outfit to localStorage via `loadOutfit` / `saveOutfitState`; maintain `outfitList` from server; track `libraryOutfit` (last-saved server copy) for unsaved-change detection
  - Props: `libraryParts`, `onLibraryPartsChange` (same as CharacterSection)
  - On Save: PUT to `/anytale/outfits/:uid`; generate a uid from name if blank using the same slug pattern as parts (`name.toLowerCase().replace(/\s+/g, '-')`)
  - On Delete: confirm dialog → DELETE `/anytale/outfits/:uid` → clear state
  - On Clear: confirm dialog → `clearOutfitState()` → reset to blank outfit

- [x] Add `preferredOutfits` chip input to `public/js/app-ui/anytale/character-section.mjs`
  - Fetch outfit list from `/anytale/outfits` on mount; store in local state `outfitList`
  - Add a `ChipAutocompleteInput` between the personality `Input` and the portrait/voice `ButtonRow`
  - Label: "Preferred Outfits"; autocomplete options are outfit names; stored value is an array of outfit UIDs
  - When a chip is selected by name, resolve to the matching outfit's uid; display chip label as outfit name (resolve from outfitList)
  - Update `handleFieldChange` / save logic to persist `preferredOutfits` alongside other character fields

- [x] Remove the generation controls from `CharacterSection` and keep only Save/Delete/Clear
  - The sticky bottom section of `character-section.mjs` currently contains: prompt preview, plot autocomplete, Generate button, and Save/Delete/Clear buttons
  - Remove the prompt preview, plot autocomplete, and Generate button from `CharacterSection`
  - Keep only the Save / Delete / Clear `ButtonRow` at the bottom of the scroll area (or as a non-sticky footer)
  - Remove the `onGenerate`, `isGenerating`, and `plotList` props from `CharacterSection` (they will no longer be needed here); remove `previewPlotName` / `previewPlotUid` state

- [x] Add `description` input to `public/js/app-ui/anytale/plot-section.mjs`
  - Add a `description` string field to the active plot state (loaded via `loadPlot` / `createBlankPlot`)
  - Add a `Textarea` or `Input` (label "Description") below the plot section-name `AutocompleteInput` and above the pages area
  - Persist `description` when saving the plot to the server via `savePlot`

- [x] Refactor `public/js/app-ui/anytale/anytale-form.mjs` to host both editors and merged generation
  - Rename the "Character" tab to "Character & Outfits"
  - In the "Character & Outfits" tab: render `<CharacterSection>` followed immediately by `<OutfitSection>` (stacked vertically, each with its own scroll area and action buttons)
  - Move generation controls (prompt preview + Generate button) to a dedicated "Generation" section at the bottom of the "Parts & Plot" tab, replacing the current combined "Generation and Actions" section; the Generate button in this section merges parts from both character and outfit state
  - **Part merging for generation**: build the merged parts map by first spreading character parts (keyed by `partUid`), then overlaying outfit parts (outfit wins on duplicate `partUid`); pass the merged array as `partsData` to `onGenerate`
  - **Import routing**: when importing parts from a displayed image, route each part to character or outfit based on its library type:
    - If any of the part's `type` values is in `recommendedCharacterPartTypes` → add to character parts
    - If any of the part's `type` values is in `recommendedOutfitPartTypes` → add to outfit parts
    - If no type matches either list → add to both character and outfit parts
    - Fetch `recommendedCharacterPartTypes` and `recommendedOutfitPartTypes` from `/anytale/config` during import (already fetched at mount in current code — reuse that)
  - Remove the `characterImportFnRef` pattern; import now always routes to character+outfit directly in `handleImport` without delegating to `CharacterSection`
  - Pass `libraryParts` and `onLibraryPartsChange` down to `OutfitSection`
  - Remove `plotList` prop passed to `CharacterSection` (no longer needed after its generation section is removed)
  - Generation validation: no uid or parts-count check required; always attempt generation (same as today but without the character uid guard)
- [x] Show voice transcript below the audio player in `public/js/app-ui/anytale/character-section.mjs`
  - Below the `AudioPlayer` for `character.audioUrl`, render `character.introTranscript` as a read-only text block when it is non-empty
  - Style it using the same font style as the plot-selected label (small font size, secondary text color — match the `PromptPreview` / secondary label style already used in the section)
