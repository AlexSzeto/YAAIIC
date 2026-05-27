# AnyTale Feature

AnyTale is a character creation and scene generation system. Users build characters from modular parts (body features, clothing, accessories), assign outfits, attach plot pages, and generate portrait images, voice audio, and scene images via ComfyUI workflows.

## User Flow

```
Parts Library → Character Builder → Generate Portrait / Voice
                     ↓
              Plot Section → Generate Scene Image
```

1. **Parts library** (`/anytale/parts`): define reusable part templates (head shape, clothing items, etc.) with selectable attributes and preview baselines.
2. **Character section**: create or load a character, attach parts from the library, set attribute values per part, configure personality text, assign preferred outfits.
3. **Portrait generation**: assemble prompt from matched portrait parts + attribute values → queue `anytale-render-portrait` generation → result saved to character's `portraitUrl`.
4. **Voice generation**: send character `personality` + `name` to the voice workflow → result saved to character's `audioUrl` and `introTranscript`.
5. **Outfit section**: create named outfits as part-override sets; attach to characters via `preferredOutfits`. Optionally generate a render image for the outfit via `anytale-render-outfit`; specify preferred location parts via `preferredLocations`.
6. **Plot section**: create plot blocks with pages, each page having prompt tags, dialog prompts, slot actions, and per-part hidden flags; select a plot page to inject its tags into scene generation.
7. **Scene generation**: assembled prompt (character parts + active plot page tags) feeds the standard generation queue.

## Component Map

```
app-ui/anytale/
  anytale.mjs                  — page root; mounts all three sections
  anytale-form.mjs             — top-level form layout (tabs/panels)
  anytale-viewer.mjs           — left-column image viewer; shows plot name/page overlay on images with plot metadata
  character-section.mjs        — character CRUD + part assignment UI; selfProfile/voiceProfile fields + AI generation buttons
  character-part-item.mjs      — single part row within character editor
  outfit-section.mjs           — outfit CRUD + part-override editor; description field + AI generation button
  part-item.mjs                — single part row in the parts library editor; "Name" (display) + "Reference Tag" (prompt token) fields
  library-part-picker.mjs      — modal to pick a part from the library
  category-input.mjs           — tag-type input for part categories
  plot-section.mjs             — plot block list + page editor; dialog preview per page; bulk dialog on Queue Plot
  plot-page-pills.mjs          — two-section pill UI: slots (transitions + requirements) and parts (hidden toggle + requirements)
  plot-requirements-editor.mjs — plot-level entry requirements editor (slot types + auto-populated library parts; no Add Part button)
  plot-api.mjs                 — client-side API calls for plot CRUD
  character-api.mjs            — client-side API calls for character CRUD
  outfit-api.mjs               — client-side API calls for outfit CRUD
  anytale-state.mjs            — localStorage persistence for active character/plot/outfit
  prompt-assembler.mjs         — builds final prompt string from parts + plot; expandPageTags (image); expandDialogPrompt (dialog)
  prompt-import.mjs            — imports prompt tags back into part attribute values
  slot-resolver.mjs            — resolves which parts fill which body slots
  image-preview.mjs            — part preview image (hash-based idempotent caching)
  music-section.mjs            — Music tab: genre CRUD (with disabled toggle), track sub-lists, BGM player bar, playlist modal
```

### State architecture

Active editor state (the character/plot/outfit currently being edited) lives in `sessionStorage` via `anytale-state.mjs` — not in server DB. Server DB holds the saved records. On save, the client POSTs/PUTs to the server then optionally refreshes the local state.

The `anytale-parts-coverage` key in `sessionStorage` holds a `{ [partKey]: boolean }` map for the temporary partial-coverage setting in the Parts & Plot tab. This is session-local and intentionally not saved to the server.

## Server Endpoints

All routes are defined in `server/features/anytale/router.mjs`, business logic in `service.mjs`, persistence in `repository.mjs`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/anytale/config` | Returns anytale config from `config.json` + `anytale-rules.txt` slot rules |
| GET | `/anytale/parts` | List all parts |
| POST | `/anytale/parts` | Create part (server assigns UUID) |
| PUT | `/anytale/parts/:uid` | Update part |
| DELETE | `/anytale/parts/:uid` | Delete part |
| GET | `/anytale/plot` | List plot summaries `{ uid, name, section }` |
| GET | `/anytale/plot/:uid` | Fetch full plot block |
| PUT | `/anytale/plot/:uid` | Upsert plot block |
| DELETE | `/anytale/plot/:uid` | Delete plot |
| GET | `/anytale/characters` | List all characters |
| POST | `/anytale/characters` | Create character |
| PUT | `/anytale/characters/:uid` | Update character |
| DELETE | `/anytale/characters/:uid` | Delete character |
| POST | `/anytale/characters/:uid/render-portrait` | Queue portrait generation |
| POST | `/anytale/outfits/:uid/render-outfit` | Queue outfit render image generation |
| POST | `/anytale/characters/:uid/generate-voice` | Queue voice generation |
| GET | `/anytale/outfits` | List all outfits |
| POST | `/anytale/outfits` | Create outfit |
| PUT | `/anytale/outfits/:uid` | Update outfit |
| DELETE | `/anytale/outfits/:uid` | Delete outfit |
| POST | `/anytale/generate-part-preview` | Queue part preview image (hash-named, idempotent) |
| POST | `/anytale/request-part-preview` | Check if cached preview exists for a prompt |
| GET | `/anytale/genres` | List all genres (with nested tracks) |
| POST | `/anytale/genres` | Create genre (server assigns UUID) |
| PUT | `/anytale/genres/:uid` | Update genre (including nested tracks array) |
| DELETE | `/anytale/genres/:uid` | Delete genre and all nested tracks |
| POST | `/anytale/genres/:uid/generate-track` | Queue AceStep track generation; result auto-saved to genre |

### Config keys (`config.json` → `anytale` block)

| Key | Purpose |
|-----|---------|
| `portraitWorkflow` | Workflow name for portrait generation (default: `'Text to Image (Illustrious Portrait)'`) |
| `portraitBasePrompt` | Prompt prefix prepended to every portrait |
| `portraitParts` | Array of part names/types to include in portrait prompts |
| `voiceWorkflow` | Workflow name for voice generation |
| `partPreviewWorkflow` | Workflow name for part preview images |
| `musicWorkflow` | Workflow name for AceStep music generation (default: `'AceStep Music Generation'`) |
| `defaultMusicLength` | Default generated track length in seconds (default: `120`) |
| `dialog` | Dialog generation config: `{ model, systemMessage, parameters, mode, format, stream }` |
| `dialogPreview` | Preview character for the plot editor's "Preview Dialog" button: `{ name, profile, location }`. `name` → `{{name}}` slot; `profile` → `{{profile}}` slot; `location` → `{{location}}` slot. Outfit is assembled dynamically from enabled non-character parts. If absent or `name`/`profile` are empty, the button is disabled. |
| `generateText` | LLM text generation config: `{ model, templates: { selfProfile, voiceProfile, outfitDescriptions } }`. Drives the AI-generate buttons next to selfProfile, voiceProfile, and outfit description fields. |

## Key Data Shapes

See `@typedef` declarations in `server/features/anytale/repository.mjs` for authoritative types: `PartConfig`, `PartAttribute`, `PlotBlock`, `PlotPage`, `Character`, `CharacterPart`, `Outfit`.

### PartConfig name vs. referenceTag

Parts carry two separate name fields:
- **`referenceTag`** — the prompt token injected into image generation (e.g. `"white_shirt"`). Used by `expandPageTags`, `assemblePrompt`, and `assemblePartPreviewPrompt`.
- **`name`** — the human display name shown in the UI and in dialog prompt expansion (e.g. `"White Shirt"`). Used by `expandDialogPrompt`.

Prior to anytale-data v5, there was a single `name` field used for both purposes. The v4→v5 migration renamed the old `name` to `referenceTag` and seeded an empty `name` for the display label.

### PlotBlock shape (selected fields)

```js
{
  slotRequirements: Record<string, 'present'|'absent'>,
  // Keys are slot type strings (e.g. 'outer upper body') or part UIDs.
  // 'present': slot must be covering or revealing; 'absent': slot must be removed or not in use.
  // Used as plot-level entry requirements for play mode bootstrap.
  // Editor UI: all library parts auto-populate as pills cycling ignore → present → absent.
  // Orphan UIDs (part deleted from library) persist until cycled back to ignore.
}
```

### PlotPage shape

```js
{
  tags: string,              // prompt tags injected during generation for this page
  dialogPrompt: string,      // prompt for generating dialog on this page
  requirements: string[],    // gate conditions: slot type strings or part names; all must be met for the page to be reachable
  actions: [                 // slot transitions applied when this page is reached (replayed by resolveSlotStatuses)
    { slot: string, status: 'covering' | 'revealing' | 'removed' }
  ],
  hiddenParts: string[],     // part UIDs excluded from final prompt assembly for this page
  // Hidden parts still count toward slot status resolution and requirements checking.
  // Only excluded at the final assemblePrompt step (after all slot logic runs).
}
```

### Page rendering pipeline

The pipeline runs in `anytale-form.mjs` (editor) and play mode for every generated image.

1. **Build enabled parts with coverage** — filter `parts` where `data.enabled !== false`; overlay `config.isRevealing` from `getPartsCoverage()`.
2. **Resolve slot statuses** (`resolveSlotStatuses`) — initialize all slot types to `'removed'`; each enabled part upgrades its slots based on `isRevealing` (covering > revealing > removed); replay page `actions` from page 0 through current index.
3. **Apply slot visibility rules** (`applyRules`) — evaluate `anytale-rules.txt` ruleset (standard and forEach rules) against slot statuses; produce `Map<slot, boolean>`.
4. **Page requirements check** (`checkPageRequirements`) — uses slot statuses *before* the current page's actions; checks each requirement string against enabled parts. In the editor this drives the "requirements met / failed" badge; in play mode it gates page visibility (hidden pages still have their actions replayed).
5. **Assemble prompt** (`assemblePrompt`) — build `visibleParts` by filtering out: disabled parts, parts whose slot types are all invisible per step 3, and parts whose `config.uid` is in `page.hiddenParts`. Expand `page.tags` (resolving `{{type}}` tokens against visible parts), collect `baseline` + `attributeValues` per visible part, deduplicate.

Steps 1–4 always run against the *full* enabled parts list — `hiddenParts` only takes effect in step 5.

The **Queue Plot** button applies this same requirements check before queuing each page. Pages where requirements are not met are skipped (not queued and not locked); only passing pages are locked and sent to `onGenerate`. After queuing, `bulkDialogGenerate` is invoked automatically with the list of queued page indices (see Dialog Preview below).

### Dialog prompt template expansion

`dialogPrompt` strings support `{{slot type}}` tokens that are expanded before the prompt is sent to the LLM. The expansion uses `expandDialogPrompt(promptText, enabledParts)` from `prompt-assembler.mjs`:

- Matches tokens against `part.config.type` (case-insensitive).
- Substitutes the token with all matching parts' **display names** (`config.name`, not `config.referenceTag`) joined by `" and "`.
- If no parts match, substitutes an empty string.

This applies in both the plot editor's "Preview Dialog" button and in play mode's `queuePageDialog`.

Example: `"You're wearing a {{outer upper body}}"` → `"You're wearing a Shirt and Jacket"` (if the enabled parts with type `outer upper body` have display names "Shirt" and "Jacket").

### Dialog system message template slots

The `dialog.systemMessage` config string supports four substitution tokens filled by `renderSystemMessage` in `play-dialog.mjs`:

| Token | Source (editor preview) | Source (play mode) |
|---|---|---|
| `{{name}}` | `dialogPreview.name` | `session.character.name` |
| `{{profile}}` | `dialogPreview.profile` | `session.character.personality` |
| `{{location}}` | `dialogPreview.location` | First non-empty value in `session.location.attributeMap` (first attribute on the assigned location part) |
| `{{outfit}}` | `assemblePrompt` of enabled parts with at least one type in `recommendedOutfitPartTypes` | `assemblePrompt` of the session outfit's parts (all parts in `outfit.parts`, regardless of slot visibility) |

### Dialog preview system

The plot editor's **Preview Dialog** button (`plot-section.mjs`) generates dialog for the current page in context:

- Generates dialog sequentially from page 0 through the current page, skipping pages with empty `dialogPrompt`.
- Accumulates `{ role, content }` history so each page gets correct prior-turn context.
- Results stored in `dialogPreviews` state (keyed by page index); displayed below the button.
- Button is disabled if `dialogPrompt` is empty, `dialogConfig` is absent, or `dialogPreview.name`/`dialogPreview.profile` are empty.
- Dialog previews are cleared when a new plot is loaded or the plot is cleared.

**Queue Plot bulk dialog**: after queuing, `bulkDialogGenerate(queuedIndices)` runs the same sequential generation for every queued page index, replacing any existing previews.

### Outfit shape

```js
{
  uid: string,
  name: string,
  description: string,             // human-readable summary shown in play mode outfit picker subtitle
  parts: CharacterPart[],          // same part-override format as character parts
  preferredLocations: string[],    // UIDs of preferred location-typed parts; used by play mode bootstrap
  renderUrl: string,               // URL of the generated render image (server-set via render-outfit)
}
```

### Character shape (selected fields)

```js
{
  uid: string,
  name: string,
  personality: string,       // used for voice generation and dialog generation
  selfProfile: string,       // player-facing one-liner shown in play mode character pick subtitle
  voiceProfile: string,      // vocal characteristics description forwarded to the voice workflow
  audioUrl: string,          // URL of the generated voice sample (character intro)
  introTranscript: string,   // text spoken in the voice intro sample
  portraitUrl: string,
  parts: CharacterPart[],
  preferredOutfits: string[],
}
```

### Genre shape

```js
{
  uid: string,
  name: string,
  disabled: boolean,        // if true, excluded from play mode genre picks (unless all genres are disabled)
  musicPrompt: string,      // template; use {{variation}} as insertion point
  variations: string[],     // one picked randomly at track generation
  adjectives: string[],     // one picked randomly for track name
  nouns: string[],          // one picked randomly for track name
  keys: string[],           // subset of musical keys
  bpmMin: number,
  bpmMax: number,
  timeSignatures: string[], // subset of time signatures
  tracks: Track[],
}
```

### Track shape

```js
{
  uid: string,
  name: string,       // "[adjective] [noun]" assigned at generation
  key: string,
  bpm: number,
  timeSignature: string,
  audioUrl: string,
}
```

### Part types

Parts carry a `type: string[]` array. The `"location"` type identifies background/scene parts used in play mode to pick a scene location. Parts may carry multiple types (e.g. `["outer upper body", "inner upper body"]`).

### Partial Coverage (`isRevealing`)

`isRevealing` controls whether a part's slot starts in `'revealing'` status (partially covers the slot, still shows layers underneath) vs. `'covering'` (fully covers). It is **not** a field on `PartConfig` — it exists in two separate places depending on context:

| Context | Where stored | What drives it |
|---|---|---|
| Parts & Plot tab generation | `sessionStorage` key `anytale-parts-coverage` as `{ [partKey]: boolean }` | "Partial Coverage (temporary setting test)" checkbox at the top of each part form; survives page refresh within the tab but not across tabs |
| Character + Outfit tab generation and outfit renders | `CharacterPart.isRevealing` (persisted with the outfit) | "Partial Coverage (reveals parts underneath)" checkbox at the top of each outfit part's dynamic item |

The `anytale-parts-coverage` map is keyed by `config.uid` (for library parts) or the session-local `id` (for unsaved parts). Defaults to `false` for any key not present.

### Portrait prompt assembly

```
portraitBasePrompt
+ (for each matched library part that the character has):
    part.baseline
    + each non-empty attributeValues[attrName]
→ joined with ", "
```

Parts are matched against `portraitParts` matchers (config) by name or type, case-insensitive. Only parts the character has actually added (`requestParts`) are included.

### Part preview image caching

Preview images are named `portrait_<hash>.png` where hash = `portraitPromptHash(prompt)`. The endpoint checks if the file exists before queuing, making generation idempotent for identical prompts.

When `POST /anytale/request-part-preview` returns `found: false`, the client automatically:
1. Scans the queue for stale `anytale-part-preview` items whose `taskData.partUid` matches the part's library UID.
2. Deletes each stale item via `DELETE /queue/item/:id`.
3. Re-enqueues a fresh preview via `POST /anytale/generate-part-preview?queueOnly=true` with the part's current prompt and `partUid`.

This only applies to parts that have been saved to the library (i.e., have a `config.uid`).

### Queue integration

Portrait, voice, outfit render, and part preview generation are queued via the standard queue service. `endpointKey` values:

| endpointKey | Trigger | Orchestrator completion action |
|---|---|---|
| `anytale-render-portrait` | `POST /anytale/characters/:uid/render-portrait` | Sets `character.portraitUrl` |
| `anytale-voice` | `POST /anytale/characters/:uid/generate-voice` | Sets `character.audioUrl` + `introTranscript` |
| `anytale-render-outfit` | `POST /anytale/outfits/:uid/render-outfit` | Sets `outfit.renderUrl` |
| `anytale-part-preview` | `POST /anytale/generate-part-preview` | Saves `portrait_<hash>.png`; client matches via `taskData.partUid` |

Portrait, voice, and outfit render are in the orchestrator's `silent` set (no global notification popup on completion).

## Persistence

All four entity types (parts, plots, characters, outfits) are stored in `server/database/anytale-data.json`:

```json
{
  "parts": [ ...PartConfig ],
  "plot": [ ...PlotBlock ],
  "characters": [ ...Character ],
  "outfits": [ ...Outfit ]
}
```
