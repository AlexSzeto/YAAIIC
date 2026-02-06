# Fix Gallery Audio Cleanup and AudioPlayer State Sync

## Goals
Fix various cases where the audio continues to play when the UI associated with it is no longer visible, or the play/pause indicator is showing an incorrect state because the global audio player is playing.

## Implementation Details

## Tasks
[ ] Stop all preview audio when the gallery is closed
[ ] Fix the AudioPlayer component showing the pause icon when the global audio is stopped (when switching between audio results)

