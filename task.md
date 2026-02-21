# Seamless Audio Loop Crossfade Processor

## Goal

Create a `crossfadeAudioClip` post-generation processor that makes AI-generated audio loop seamlessly. It takes the tail of an audio file, applies a crossfade into the head, and trims the tail — producing a loop point that is indistinguishable from the rest of the audio. Uses FFmpeg via `execSync`, mirroring the approach of the existing `crossfadeVideoFrames` processor.

## Tasks

- [ ] Create `server/audio-utils.mjs` with a `createAudioCrossFade(inputPath, blendDuration, outputPath)` function
- [ ] Create `server/features/generation/processors/crossfade-audio.mjs` with the `crossfadeAudioClip` handler
- [ ] Register `crossfadeAudioClip` in `server/features/generation/processors/index.mjs`
- [ ] Add `crossfadeAudioClip` to the `postGenerationTasks` of "Text to Music (ACE-Step 1.3)" in `server/resource/comfyui-workflows.json` and verify the seamless loop manually

## Implementation Details

### Design Rationale

The crossfade algorithm for audio mirrors `createCrossFade` in `server/image-utils.mjs` exactly, just operating on samples instead of frames:

| Video (`createCrossFade`) | Audio (`createAudioCrossFade`) |
|---|---|
| Extract last N frames (tail) | Extract last N seconds (tail) |
| Blend (with fading opacity) tail over head frames | Mix (with fade curves) tail over head samples |
| Delete tail frames | Trim tail from output |
| Result is shorter by N frames | Result is shorter by N seconds |

When the output loops, the loop point is already blended — the tail was mixed into the head before being removed.

---

### `server/audio-utils.mjs`

New file, analogous to `image-utils.mjs`. FFmpeg must be available on PATH (guaranteed in any ComfyUI environment).

**Function signature:**
```js
export async function createAudioCrossFade(inputPath, blendDuration = 3, outputPath = null)
```

**Algorithm:**

1. Probe the audio duration using `ffprobe`:
   ```bash
   ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{inputPath}"
   ```
   Parse the result as a float.

2. Validate: if `blendDuration >= duration / 2`, log a warning and return early without modifying the file. (The two blend regions would overlap, making the result invalid.)

3. Compute `endMid = duration - blendDuration`.

4. Write to a temp file (e.g. same directory, `_crossfade_temp{ext}`), then replace the original on success. Use `path.extname(inputPath)` to preserve the audio format — FFmpeg infers the encoder from the extension.

5. Run FFmpeg filter_complex:
   ```bash
   ffmpeg -y -i "{inputPath}" -filter_complex \
     "[0:a]asplit=3[a1][a2][a3]; \
      [a1]atrim=0:{blendDuration},asetpts=PTS-STARTPTS[head]; \
      [a2]atrim={blendDuration}:{endMid},asetpts=PTS-STARTPTS[middle]; \
      [a3]atrim={endMid},asetpts=PTS-STARTPTS[tail]; \
      [head]afade=t=in:st=0:d={blendDuration}:curve=tri[head_faded]; \
      [tail]afade=t=out:st=0:d={blendDuration}:curve=tri[tail_faded]; \
      [head_faded][tail_faded]amix=inputs=2:duration=longest:normalize=0[blended]; \
      [blended][middle]concat=n=2:v=0:a=1[out]" \
     -map "[out]" "{tempOutputPath}"
   ```
   - `afade t=in` on `head`: volume ramps 0→1 over `blendDuration` seconds
   - `afade t=out` on `tail`: volume ramps 1→0 over `blendDuration` seconds
   - `amix normalize=0`: raw mix (no loudness normalisation — levels are already controlled by the fade curves)
   - `concat n=2 v=0 a=1`: concatenate two audio-only streams

6. On success, move temp file to `outputPath`. On error, delete temp and rethrow.

7. Use `execSync` from `child_process`, same as `image-utils.mjs` uses `execSync` for `anim_dump`.

**Error handling:**
- If `ffmpeg` or `ffprobe` is not found (ENOENT), throw: `"FFmpeg not found on PATH. Ensure FFmpeg is installed and accessible."`
- If the input file does not exist, throw before running any command.
- Always clean up the temp file in a `finally` block.

---

### `server/features/generation/processors/crossfade-audio.mjs`

```js
import fs from 'fs';
import { createAudioCrossFade } from '../../../audio-utils.mjs';

/**
 * @param {Object} parameters
 * @param {number} [parameters.blendDuration=3] - Seconds of audio to crossfade.
 * @param {Object} generationData
 * @param {string} generationData.saveAudioPath - Path to the generated audio file.
 */
export async function crossfadeAudioClip(parameters, generationData, _context) {
  const { blendDuration = 3 } = parameters;
  const { saveAudioPath } = generationData;

  if (!saveAudioPath) {
    throw new Error('crossfadeAudioClip requires generationData.saveAudioPath');
  }
  if (!fs.existsSync(saveAudioPath)) {
    throw new Error(`Cannot apply audio crossfade: file not found at ${saveAudioPath}`);
  }

  console.log(`[Process] Applying audio crossfade with ${blendDuration}s blend...`);
  await createAudioCrossFade(saveAudioPath, blendDuration);
  console.log(`[Process] Successfully applied audio crossfade`);
}
```

**Key difference from `crossfadeVideoFrames`:** This processor reads `generationData.saveAudioPath` rather than `context.saveImagePath`. Audio workflows set `saveAudioPath` on `generationData` in the orchestrator (see `orchestrator.mjs:486`).

---

### `server/features/generation/processors/index.mjs`

Add the import and registration:
```js
import { crossfadeAudioClip } from './crossfade-audio.mjs';

export const PROCESS_HANDLERS = {
  extractOutputMediaFromTextFile,
  crossfadeVideoFrames,
  crossfadeAudioClip,   // ← add
  extractOutputTexts,
  executeWorkflow,
};
```

---

### Workflow Configuration for Testing

In `server/resource/comfyui-workflows.json`, add to the `postGenerationTasks` array of **"Text to Music (ACE-Step 1.3)"** (immediately before the `executeWorkflow` album cover task, so crossfade runs on the audio before the cover is generated):

```json
{
  "process": "crossfadeAudioClip",
  "name": "Creating seamless loop",
  "parameters": {
    "blendDuration": 3
  }
}
```

The `blendDuration` of `3` seconds is a good default for music (~120s clips). For shorter sound effects, a `1` second blend is more appropriate.

---

### Manual Test Instructions

1. Start the server and open the app in the browser.
2. Select the **"Text to Music (ACE-Step 1.3)"** workflow.
3. Enter a prompt (e.g. `"ambient electronic, lo-fi beats"`) and a name, then generate.
4. Once complete, download the audio file from the media gallery.
5. Open the file in an audio editor (e.g. Audacity) or player with looping (e.g. VLC with loop enabled):
   - **Duration check**: The output should be shorter by exactly `blendDuration` seconds compared to the raw ComfyUI output. (The raw output duration can be seen in ComfyUI's output folder before the processor ran — check `server/logs/sent-workflow.json` to confirm the workflow ran.)
   - **Seamless loop check**: Enable looping and listen to the loop point several times. There should be no audible click, pop, or discontinuity — the audio should flow naturally from end back to beginning.
6. To test the edge-case guard, temporarily set `"blendDuration": 9999` in the workflow config and generate again — the server log should print a warning and the audio file should be left unmodified.
