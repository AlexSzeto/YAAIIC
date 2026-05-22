# Design Guidelines

This document captures UI/layout decisions and the rules behind them, built up through iterative design sessions. The goal is to give the agent enough context to propose layouts independently without requiring step-by-step guidance.

---

## General Conventions

### List layouts: single-data vs. multi-data

Two established patterns for entity lists in AnyTale-style editors:

- **Single-data** (Character, Outfit, Plot, Genre): one entity selected/expanded at a time. Use a collapsible card via `DynamicList`. Appropriate when each item has a substantial edit form or owns a large nested sub-list (e.g. tracks per genre).
- **Multi-data** (Parts): many items visible and editable simultaneously. Use `DynamicList` with inline `renderItem` forms.

Deciding factor: if the item's edit body could get large (especially if it contains its own sub-list), prefer single-data even when item count is low.

### Input conventions by data type

| Data type | Component |
|---|---|
| Short text | `Input` |
| Prompt / long text (feeds LLM or generation model) | `Input` with `type="textarea"` (textarea is the **default** for prompt fields) |
| Freeform string array (tags, types) | Tag input (array of chips) |
| Constrained string array (items from a fixed set) | `MultiSelect` — inline popover below (or above if near bottom of page); see positioning note below |
| Min/max numeric pair (e.g. BPM range) | Range slider — this is the convention for all min/max pairs; **not** two separate number inputs |
| Boolean | Toggle / checkbox |

### Inline popovers (MultiSelect, dropdowns)

Popovers (e.g. `MultiSelect` checklist) open **inline, anchored to the triggering element** — below it by default, above it if the trigger is near the bottom of the viewport. They are not full-screen modals.

**Positioning rule — avoid goober ref pitfalls:**
- Do **not** attach a `ref` to a `styled()` component to call `getBoundingClientRect()` — the ref yields the Preact component instance, not the DOM node, and will throw.
- Use `e.currentTarget.getBoundingClientRect()` inside the trigger's click handler to get coordinates at interaction time. This is always safe and requires no ref.

### Save / Update button with change detection

All edit forms must follow this pattern going forward (to be backfilled for existing forms like Ambient Brew):

- Button is **disabled** when no unsaved changes are detected.
- Label is **"Save"** when the record does not yet exist on the server; **"Update"** when it does.
- The Save/Update button lives in the form's bottom button row alongside Delete.

### Delete button placement

- **Significant entities** (those with substantial associated data — e.g. a genre that owns a track playlist): the Delete button belongs in the **edit form's button row**, not as an unlabeled icon on the DynamicList header row. Putting a destructive action on a header icon is too easy to trigger accidentally.
- **Lightweight items** (e.g. a single tag, a part row in a flat list): an unlabeled icon delete on the list item is acceptable.

### DynamicList built-ins

- The **Add** button is built into DynamicList (top-right corner). Do not add a separate "Add X" button below the list.
- Do not add rearrangement or delete controls to the header when the edit form already exposes them.
- For sub-lists of simple items (label + one or two icon actions), use **compact DynamicList mode**.

### Single shared player vs. per-item player

When a list of items (tracks, clips) are all playable, do **not** render a full `AudioPlayer` component on each row. Instead:

- Each row gets a single **icon play button** that queues or plays via the shared player.
- A **single shared player** lives in a fixed section below the scrollable list.

This keeps the list compact and avoids multiple simultaneous playback UIs.

### Fixed bottom section

Below every scrollable content area, a **fixed (non-scrolling) section** handles the primary action for that tab — analogous to the Generate section in Parts & Plot and Character & Outfits tabs. For the Music tab this is the BGM player + playlist controls.

### Playlist management modal

Reuses the generation queue modal conventions:

- Flat list of item labels.
- Currently-playing item pinned to the top.
- Other items can be reordered or deleted.

---

## Audio Architecture

### Two-channel player model

The `globalAudioPlayer` singleton needs to expand into a **two-channel manager**:

- **Voice channel** — short one-shot clips; backed by an HTML `<audio>` element (existing behavior).
- **BGM channel** — looping background music; backed by the **Web Audio API** (not an `<audio>` element) to support seamless crossfade.

The two channels coexist: voice playback does not stop background music and vice versa. The expanded manager still lives in `custom-ui` as a shared utility.

### BGM looping player

- Accepts a **playlist of audio URLs**.
- A polling event fires at the end of each track and advances to the next URL in the playlist.
- Looping a single track indefinitely = feeding the same URL repeatedly.
- Between tracks: configurable **crossfade** (overlap and blend) **or** fade-out/fade-in (fade the tail of track A and the head of track B independently).
- The `AudioPlayer` component interface is reused visually, but the BGM variant is implemented differently internally.
- Progress bar reflects progress of the **current track only**.
- Emits a **track-start event** carrying `{ label, url }` so the UI can update the displayed track name.
- Playlist resets when playback stops.

---

## Feature-Specific Layouts

### Music Tab (AnyTale Editor)

#### Genre list (upper, scrollable)

`DynamicList` of genre cards. Each item is a collapsible card via the standard single-data pattern.

**Expanded genre card body:**

| Field | Component |
|---|---|
| Name | `Input` (text) |
| Music prompt | `Input` (textarea) |
| Key instruments | Tag input (freeform array) |
| Name prompt | `Input` (textarea) |
| Keys | Multi-select modal (constrained set) |
| BPM | Range slider (min / max) |
| Time signature | Multi-select modal (constrained set) |

Bottom button row: **Save / Update** (change-detected) + **Delete** (with confirmation — deletes genre and all its tracks).

**Tracks sub-section** (inside expanded genre card):

- Compact `DynamicList` of tracks.
- Each track row: track name label + icon play button + delete icon.
- **Generate Track** button below the track list; disabled while a generation task is in flight for this genre.

#### BGM player + playlist (lower, fixed)

Two-row block + one button:

- Row 1: track metadata labels — track name, genre name, track index / total.
- Row 2: `AudioPlayer`-styled BGM looping player (Web Audio API internally); progress bar = current track.
- Right of the two rows: single **Playlist** icon button that opens the playlist management modal.