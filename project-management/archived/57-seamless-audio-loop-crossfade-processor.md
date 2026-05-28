# Seamless Audio Loop Crossfade Processor

## Goal

Create a `crossfadeAudioClip` post-generation processor that makes AI-generated audio loop seamlessly. It takes the tail of an audio file, applies a crossfade into the head, and trims the tail — producing a loop point that is indistinguishable from the rest of the audio. Uses FFmpeg via `execSync`, mirroring the approach of the existing `crossfadeVideoFrames` processor.

## Tasks

- [x] Create `server/audio-utils.mjs` with a `createAudioCrossFade(inputPath, blendDuration, outputPath)` function
- [x] Create `server/features/generation/processors/crossfade-audio.mjs` with the `crossfadeAudioClip` handler
- [x] Register `crossfadeAudioClip` in `server/features/generation/processors/index.mjs`
- [x] Add `crossfadeAudioClip` to the `postGenerationTasks` of "Text to Music (ACE-Step 1.3)" in `server/resource/comfyui-workflows.json` and verify the seamless loop manually
