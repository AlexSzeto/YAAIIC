# Sound Editor — Additional Bug Fixes

## Goal

Address remaining bugs in the sound editor modal related to clip regions, playback constraints, and UI contrast.

## Tasks

- [x] Clip regions are still being removed from the timeline whenever a new active region is selected.
- [x] Playbacks are not working as intended - when a region is selected, playback is not stopping at the end of the selected area. The loop button doesn't work at all.
- [x] Change the waveform progress color to be the primary contrast color (white in dark mode, black in light mode)
- [x] When the audio editor first opens, the clip regions that already exists on the timeline are not showing properly.
- [x] on the main page, when an edit that doesn't create new files occur, the updated clip regions are not saved back to the cached generation data on the client side. When a new clip is created as a result of file modification, the result is not added to the session history like uploads or normal generation actions.
