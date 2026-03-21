# Sound Editor Modal

## Goal
Allow users to open an in-browser audio editor from the generated results panel for any audio media item. The editor visualises the waveform, supports non-destructive region-based editing (trim/crop), and lets users define labelled clip regions. Saving physical edits produces a new derived media entry; saving clip-region-only changes updates the existing entry in place. The ambient brew sound source form is updated to bulk-import clips from a media item's defined regions.

## Tasks

- [x] **Backend** – Add `origin` field to inpaint-generated media entries
- [x] **Backend** – Add `POST /upload/audio-edit` endpoint for saving physically-edited audio
- [x] **Frontend** – Add optional `onAdd` override prop to `DynamicList`
- [x] **Frontend** – Update `SoundClip` in `ambient-coffee.js` to respect `start`/`end` offsets
- [x] **Frontend** – Update `SoundSourceForm` clip add to bulk-import from gallery
- [x] **Frontend** – Create `SoundEditorModal` component
- [x] **Frontend** – Wire up the Edit button in `GeneratedResult` and `app.mjs`
