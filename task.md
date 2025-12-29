# Advanced frames blending (cross fade)

## Goals
Create a more advanced version of loop fade. instead of fading into the first frame from the last few frames, I need the final frames of the animations cross fade into the start of the animation. For example, if the total number of frames is 40 and blendFrames is 5, then the animation would be manipulated in the following way:

1. Frame 1 -> Frame 1 with Frame 36 (40-5) overlaid at 1/6 opacity
2. Frame 2 -> Frame 2 with Frame 37 (40-4) overlaid at 2/6 opacity
3. Frame 3 -> Frame 3 with Frame 38 (40-3) overlaid at 3/6 opacity
4. Frame 4 -> Frame 4 with Frame 39 (40-2) overlaid at 4/6 opacity
5. Frame 5 -> Frame 5 with Frame 40 (40-1) overlaid at 5/6 opacity
6. Delete frames 36-40

[x] Rename createLoopFade to createFinalFrameFade.
[x] Create createCrossFade function based on the above description.
[x] Create a server side test script that opens storage/image_346.webp and applies createCrossFade to it, and output it to server/test.webp.
[x] Switch generation loop fades to use createCrossFade.

---

# Fix Grainy Blending Artifacts

## Research Findings
During testing, both `createFinalFrameFade` and `createCrossFade` produce grainy/pixelated artifacts in blended frames. Research revealed this is a known issue with the Sharp library when using intermediate WebP encoding.

**Root Cause:**
- Even with `lossless: true`, WebP encoding during the blending process introduces subtle compression artifacts
- Each intermediate `.webp({ lossless: true }).toBuffer()` call adds compression artifacts
- The `dest-in` + `over` blend mode approach is correct, but the intermediate encoding format is the problem

**Solution:**
- Use PNG as the intermediate format during blending (truly lossless, no artifacts)
- Convert PNG buffers back to WebP before reassembly (node-webpmux requires WebP format)
- Only encode to WebP at two points: intermediate blending → PNG, final reassembly → WebP
- This ensures artifact-free blending while maintaining WebP output format

## Implementation Plan
[x] Update `createFinalFrameFade` to use PNG for intermediate frame processing
[x] Update `createCrossFade` to use PNG for intermediate frame processing
[] Test both functions to verify artifacts are eliminated

---

# Fix Frame Extraction from Animated WebP

## Root Cause Discovery
The grainy artifacts and incomplete frames are NOT caused by the blending process itself. Debugging revealed that frames extracted from the animated WebP using `node-webpmux`'s `demux()` already contain artifacts and incomplete data.

**Why `node-webpmux` produces incomplete frames:**
- Animated WebP files use optimization to store only the changes (deltas) between frames
- `node-webpmux` (and the underlying `webpmux` tool) extracts frames as-is without compositing
- This results in incomplete/partial frames that only contain the delta information
- When frames use transparency masks and blend modes, extracting them directly produces corrupted images

**The Correct Solution:**
- Use `libwebp-static` npm package which provides the actual `anim_dump` binary
- `anim_dump` is the official Google tool that properly decodes and composites animated WebP frames
- It outputs fully reconstructed PNG frames that we can then process with Sharp
- This is the same tool recommended by Google for extracting complete frames

## Implementation Plan
[x] Install `@jsquash/webp` package
[x] Rewrite `createCrossFade` to use `node-webpmux.getFrameData()` for fully composited frame extraction
[x] Update frame reassembly to work with the new extraction method
[x] Reverse the opacity curve so the transition is smooth:
1. Frame 1 -> Frame 1 with Frame 36 (40-5) overlaid at 5/6 opacity
2. Frame 2 -> Frame 2 with Frame 37 (40-4) overlaid at 4/6 opacity
3. Frame 3 -> Frame 3 with Frame 38 (40-3) overlaid at 3/6 opacity
4. Frame 4 -> Frame 4 with Frame 39 (40-2) overlaid at 2/6 opacity
5. Frame 5 -> Frame 5 with Frame 40 (40-1) overlaid at 1/6 opacity

[x] Remove debug frame export code
[x] Rewrite `createFinalFrameFade` using whatever final fix solution we've found for `createCrossFade`
[x] Test both functions to verify artifacts are eliminated
[x] Implement robust temporary file cleanup for both functions