# AnyTale Editor Music Tab

## Goal

Add a Music tab to the AnyTale editor for managing music genres, genre settings, and track playlists. Promote genre definitions from hard-coded server config to the anytale database (`server/database/anytale-data.json`). Support generating new tracks via the AceStep workflow from within the editor and permanently adding them to a genre's playlist. On first run, seed the library with one generated track per genre. Play mode consumes this library without generating new tracks.

## Notes

**The global audio player needs to be expanded before AnyTale music is built on top of it.** The current `globalAudioPlayer` (`public/js/custom-ui/global-audio-player.mjs`) is a single-channel singleton. It needs to grow into a two-channel manager — one channel for voice (short one-shot clips) and one for looping background music — while staying far below the complexity of ambient brew (no effects processing, no multi-source mixing, no event/loop tracks). The expanded player should still live in `custom-ui` as a shared utility. Background music loops on its channel; voice playback uses the other; the two coexist without stopping each other. AnyTale music playback is built on this expanded API rather than creating its own Audio instances.
