# Fix Gallery Audio Cleanup and AudioPlayer State Sync

## Goals
Fix various cases where the audio continues to play when the UI associated with it is no longer visible, or the play/pause indicator is showing an incorrect state because the global audio player is playing.

## Implementation Details
The global audio player should return a two way handle whenever a start play reqest is sent. This should enable the UI to continue to track the audio's play/pause state and its current progress, as well as allow the UI component to inform the audio player to stop playing the associated audio (on play/pause, or when the component is destroyed).

Add a stop all audio function to the global audio player. For YAAIIG, ALL audio playback should be on a single channel, that is, any audio that is initiated should stop all previous audio playback. Create a dynamic `maxAudioChannels` setting in the global audio player that can be used to determine whether other audio needs to be terminated (if set to -1, there's no limit)

## Tasks
[ ] Stop all preview audio when the gallery is closed
[ ] Fix the AudioPlayer component showing the pause icon when the global audio is stopped (when switching between audio results)

