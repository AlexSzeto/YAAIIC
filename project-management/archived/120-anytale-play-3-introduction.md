# AnyTale Play Mode — Rollout 3: Introduction Flow & Image Generation

## Goal

Implement the complete introduction experience — from cold start bootstrap through all intro decision flows (character, outfit, background, music changes) with live image generation using the introduction plot. After this rollout, a user can open play mode, see their randomly selected character rendered in a neutral pose, customize their session through the two-tier intro menu, and see the image regenerate with each change.

> **External dependencies:** Outfit preview images must be implemented before outfit change flow works. Editor music tab must exist before music genre selection works. Both can be stubbed for initial testing.

> **Parent spec:** [`anytale-play-mode.md`](./anytale-play-mode.md)

## Tasks

- [x] **Cold start bootstrap:** On first visit (no session in localStorage), randomly select: character (from library), outfit (from character's preferred outfits), location part + random attribute values (from location-typed parts, respecting category/custom attribute option lists), music genre. Compute initial slot state from the selected character parts + outfit parts (`removed` if no part has that slot type; `revealing` if all parts with that slot type have `isRevealing: true` on the outfit part entry; `covered` otherwise). Store all selections and slot state in session. From plots with `section === 'prelude'` (case-insensitive), filter to those whose `slotRequirements` are satisfied by the initial slot state; pick randomly. If none satisfy slot requirements, fall back to any prelude-section plot. Store the selected plot in session. **Manual test:** clear localStorage, open play page, verify all selections are populated in session and different across multiple clears.

- [x] **Introduction plot config and lookup:** Read `anytale.introductionPlotName` from config (via `GET /anytale/config`). Look up the matching plot by name from the plot library. This is a fixed, 1-page plot for generating neutral pose character images. Fail with guidance message if not found. **Manual test:** set config to a valid plot name, verify lookup succeeds; set to invalid name, verify error message.

- [x] **Introduction image generation:** On cold start, assemble prompt from current character parts + outfit parts + location part + introduction plot page tags using `assemblePrompt`. Trigger image generation via the config-selected AnyTale workflow. Show loading spinner during generation. Display result in portrait area. **Manual test:** verify generated image appears after loading; image reflects the selected character/outfit/location.

- [x] **Introduction main page:** Display the introduction image with three decision options (no fourth): 'Let me meet someone else' → character change, 'The mood isn't right' → mood sub-page, 'Begin the tale' → store 'begin' intent (chapter entry is Rollout 4). Use caption bubble for any hint text. **Manual test:** all three options render, each navigates to correct flow.

- [x] **Introduction mood page:** Three options (no fourth): 'Maybe try on a different outfit?' → outfit change (3+1), 'Let's go somewhere else.' → location change, 'Let's listen to something different.' → music change. Completing any change returns to intro main page. **Manual test:** navigate to mood, pick each option, verify return to main page after completion.

- [x] **Character change flow:** Show three random characters (name, personality profile, preview portrait — skip portrait if character has none). Fourth option: 'Maybe someone else?' → reroll the trio. On pick: update session character, auto-select random outfit from new character's preferred outfits, regenerate intro image (block UI with spinner, fade from old to new image). **Manual test:** reroll changes all three cards; picking a character updates the image.

- [x] **Outfit change flow:** Show three random outfits (name, preview image). Fourth: 'Nevermind' → no change, return to mood page. On pick: update session outfit, regenerate intro image (block + fade). **Manual test:** picking an outfit updates the displayed image; 'Nevermind' returns without change.

- [x] **Location change flow:** Show three random location-typed parts. On pick, walk each attribute: three concrete options from the hydrated option list + fourth 'None of these' (leaves attribute null). After all attributes, update session location, regenerate intro image (block + fade). Return to intro main page. **Manual test:** skip an attribute with 'None of these', confirm the generated prompt omits that tag value.

- [x] **Music genre selection:** Show three genres from the music database. On pick, load random tracks from that genre's playlist into `globalBgmPlayer` and begin playback (crossfade from any currently playing track). Store the selected genre in session. Return to mood page. Does NOT trigger image regeneration. **Manual test:** pick a genre, verify music starts playing; pick another genre, verify crossfade transition.

- [x] **Session restoration on reload:** When play page loads with an existing session, restore the UI phase (intro main, mood, etc.) and re-display the cached introduction image if available. **Manual test:** make changes during intro, refresh page, verify same state is restored.

#### Fixes and Changes

- [x] **Apply slot visibility rules to prompt assembly:** `generateIntroImage` currently calls `assemblePrompt` without slot visibility. Import `resolveSlotStatuses`, `parseRules`, `applyRules` from `slot-resolver.mjs`; build `activeParts` from character + outfit parts in `{ config: { type, isRevealing } }` format; compute `visibility = applyRules(resolveSlotStatuses(activeParts, [], -1), parseRules(data.config.slotRules || ''))`; filter `enabledParts` by slot visibility before assembling the prompt; pass `visibility` as third arg to `assemblePrompt`.

- [x] **Route play mode generation through dedicated anytale endpoint:**
- [x] **Auto-randomize location attributes:** Remove the per-attribute wizard. When a location part is selected, randomly assign all its attribute values and immediately update session + regenerate. Remove `locationPickState`, `pickLocationAttr`, `goBackInAttr`.
- [x] **Keep old image visible during generation; crossfade to new:** Do not null `introImageUrl` when starting character/outfit/location changes. In `PortraitPanel`, track previous and incoming background URLs; when `backgroundUrl` changes, render the old image and the new image stacked, fade old out / new in over 0.6 s using CSS `opacity` transitions once the new image's `onLoad` fires; then remove the old layer.
- [x] **Character pick options show name + personality:** Add optional `subtitle` prop to `DecisionOptions` option objects (renders below the main text in secondary-color, smaller font). Pass `subtitle: char.personality` for character pick decisions.
- [x] **Outfit pick from full library:**
- [x] **Fetch full intro plot and apply its page actions:** `GET /anytale/plot` returns summaries only (`{ uid, name, section }`) — `pages` is absent, so `introPage` is always `undefined` and no page tags or actions ever reach prompt assembly. After locating the intro plot by name, fetch the full object via `GET /anytale/plot/:uid`. Pass the full plot's `pages` array and `currentPageIndex = 0` to `resolveSlotStatuses` so page 1 slot actions are applied to visibility before assembling the prompt. `enterOutfitPick` currently filters to the character's preferred outfits. Remove that filter and draw from all library outfits instead. Play mode images currently go to media-data via `/generate`. Create `POST /anytale/play/generate-intro` in the anytale router; enqueue with `endpointKey: 'anytale-play-intro'`, `source: 'anytale-play'`; add `'anytale-play-intro'` to the silent list in orchestrator so images are NOT added to media-data; add `playState` to anytale repository (`getPlayState`, `updatePlayState`); on completion, store `result.imageUrl` in `anytale-data.json` under `playState.introImageUrl`; update client to POST to `/anytale/play/generate-intro` and use `data.result.imageUrl` directly from the SSE complete payload instead of fetching from `/media-data/`.
- [x] **Fix location part silently excluded from prompt:** `assemblePrompt` re-filters parts with `slotVisibility.get(type) === true` (strict). The `visibility` map is built only from char+outfit parts, so `'location'` is absent and returns `undefined`, causing the location part to be dropped. Before pushing the location part into `enabledParts`, iterate its config type array and set each type to `true` in the `visibility` map so `assemblePrompt`'s strict check passes.

## Implementation Details

### Session storage key and shape

Play mode uses its own `localStorage` key — **do not** clobber the editor keys (`anytale-state`, `anytale-plot`, `anytale-character`, `anytale-outfit`). The session object stores:

```js
{
  character: { uid, name, personality, portraitUrl, parts: [...] },
  outfitUid: 'outfit-...',
  location: { partUid, attributeMap: { attrName: 'value' | null } },
  music: { genre: 'fantasy' },
  preludePlotUid: 'plot-...',
  phase: 'intro-main' | 'intro-mood' | 'character-pick' | 'outfit-pick' | 'location-pick' | 'music-pick',
  introImageUrl: '/media/...' | null,
  muted: false,
  musicOn: true,
}
```

### Cold start data fetches

Bootstrap requires loading the full library from the server. Use the existing endpoints:

| Data | Endpoint | Filter |
|------|----------|--------|
| Characters | `GET /anytale/characters` | Any with `parts.length > 0` |
| Outfits | `GET /anytale/outfits` | Filtered to selected character's `preferredOutfits` |
| Location parts | `GET /anytale/parts` | `type` array includes `'location'` (case-insensitive) |
| Plots | `GET /anytale/plot` | Full list; filter by `section` + `slotRequirements` at runtime |
| Config | `GET /anytale/config` | Read `introductionPlotName`, `generationWorkflow` |

If any required category is empty (no characters, no location parts, no prelude plot, no introduction plot), show a blocking error message directing the user to create the missing data in the AnyTale editor.

### Introduction plot lookup

The introduction plot name is configured in `server/config.default.json` under `anytale.introductionPlotName`. The `GET /anytale/config` endpoint already mirrors the entire `anytale` config object — this new key is available automatically once added to `config.json`. Look up the plot by matching `name` against the plot list fetched from `GET /anytale/plot`, then fetch its full data via `GET /anytale/plot/:uid`.

### Prompt assembly for introduction image

Use `assemblePrompt(enabledParts, activePage)` from `public/js/app-ui/anytale/prompt-assembler.mjs`:

```js
import { assemblePrompt } from '../anytale/prompt-assembler.mjs';

// enabledParts = character parts + outfit parts + location part
// Each part needs { config: { name, type, baseline, attributes }, data: { enabled: true, attributeValues } }
const enabledParts = [
  ...characterParts,  // from session character
  ...outfitParts,     // resolved from outfitUid via GET /anytale/outfits
  locationPart,       // from session location with attributeMap applied
];

// activePage = the single page from the introduction plot
const activePage = introductionPlot.pages[0]; // { tags: '...' }

const prompt = assemblePrompt(enabledParts, activePage);
```

The introduction plot is **not** part of the timeline — it is purely the visual backdrop for intro decision-making.

### Image generation via queue

Trigger image generation using the same pattern as portrait generation in `server/features/anytale/router.mjs`. The workflow name comes from `anytale.generationWorkflow` in config (currently `"Text to Image (Illustrious Portrait)"`). Enqueue via the existing queue service with `entityType: 'anytale-play'` and `requestOrigin: 'anytale'`.

### Blocking UI during image regeneration

When a setting change triggers regeneration:

1. Show a loading spinner overlay on top of the current image.
2. The spinner uses the same portrait area space (no layout shift).
3. Once the new image URL is available, fade-transition from the old image to the new one.
4. Remove the spinner after the fade completes.

Use CSS `opacity` transitions for the fade (same approach as editor slideshow mode).

### Introduction and mood page option counts

Per the parent spec's three-plus-one pattern exceptions: **introduction main page** and **mood page** have exactly **three** options with **no fourth**. Only the character change (3+1), outfit change (3+1), and background attribute steps (3+1) use the fourth option.

### Location attribute wizard

When the user picks a location part, walk each attribute sequentially. For each attribute:

- Show three concrete options randomly sampled from the attribute's hydrated option list.
- Fourth option: 'None of these' — sets that attribute value to `null` (omitted from prompt).
- After all attributes are resolved, update the session `location.attributeMap` and regenerate.

Attributes use the hydrated `options` lists on part configs (see parent spec's Part attribute options migration section). If a part's options are not yet hydrated, fall back to showing the raw option strings.

### Music playback

Use `globalBgmPlayer` for all music playback. On genre selection, load random tracks from that genre's playlist into `globalBgmPlayer`. The player handles continuous playback via periodic playlist insertions. Crossfade between genre changes is handled by `globalBgmPlayer`'s built-in fade transitions. Music changes do **not** trigger image regeneration.

### Phase-based UI routing

The `phase` field in the session object drives which decision page is shown. All phase transitions update the session immediately (for reload restoration). Valid phases during introduction:

```
intro-main → character-pick → intro-main (after pick)
intro-main → intro-mood → outfit-pick → intro-main
intro-main → intro-mood → location-pick → intro-main
intro-main → intro-mood → music-pick → intro-mood → intro-main
intro-main → (begin) → [Rollout 4: chapter entry]
```
