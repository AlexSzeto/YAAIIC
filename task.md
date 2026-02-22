# Ambient Brew Editor

## Goal

Build a full-featured editor UI for ambient brew recipe JSON files, allowing users to visually create, edit, load, save, and preview ambient soundscapes powered by the `ambient-coffee.js` library. The editor follows the same architectural patterns as the workflow editor: a dedicated HTML page, an entry-point `.mjs` bootstrapper, and a main editor component in `app-ui/` composed of focused sub-form components — all using Preact + HTM, goober styled components with theme tokens, and existing custom-ui components.

## Tasks

- [ ] Create the HTML page `public/brew-editor.html` with the same structure as `workflow-editor.html` (an `#app` root div, module script pointing to the entry-point)
- [ ] Create the entry-point `public/js/brew-editor.mjs` following the pattern of `workflow-editor.mjs` (imports `Page`, `ToastProvider`, `HoverPanelProvider`, renders the main `BrewEditor` component)
- [ ] Create the main editor component `public/js/app-ui/brew-editor/brew-editor.mjs`
  - [ ] Page-level state: current brew recipe object, list of saved brews, loading/saving flags
  - [ ] Header with title, "Open" button (launches `ListSelectModal`), "New" button, "Import" button (file input → parse → load), and "Export" button (serialize current brew → download as `.json`)
  - [ ] Empty state when no brew is loaded
  - [ ] Top-level brew settings form: `label` (Input) and `mediaUrl` (Input)
  - [ ] Sound Sources section using `DynamicList` with `SoundSourceForm` items
  - [ ] Channels section using `DynamicList` with `ChannelForm` items
  - [ ] Save / Delete action bar with validation
- [ ] Create the sound source sub-form `public/js/app-ui/brew-editor/sound-source-form.mjs`
  - [ ] `label` — `Input` component
  - [ ] `clips` — `DynamicList` of clip entries; each entry is a row with a gallery-picker `Button` that opens the Gallery modal (`fileTypeFilter="audio"`, `selectionMode=true`) to select a clip from the media database
  - [ ] `repeatCount` — `RangeSlider` (min/max)
  - [ ] `repeatDelay` — `RangeSlider` (min/max)
  - [ ] `attack` — `RangeSlider` (min/max)
  - [ ] `decay` — `RangeSlider` (min/max)
- [ ] Create the channel sub-form `public/js/app-ui/brew-editor/channel-form.mjs`
  - [ ] `label` — `Input` component
  - [ ] `distance` — `Select` with options: `very-far`, `far`, `medium`, `close`
  - [ ] `muffled` — `ToggleSwitch`
  - [ ] `reverb` — `ToggleSwitch`
  - [ ] `tracks` — `DynamicList` of `TrackForm` items
- [ ] Create the track sub-form `public/js/app-ui/brew-editor/track-form.mjs`
  - [ ] `label` — `Input` component
  - [ ] `type` — `Select` with options: `event`, `loop`
  - [ ] `clones` — `Input` (type number)
  - [ ] Conditional fields for `event` type:
    - [ ] `sources` — multi-value `Input` or tag-style selector listing source labels from the current brew
    - [ ] `delay` — `RangeSlider` (min/max)
    - [ ] `delayAfterPrev` — `ToggleSwitch`
  - [ ] Conditional fields for `loop` type:
    - [ ] `source` — `Select` populated from current brew's source labels
    - [ ] `duration` — `RangeSlider` (min/max)
- [ ] Create a server-side brew feature domain `server/features/brew/`
  - [ ] `router.mjs` — REST endpoints: `GET /api/brews` (list), `GET /api/brews/:name` (load), `POST /api/brews` (save/create), `DELETE /api/brews/:name` (delete)
  - [ ] `service.mjs` — business logic for reading/writing brew JSON files from a `server/database/brews/` directory
- [ ] Mount the brew router in `server/server.mjs`
- [ ] Wire up front-end API calls in `brew-editor.mjs` to the server endpoints (load list, load brew, save, delete)
- [ ] Add audio file upload capability within the editor: an "Upload Audio" button that opens a file picker and POSTs to the existing `/upload/audio` endpoint, with toast progress feedback
- [ ] Add audio preview capability: a "Preview" button that loads the current recipe into an `AmbientBrew` instance and plays it via a live `AudioContext`, with a "Stop" button to disconnect
- [ ] Add audio generation/export: Add a `Record Audio` `CheckBox` that, when toggled on, every audio preview of the brew is recorded `MediaRecorder` on the live `AudioContext` destination. An upload button is then available to uploads the resulting audio blob to `/upload/audio` so it enters the media database as generated data, with a cross fade applied so the audio would loop seamlessly.

## Implementation Details

### Brew Recipe JSON Schema

The editor creates and edits JSON files matching the format consumed by `AmbientBrew.load()`:

```json
{
  "label": "string",
  "mediaUrl": "string (base URL for clip paths)",
  "sources": [
    {
      "label": "string",
      "clips": ["relative/path.mp3"],
      "repeatCount": { "min": 0, "max": 0 },
      "repeatDelay": { "min": 0, "max": 0 },
      "attack": { "min": 0, "max": 0 },
      "decay": { "min": 0, "max": 0 }
    }
  ],
  "channels": [
    {
      "label": "string",
      "distance": "very-far | far | medium | close",
      "muffled": false,
      "reverb": false,
      "tracks": [
        {
          "label": "string",
          "type": "event",
          "clones": 1,
          "sources": ["source-label-1", "source-label-2"],
          "delay": { "min": 0, "max": 0 },
          "delayAfterPrev": true
        },
        {
          "label": "string",
          "type": "loop",
          "clones": 1,
          "source": "source-label",
          "duration": { "min": 0, "max": 0 }
        }
      ]
    }
  ]
}
```

### Clip Shorthand Expansion

The `ambient-coffee.js` library also supports a shorthand for clips:

```json
{ "prefix": "sounds/drip", "min": 1, "max": 5, "padding": 2, "extension": "mp3" }
```

This expands to `["sounds/drip01.mp3", ..., "sounds/drip05.mp3"]`. The editor should store clips as simple string arrays and does not need to support this shorthand in the initial version.

### Distance Values

The `AmbientChannel` class defines these distance presets:

| Key | Gain |
|---|---|
| `very-far` | 0.1 |
| `far` | 0.25 |
| `medium` | 0.5 |
| `close` | 0.75 |

### Existing Reusable Components

All of these live in `public/js/custom-ui/` and should be imported rather than recreated:

| Component | Path | Use |
|---|---|---|
| `RangeSlider` | `io/range-slider.mjs` | All `Range` fields (min/max) |
| `DiscreteSlider` | `io/discrete-slider.mjs` | `distance` on channels |
| `ToggleSwitch` | `io/toggle-switch.mjs` | Boolean fields (`muffled`, `reverb`, `delayAfterPrev`) |
| `Input` | `io/input.mjs` | Text and number inputs |
| `Select` | `io/select.mjs` | Dropdown selects (`type`, `source`) |
| `Button` | `io/button.mjs` | Action buttons |
| `Checkbox` | `io/checkbox.mjs` | Optional booleans |
| `DynamicList` | `layout/dynamic-list.mjs` | Ordered, add/remove/reorder lists |
| `Panel` | `layout/panel.mjs` | Section containers |
| `Page` | `layout/page.mjs` | Page wrapper with theme |
| `H1`, `VerticalLayout`, `HorizontalLayout` | `themed-base.mjs` | Layout primitives |
| `ToastProvider` / `useToast` | `msg/toast.mjs` | Notifications |
| `ListSelectModal` | `overlays/list-select.mjs` | Brew selector modal |
| `showDialog` / `showTextPrompt` | `overlays/dialog.mjs` | Confirmation dialogs and text prompts |

App-level components to reuse (not in `custom-ui/`):

| Component | Path | Use |
|---|---|---|
| `Gallery` (default export) | `app-ui/main/gallery.mjs` | Audio file picker (`fileTypeFilter="audio"`, `selectionMode=true`) |

### Clip Gallery Selection

When a user clicks the gallery-picker button beside a clip `Input`, open the `Gallery` modal with:
- `fileTypeFilter="audio"` — hides non-audio entries
- `selectionMode=true` — enables single-select mode
- `onSelect(entry)` — receives the selected media entry; write `entry.audioUrl` (the full server path, e.g. `/media/drip01.mp3`) directly into the clip text input

The ambient-coffee.js library constructs the final audio URL as `mediaUrl + clipPath`. Gallery-selected clips store the full server path (e.g. `/media/drip01.mp3`). For these to resolve correctly, the brew's `mediaUrl` should be empty (`""`). Manually entered relative clip paths can use a non-empty `mediaUrl` as a prefix.

### JSON Import / Export

- **Import**: A hidden `<input type="file" accept=".json">` triggered by an "Import" `Button`. On `change`, use `FileReader.readAsText`, then `JSON.parse`, and load the result into the editor state (same code path as loading from the server). No server call needed.
- **Export**: Call `JSON.stringify(brew, null, 2)`, create a `Blob` (`type: 'application/json'`), create a temporary `<a>` with `href=URL.createObjectURL(blob)` and `download="label.json"`, click it programmatically, then call `URL.revokeObjectURL`.

### Audio Upload Within the Editor

Reuse the existing `POST /upload/audio` endpoint (`server/features/upload/router.mjs`). A hidden `<input type="file" accept="audio/*">` is triggered by an "Upload Audio" `Button`. On change, build a `FormData` with the file and `fetch` to `/upload/audio`. Show toast notifications for success and error.

### Audio Generation / Export (Generate Loop)

1. Prompt the user for a duration in seconds via `showTextPrompt`.
2. Create a new `AudioContext` and a `MediaStreamDestinationNode` from it.
3. Load and start an `AmbientBrew` playing into the `MediaStreamDestinationNode`.
4. Start a `MediaRecorder` on the destination's `stream`, collecting chunks via `ondataavailable`.
5. After the specified duration (via `setTimeout`), stop the `MediaRecorder` and `disconnect` the brew.
6. In `MediaRecorder.onstop`, assemble chunks into a `Blob` (e.g. `audio/webm`).
7. POST the blob to `POST /upload/audio` as a named file (e.g. `brew-loop-{label}.webm`) via `FormData`.
8. Show a toast on completion indicating the loop was added to the media database.

### File Structure

```
public/
  brew-editor.html                          [NEW]
  js/
    brew-editor.mjs                         [NEW]
    app-ui/
      brew-editor/
        brew-editor.mjs                     [NEW]
        sound-source-form.mjs               [NEW]
        channel-form.mjs                    [NEW]
        track-form.mjs                      [NEW]
server/
  features/
    brew/
      router.mjs                            [NEW]
      service.mjs                           [NEW]
  database/
    brews/                                  [NEW] (directory for saved .json files)
  server.mjs                                [MODIFY] (mount brew router)
```

### Architecture Pattern (from workflow editor)

- **Entry point** (`brew-editor.mjs`): Bootstraps `Page > ToastProvider > BrewEditor`
- **Main component** (`brew-editor.mjs`): Owns top-level state, handles API calls, composes sub-forms inside `Panel` sections
- **Sub-form components**: Each receives `item` + `onChange` props, renders using custom-ui components, calls `onChange` with updated data on every edit
- **DynamicList integration**: Lists (sources, channels, tracks) use `DynamicList` with `renderItem`, `createItem`, `getTitle`, and `onChange`
- **Styling**: `styled` from `goober-setup.mjs`, theme tokens from `theme.mjs`, PascalCase styled component names with `.className` for debugging
- **Server**: Domain-driven with `router.mjs` + `service.mjs`, JSON file persistence in `server/database/brews/`

### Samples Acqusition and Processing
*   [ ] Water
    *   [ ] Drips
    *   [ ] Stream
    *   [ ] Waterfall
    *   [ ] Beach
    *   [ ] Drizzle
    *   [ ] Storm
*   [ ] Fire
*   [ ] Nature
    *   [ ] Rustling Grass
    *   [ ] Rustling Bushes
    *   [ ] Rustling Trees
    *   [ ] Thunder
*   [ ] Air / Wind
    *   [ ] Breeze
    *   [ ] Gust
    *   [ ] Cave
*   [ ] Travel
    *   [ ] Footsteps
    *   [ ] Hoovesteps
    *   [ ] Wheels
*   [ ] Humans
    *   [ ] Whispering
    *   [ ] Conversations
    *   [ ] Crowded Conversation
    *   [ ] Excited Crowd
*   [ ] Objects
    *   [ ] Paper/Pen (Study, Library)
    *   [ ] Plates/Cups (Cafe, Tavern)