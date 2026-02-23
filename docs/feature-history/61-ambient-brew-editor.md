# Ambient Brew Editor

## Goal

Build a full-featured editor UI for ambient brew recipe JSON files, allowing users to visually create, edit, load, save, and preview ambient soundscapes powered by the `ambient-coffee.js` library. The editor follows the same architectural patterns as the workflow editor: a dedicated HTML page, an entry-point `.mjs` bootstrapper, and a main editor component in `app-ui/` composed of focused sub-form components — all using Preact + HTM, goober styled components with theme tokens, and existing custom-ui components.

## Tasks

- [x] Create the HTML page `public/brew-editor.html` with the same structure as `workflow-editor.html` (an `#app` root div, module script pointing to the entry-point)
- [x] Create the entry-point `public/js/brew-editor.mjs` following the pattern of `workflow-editor.mjs` (imports `Page`, `ToastProvider`, `HoverPanelProvider`, renders the main `BrewEditor` component)
- [x] Create the main editor component `public/js/app-ui/brew-editor/brew-editor.mjs`
  - [x] Page-level state: current brew recipe object, list of saved brews, loading/saving flags
  - [x] Header with title, "Open" button (launches `ListSelectModal`), "New" button, "Import" button (file input → parse → load), and "Export" button (serialize current brew → download as `.json`)
  - [x] Empty state when no brew is loaded
  - [x] Top-level brew settings form: `label` (Input) and `mediaUrl` (Input)
  - [x] Sound Sources section using `DynamicList` with `SoundSourceForm` items
  - [x] Channels section using `DynamicList` with `ChannelForm` items
  - [x] Save / Delete action bar with validation
- [x] Create the sound source sub-form `public/js/app-ui/brew-editor/sound-source-form.mjs`
  - [x] `label` — `Input` component
  - [x] `clips` — `DynamicList` of clip entries; each entry is a row with a gallery-picker `Button` that opens the Gallery modal (`fileTypeFilter="audio"`, `selectionMode=true`) to select a clip from the media database
  - [x] `repeatCount` — `RangeSlider` (min/max)
  - [x] `repeatDelay` — `RangeSlider` (min/max)
  - [x] `attack` — `RangeSlider` (min/max)
  - [x] `decay` — `RangeSlider` (min/max)
- [x] Create the channel sub-form `public/js/app-ui/brew-editor/channel-form.mjs`
  - [x] `label` — `Input` component
  - [x] `distance` — `Select` with options: `very-far`, `far`, `medium`, `close`
  - [x] `muffled` — `ToggleSwitch`
  - [x] `reverb` — `ToggleSwitch`
  - [x] `tracks` — `DynamicList` of `TrackForm` items
- [x] Create the track sub-form `public/js/app-ui/brew-editor/track-form.mjs`
  - [x] `label` — `Input` component
  - [x] `type` — `Select` with options: `event`, `loop`
  - [x] `clones` — `Input` (type number)
  - [x] Conditional fields for `event` type:
    - [x] `sources` — multi-value `Input` or tag-style selector listing source labels from the current brew
    - [x] `delay` — `RangeSlider` (min/max)
    - [x] `delayAfterPrev` — `ToggleSwitch`
  - [x] Conditional fields for `loop` type:
    - [x] `source` — `Select` populated from current brew's source labels
    - [x] `duration` — `RangeSlider` (min/max)
- [x] Create a server-side brew feature domain `server/features/brew/`
  - [x] `router.mjs` — REST endpoints: `GET /api/brews` (list), `GET /api/brews/:name` (load), `POST /api/brews` (save/create), `DELETE /api/brews/:name` (delete)
  - [x] `service.mjs` — business logic for reading/writing brew JSON files from a `server/database/brews/` directory
- [x] Mount the brew router in `server/server.mjs`
- [x] Wire up front-end API calls in `brew-editor.mjs` to the server endpoints (load list, load brew, save, delete)
- [x] Add audio file upload capability within the editor: an "Upload Audio" button that opens a file picker and POSTs to the existing `/upload/audio` endpoint, with toast progress feedback
- [x] Add audio preview capability: a "Preview" button that loads the current recipe into an `AmbientBrew` instance and plays it via a live `AudioContext`, with a "Stop" button to disconnect
- [x] Add audio generation/export: Add a `Record Audio` `CheckBox` that, when toggled on, every audio preview of the brew is recorded `MediaRecorder` on the live `AudioContext` destination. An upload button is then available to uploads the resulting audio blob to `/upload/audio` so it enters the media database as generated data, with a cross fade applied so the audio would loop seamlessly.
