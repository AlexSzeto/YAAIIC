# Looping Animation Frames Blending

## Goals
Blends the first frame into the end of a looping animation sequence.

## Tasks
[x] Add this loop fade function to a new library file, `image-utils.mjs`, on the server side:
```js
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Blends the first frame into the last N frames of a WebP animation
 * and overwrites the file.
 * * @param {string} filePath - Local path to the .webp file
 * @param {number} [blendFrames=4] - Number of frames at the end to blend (default: 4)
 */
async function createLoopFade(filePath, blendFrames = 4) {
    try {
        // 1. Load Metadata
        const meta = await sharp(filePath).metadata();
        
        if (!meta.pages || meta.pages <= blendFrames) {
            console.log(`Skipping: Image has ${meta.pages || 1} frames, but needs more than ${blendFrames} to blend.`);
            return;
        }

        console.log(`Processing ${path.basename(filePath)} (${meta.pages} frames) with ${blendFrames} blend frames...`);

        // 2. Extract the First Frame (Source for the overlay)
        const firstFrameBuffer = await sharp(filePath, { page: 0 }).toBuffer();

        const newFrames = [];

        // 3. Iterate through all frames
        for (let i = 0; i < meta.pages; i++) {
            const currentFrame = sharp(filePath, { page: i });
            
            // Calculate position from the end (0 = last frame, 1 = second to last, etc.)
            const distFromEnd = meta.pages - 1 - i;

            // Check if we are in the "blend zone"
            if (distFromEnd < blendFrames) {
                // Calculate dynamic opacity based on blendFrames.
                // Logic: We divide 100% by (blendFrames + 1) to get even steps.
                // Ex: If duration is 4, we step by 0.2 (20%). 
                //     Last frame (dist 0) = (4 - 0) * 0.2 = 0.8 (80%)
                const stepSize = 1 / (blendFrames + 1);
                const opacity = (blendFrames - distFromEnd) * stepSize;

                // Create semi-transparent overlay of the first frame
                const fadedFirstFrame = await sharp(firstFrameBuffer)
                    .ensureAlpha()
                    .composite([{
                        input: Buffer.from([0, 0, 0, Math.round(255 * opacity)]),
                        raw: { width: 1, height: 1, channels: 4 },
                        tile: true,
                        blend: 'dest-in' // "Multiplies" the alpha channel
                    }])
                    .toBuffer();

                // Composite the faded first frame OVER the current frame
                const blendedBuffer = await currentFrame
                    .composite([{ input: fadedFirstFrame, blend: 'over' }])
                    .toBuffer();
                
                newFrames.push(blendedBuffer);
            } else {
                newFrames.push(await currentFrame.toBuffer());
            }
        }

        // 4. Reassemble and Write
        const tempPath = filePath + '.tmp';

        await sharp(newFrames, { animated: true })
            .webp({ 
                delay: meta.delay, 
                loop: meta.loop
            })
            .toFile(tempPath);

        // 5. Replace original file
        await fs.rename(tempPath, filePath);
        console.log(`Successfully updated ${path.basename(filePath)}`);

    } catch (error) {
        console.error("Error processing animation:", error);
    }
}

// Example Usage:
// createLoopFade('./animation.webp');      // Defaults to 4 frames
// createLoopFade('./animation.webp', 10);  // Blends over the last 10 frames
```

[x] Add an optional parameter, `blendLoopFrames`, to the workflow data object for `comfyui-workflows.json`. If set to `true`, the `createLoopFade` function will be called with the default value of 4 frames after the webp is transferred to the storage folder. The only workflow with this currently should be wan5b-image-to-video-loop. There should be no need to send this back to the client in the workflow list.