# Brew Editor Fixes, Round 3

## Goal
Make another round of changes to improve the usability of the brew editor, to bring it in line with the design of the rest of the site, and to fix outstanding bugs.

## Bugs and Design Flaws
*NOTE* If there are bullet points that contradicts each other, items further down the list takes precedence.

- move the Hamburger Menu so it is the rightmost item on the title section. Add the folder button and its functionalities next to the Hamburger Menu. So the buttons on the title bar are, from RIGHT to LEFT: Hamburger, Folder, Open, Upload. Inside the Open modal, there would be export and delete actions for each brew.
- Delete the source level preview - it doesn't work well enough without proper channel info.
- Place preview buttons at the bottom left of the Channel UI it is in, creating a new row to house the button.
In the case of the preview for the entire brew, remove the export/save/delete buttons, and add a delete action in the Open modal.
- Combine the Preview and Stop button for the full brew into a single button, like all the other play/stop buttons.
- Add an input for the number of seconds to play next to the Record Audio checkbox. When Record Audio is checked, the brew would play for the specified number of seconds, and then stop automatically. Set this to 30 seconds by default.
- Update the icon for the browse button to 'audio'.
- Keep Sound Sources semi-global: The ambient brew database saves a global list of Sound Sources not tied to any specific brew. When a brew is loaded, the sources with names matching a global source would have its data overwritten by the global source. If a brew contains a source with a name that doesn't match any of the existing global sources, it is added to the list of global sources. The editor never shows the sound sources actually used by the brew, even though it is kept in the data to keep the data structure valid. Whenever a global sound source changes, the currently loaded brew's source for it also updates, if it is being used.
- When a channel add a source and its label is the default value, the track label automatically updates to the label of the source. When a track label is set (from auto setting or on blur for a track label input) and its channel label is the default value, update the channel label to match the track label that was just updated.
- set the width of the clip input to default. Fix the bug where a clip isn't saving its label so it is showing the raw URL when it is loaded.
- load the metadata and show the length of every clip loaded, next to the play button in paranthesis, i.e. " (12s) .
- modify the maximum value of range slider in the sound sources to be based on the longest clip in the clips list: maximum repeat delay is 10x longest clip length, rounded up to the next second; Maximum attack and decay should equal to the longest clip length, rounded up to the next second.
- calculate the length of a sound source using the following formula: longest clip duration + maximum set repeat count * maximum set repeat delay. Do not update the label of the sound source, but show the length both in the sound source dynamic list and in the dropdowns in the track source selection. (i.e. "Source Name (12s)") Calculate this on page load, and keep its value elsewhere in memory so it won't be saved to the database but it can be used for other calculations.
- set the width of the source select inputs back to default.
- for event tracks, set the minimum delay of the range slider to 0.1, and set the maximum to 10x the longest source length in the track.
- for looping tracks, set the minimum duration of the loop to 1.0, and set the maximum to the source length.
- whenever there is no valid value to set the maximum of a range (no clips in a source or no source in a track), Set that slider's maximum to its current, non-dynamic default, and disable all inputs tied to that dynamic list (repeat count/repeat delay/attack/decay for sources, delay/duration/delate after prev for tracks). If a channel exist without a track or a track exist without a source, disable the preview button of that channel and disable the brew's preview button. Check to see if range slider/discreet sliders have disabled states, and add disable states for these UI elements if they don't have disabled states.
- add a timer next to the brew's play button to show the number of minutes:seconds since playback started. Enclose this timer display in an outlined panel, with its text centered.
- Change the record audio checkbox into a button that starts a recording. Lay out the brew related action buttons, inputs, and labels like so: On the left edge: Record Button, Record duration (input, compact width), Preview Button, playback time display. On the right edge: Save.
- in the ambient brew library, create a `cutInto()` function that cuts an existing brew and allow a new brew to play at full volume immediately. Use this function to start a playback when record mode is turned on.

## Tasks

### Header & Navigation Layout
- [x] Reorganize the `AppHeader` in `brew-editor.mjs`: move `HamburgerMenu` to the far right; update the header button order so buttons appear left to right as Upload Audio, Open, Folder; assign the Folder button to trigger `handleImportClick` (file-import from disk, previously accessed only via "Import" inside the Open modal)
- [x] Add per-item Export and Delete actions to the Open brew `ListSelectModal` `itemActions`; remove the standalone Export and Delete buttons from the bottom action bar
- [x] Fix the folder button's functionality - it should be used to select the current folder id used to store and retrieve files from the media database, and should function the same as the folder button in the main page's title bar. If the relevant code is stuck inside `app.mjs`, refactor it out into its own `app-ui` component/utility.

### Channel & Source Preview Buttons
- [x] Remove the Preview/Stop button from `SoundSourceForm` and stop passing `onPreview`/`onStop` to it from `brew-editor.mjs` (source-level preview is deleted)
- [x] Move the channel preview button in `ChannelForm` from the header row to a new dedicated row rendered at the bottom-left of the channel form

### Brew-Level Action Bar Redesign
- [x] Combine the brew-level Preview and Stop buttons into a single toggle button: play icon + "Preview" label when idle, stop icon + "Stop" label when playing
- [x] Add a playback timer display (MM:SS) enclosed in an outlined panel with centered text, placed adjacent to the brew preview toggle in the action bar; the timer starts on playback start and resets to 00:00 on stop
- [x] Redesign the action bar layout: left edge — Record button (replaces the Record Audio checkbox), Recording duration input (compact width, default 30 s), Preview toggle button, playback timer panel; right edge — Save button only

### Record Mode
- [x] When the Record button activates recording and playback begins, auto-stop playback after the number of seconds specified in the Recording duration input
- [x] Add a `cutInto(recipe)` method to `AmbientCoffee` in `ambient-coffee.js` that immediately silences the currently playing brew (zeroes its master gain) and begins playing the supplied recipe at full volume; use this method to start playback when the Record button is pressed

### Clip UI Fixes
- [x] Change the Browse button icon in `SoundSourceForm` from `"image"` to `"audio"`
- [x] Fix the clip label bug: clips in `brew-data.json` are stored as plain URL strings (e.g. `"/media/audio_95.mp3"`) with no label, so they display raw URLs in the editor. When a brew is loaded, for each clip that is a plain string (not a `{ url, label }` object), resolve its human-readable name by fetching the media data (`/api/media-data`) and matching the clip URL against `entry.audioUrl`, then using the matched entry's `name` field as the clip label; store the result in the `{ url, label }` object format in the brew state so labels are available immediately without waiting for a re-save
- [x] Remove the explicit `widthScale="full"` from the clip `Input` in `SoundSourceForm` to restore the default input width

### Global Sound Sources
- [x] Add backend API endpoints and flat-file storage at `server/database/sound-sources.json` for global sound sources: `GET /api/sound-sources` (list all), `POST /api/sound-sources` (upsert by name), `DELETE /api/sound-sources/:name`; register routes in `server/server.mjs`
- [x] After fetching a brew in `brew-editor.mjs`, fetch the global source list and merge: overwrite each brew source whose name matches a global source with the global data; for any brew source whose name has no match in the global list, POST it to the global list
- [x] Update the brew editor Sound Sources panel to load and edit the global sound source list instead of the brew's own sources; whenever a global source is changed in the editor, also update the matching source object in the currently loaded brew's `sources` array so the data structure stays valid

### Clip Duration Metadata & Dynamic Slider Limits
- [x] In `SoundSourceForm`, load the audio duration for each clip URL when the clips list changes (using `new Audio()` `loadedmetadata` event); display the rounded duration in seconds next to each clip's play button as `"(Ns)"`; store durations in component state
- [x] Calculate each sound source's effective playback length using `longestClipDuration + maxRepeatCount × maxRepeatDelay`; cache the value in editor-level memory (not persisted to DB); display it in the DynamicList source titles and in track source-selection dropdowns as `"Source Name (Ns)"`; recalculate whenever clips or envelope values change
- [x] In `SoundSourceForm`, derive the repeat delay slider maximum as `Math.ceil(longestClipDuration × 10)` s and the attack/decay slider maxima as `Math.ceil(longestClipDuration)` s; fall back to the current static defaults (`60`, `10`, `10`) when the source has no clips with loaded durations

### Track Slider Limits & Input Widths
- [x] Remove the explicit `widthScale="full"` from the source `Select` inputs in `TrackForm` to restore the default select width
- [x] In `TrackForm` event-type tracks, set the delay slider minimum to `0.1` s and its maximum to `10 × longestSourceLength` where `longestSourceLength` is the largest cached effective length among the sources currently assigned to the track; fall back to the static default maximum (`120`) when no sources are assigned or none have a calculated length
- [x] In `TrackForm` loop-type tracks, set the duration slider maximum to the cached effective length of the assigned source; confirm the minimum remains `1.0` s; fall back to the static default maximum (`120`) when no source is assigned or its length is uncalculated

### Disabled States
- [x] Add a `disabled` prop to `RangeSlider` in `custom-ui/io/range-slider.mjs`: when `true`, set `disabled` on both underlying `<input type="range">` elements and render the thumb and active-track fill in a muted/dimmed colour using the theme's disabled or muted token
- [x] Add a `disabled` prop to `DiscreteSlider` in `custom-ui/io/discrete-slider.mjs`: when `true`, set `disabled` on the `<input type="range">`, ignore label clicks, and render track and thumb in a muted/dimmed colour
- [x] Wire up disabled states across forms: disable repeat count, repeat delay, attack, and decay sliders in `SoundSourceForm` when the source has no clips; disable delay/duration/delay-after-prev sliders and source selects in `TrackForm` when no valid source is assigned; disable the channel preview button in `ChannelForm` when any track in the channel has no source assigned; disable the brew preview toggle in `brew-editor.mjs` when any channel has no tracks or any track has no source

### Auto-Label Propagation
- [x] In `TrackForm`, when a source is selected and the track's label still matches the default value (`'Track'`), automatically update the track label to the selected source's label; in `ChannelForm`, when a track label is set (via auto-update or on blur) and the channel's label still matches the default value (`'Channel'`), automatically update the channel label to match


## Implementation Details

## Future Implementation Rules Suggestions

The issues in this round expose a gap in the current rules. There is no requirement that custom UI components support a `disabled` prop before being used in data-driven contexts — every slider or input added to `custom-ui/` should expose and implement `disabled` as part of its initial API contract, since consumers will almost always need to guard against missing data.
