# AnyTale Play Mode — Rollout 3: Introduction Flow & Image Generation

## Goal

Implement the complete introduction experience — from cold start bootstrap through all intro decision flows (character, outfit, background, music changes) with live image generation using the introduction plot. After this rollout, a user can open play mode, see their randomly selected character rendered in a neutral pose, customize their session through the two-tier intro menu, and see the image regenerate with each change.

> **External dependencies:** Outfit preview images must be implemented before outfit change flow works. Editor music tab must exist before music genre selection works. Both can be stubbed for initial testing.

> **Parent spec:** [`anytale-play-mode.md`](./anytale-play-mode.md)

## Tasks

- [ ] **Cold start bootstrap:** On first visit (no session in localStorage), randomly select: character (from library), outfit (from character's preferred outfits), location part + random attribute values (from location-typed parts, respecting category/custom attribute option lists), music genre. Compute initial slot state from the selected character parts + outfit parts (`removed` if no part has that slot type; `revealing` if all parts with that slot type have `isRevealing: true` on the outfit part entry; `covered` otherwise). Store all selections and slot state in session. From plots with `section === 'prelude'` (case-insensitive), filter to those whose `slotRequirements` are satisfied by the initial slot state; pick randomly. If none satisfy slot requirements, fall back to any prelude-section plot. Store the selected plot in session. **Manual test:** clear localStorage, open play page, verify all selections are populated in session and different across multiple clears.

- [ ] **Introduction plot config and lookup:** Read `anytale.introductionPlotName` from config (via `GET /anytale/config`). Look up the matching plot by name from the plot library. This is a fixed, 1-page plot for generating neutral pose character images. Fail with guidance message if not found. **Manual test:** set config to a valid plot name, verify lookup succeeds; set to invalid name, verify error message.

- [ ] **Introduction image generation:** On cold start, assemble prompt from current character parts + outfit parts + location part + introduction plot page tags using `assemblePrompt`. Trigger image generation via the config-selected AnyTale workflow. Show loading spinner during generation. Display result in portrait area. **Manual test:** verify generated image appears after loading; image reflects the selected character/outfit/location.

- [ ] **Introduction main page:** Display the introduction image with three decision options (no fourth): 'Let me meet someone else' → character change, 'The mood isn't right' → mood sub-page, 'Begin the tale' → store 'begin' intent (chapter entry is Rollout 4). Use caption bubble for any hint text. **Manual test:** all three options render, each navigates to correct flow.

- [ ] **Introduction mood page:** Three options (no fourth): 'Maybe try on a different outfit?' → outfit change (3+1), 'Let's go somewhere else.' → location change, 'Let's listen to something different.' → music change. Completing any change returns to intro main page. **Manual test:** navigate to mood, pick each option, verify return to main page after completion.

- [ ] **Character change flow:** Show three random characters (name, personality profile, preview portrait — skip portrait if character has none). Fourth option: 'Maybe someone else?' → reroll the trio. On pick: update session character, auto-select random outfit from new character's preferred outfits, regenerate intro image (block UI with spinner, fade from old to new image). **Manual test:** reroll changes all three cards; picking a character updates the image.

- [ ] **Outfit change flow:** Show three random outfits (name, preview image). Fourth: 'Nevermind' → no change, return to mood page. On pick: update session outfit, regenerate intro image (block + fade). **Manual test:** picking an outfit updates the displayed image; 'Nevermind' returns without change.

- [ ] **Location change flow:** Show three random location-typed parts. On pick, walk each attribute: three concrete options from the hydrated option list + fourth 'None of these' (leaves attribute null). After all attributes, update session location, regenerate intro image (block + fade). Return to intro main page. **Manual test:** skip an attribute with 'None of these', confirm the generated prompt omits that tag value.

- [ ] **Music genre selection:** Show three genres from the music database. On pick, load random tracks from that genre's playlist into `globalBgmPlayer` and begin playback (crossfade from any currently playing track). Store the selected genre in session. Return to mood page. Does NOT trigger image regeneration. **Manual test:** pick a genre, verify music starts playing; pick another genre, verify crossfade transition.

- [ ] **Session restoration on reload:** When play page loads with an existing session, restore the UI phase (intro main, mood, etc.) and re-display the cached introduction image if available. **Manual test:** make changes during intro, refresh page, verify same state is restored.

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
