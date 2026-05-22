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
6. **Plot section**: create plot blocks with pages, each page having prompt tags, dialog prompts, and actions; select a plot page to inject its tags into scene generation.
7. **Scene generation**: assembled prompt (character parts + active plot page tags) feeds the standard generation queue.

## Component Map

```
app-ui/anytale/
  anytale.mjs              — page root; mounts all three sections
  anytale-form.mjs         — top-level form layout (tabs/panels)
  anytale-viewer.mjs       — read-only character viewer panel
  character-section.mjs    — character CRUD + part assignment UI
  character-part-item.mjs  — single part row within character editor
  outfit-section.mjs       — outfit CRUD + part-override editor
  part-item.mjs            — single part row in the parts library editor
  library-part-picker.mjs  — modal to pick a part from the library
  category-input.mjs       — tag-type input for part categories
  plot-section.mjs         — plot block list + page editor
  plot-api.mjs             — client-side API calls for plot CRUD
  character-api.mjs        — client-side API calls for character CRUD
  outfit-api.mjs           — client-side API calls for outfit CRUD
  anytale-state.mjs        — localStorage persistence for active character/plot/outfit
  prompt-assembler.mjs     — builds final prompt string from parts + plot
  prompt-import.mjs        — imports prompt tags back into part attribute values
  slot-resolver.mjs        — resolves which parts fill which body slots
  image-preview.mjs        — part preview image (hash-based idempotent caching)
```

### State architecture

Active editor state (the character/plot/outfit currently being edited) lives in `localStorage` via `anytale-state.mjs` — not in server DB. Server DB holds the saved records. On save, the client POSTs/PUTs to the server then optionally refreshes the local state.

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

### Config keys (`config.json` → `anytale` block)

| Key | Purpose |
|-----|---------|
| `portraitWorkflow` | Workflow name for portrait generation (default: `'Text to Image (Illustrious Portrait)'`) |
| `portraitBasePrompt` | Prompt prefix prepended to every portrait |
| `portraitParts` | Array of part names/types to include in portrait prompts |
| `voiceWorkflow` | Workflow name for voice generation |
| `partPreviewWorkflow` | Workflow name for part preview images |

## Key Data Shapes

See `@typedef` declarations in `server/features/anytale/repository.mjs` for authoritative types: `PartConfig`, `PartAttribute`, `PlotBlock`, `PlotPage`, `Character`, `CharacterPart`, `Outfit`.

### PlotPage shape

```js
{
  tags: string,              // prompt tags injected during generation for this page
  dialogPrompt: string,      // prompt for generating dialog on this page
  requirements: string[],    // gate conditions: slot type strings or part names; all must be met for the page to be reachable
  actions: [                 // slot transitions applied when this page is reached (replayed by resolveSlotStatuses)
    { slot: string, status: 'covering' | 'revealing' | 'removed' }
  ],
}
```

### Outfit shape

```js
{
  uid: string,
  name: string,
  parts: CharacterPart[],          // same part-override format as character parts
  preferredLocations: string[],    // UIDs of preferred location-typed parts; used by play mode bootstrap
  renderUrl: string,               // URL of the generated render image (server-set via render-outfit)
}
```

### Part types

Parts carry a `type: string[]` array. The `"location"` type identifies background/scene parts used in play mode to pick a scene location. Parts may carry multiple types (e.g. `["outer upper body", "inner upper body"]`).

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

### Queue integration

Portrait, voice, and outfit render generation are queued via the standard queue service. `endpointKey` values:

| endpointKey | Trigger | Orchestrator completion action |
|---|---|---|
| `anytale-render-portrait` | `POST /anytale/characters/:uid/render-portrait` | Sets `character.portraitUrl` |
| `anytale-voice` | `POST /anytale/characters/:uid/generate-voice` | Sets `character.audioUrl` + `introTranscript` |
| `anytale-render-outfit` | `POST /anytale/outfits/:uid/render-outfit` | Sets `outfit.renderUrl` |

All three are in the orchestrator's `silent` set (no global notification popup on completion).

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
