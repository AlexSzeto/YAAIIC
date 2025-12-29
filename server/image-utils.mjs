import WebP from 'node-webpmux';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Blends the first frame into the last N frames of a WebP animation
 * and saves to outputPath (or overwrites input if not specified).
 * Uses node-webpmux for frame extraction/assembly (handles large files)
 * and sharp for frame blending operations.
 * 
 * @param {string} inputPath - Local path to the input .webp file
 * @param {number} [blendFrames=10] - Number of frames at the end to blend (default: 10)
 * @param {string} [outputPath=null] - Local path to save result (defaults to inputPath)
 */
export async function createLoopFade(inputPath, blendFrames = 10, outputPath = null) {
    // Default outputPath to inputPath if not provided
    if (!outputPath) {
        outputPath = inputPath;
    }
    
    try {
        console.log(`Processing ${path.basename(inputPath)} with ${blendFrames} blend frames...`);

        // 1. Load the animated WebP using node-webpmux
        const image = new WebP.Image();
        await image.load(inputPath);

        // Check if it's an animation
        if (!image.hasAnim) {
            console.log('Skipping: Image is not an animation.');
            return;
        }

        const frameCount = image.frames.length;
        if (frameCount <= blendFrames) {
            blendFrames = frameCount;
            console.log(`Animation has ${frameCount} frames, blending all frames.`);
        }

        console.log(`Animation has ${frameCount} frames`);

        // 2. Extract all frames as buffers using demux
        const frameBuffers = await image.demux({ buffers: true });
        
        // 3. Get the first frame for blending
        const firstFrameBuffer = frameBuffers[0];

        // 4. Process frames that need blending
        for (let i = 0; i < frameCount; i++) {
            const distFromEnd = frameCount - 1 - i;

            // Check if we are in the "blend zone"
            if (distFromEnd < blendFrames) {
                // Calculate dynamic opacity based on position in blend zone
                // Opacity should increase as we approach the final frame (distFromEnd = 0)
                // distFromEnd = 0 (last frame) -> highest opacity
                // distFromEnd = blendFrames-1 (first of blend zone) -> lowest opacity
                const opacity = ((blendFrames - distFromEnd) / blendFrames);

                console.log(`Blending frame ${i} (dist from end: ${distFromEnd}) with opacity ${(opacity * 100).toFixed(0)}%`);

                // Get current frame dimensions from the frame info
                const frameInfo = image.frames[i];
                
                // Use sharp to blend the frames
                // Load current frame and resize first frame to match if needed
                const currentFrame = sharp(frameBuffers[i]);
                const currentMeta = await currentFrame.metadata();

                // Create semi-transparent overlay of the first frame
                const fadedFirstFrame = await sharp(firstFrameBuffer)
                    .resize(currentMeta.width, currentMeta.height, { fit: 'fill' })
                    .ensureAlpha()
                    .composite([{
                        input: Buffer.from([0, 0, 0, Math.round(255 * opacity)]),
                        raw: { width: 1, height: 1, channels: 4 },
                        tile: true,
                        blend: 'dest-in'
                    }])
                    .toBuffer();

                // Composite the faded first frame OVER the current frame
                const blendedBuffer = await sharp(frameBuffers[i])
                    .ensureAlpha()
                    .composite([{ input: fadedFirstFrame, blend: 'over' }])
                    .webp({ lossless: true })
                    .toBuffer();

                // Replace the frame buffer
                frameBuffers[i] = blendedBuffer;
            }
        }

        // 5. Reassemble the animation using node-webpmux
        // Get animation settings from original
        const anim = image.anim;
        
        // Create a new image for output
        const outputImage = await WebP.Image.getEmptyImage();
        
        // Set animation properties
        await outputImage.initLib();
        
        // Convert frame buffers back to frames and add to new image
        const newFrames = [];
        for (let i = 0; i < frameCount; i++) {
            const origFrame = image.frames[i];
            const frameImage = new WebP.Image();
            await frameImage.load(frameBuffers[i]);
            
            newFrames.push({
                img: frameImage,
                x: origFrame.x || 0,
                y: origFrame.y || 0,
                delay: origFrame.delay || 100,
                blend: origFrame.blend !== undefined ? origFrame.blend : true,
                dispose: origFrame.dispose !== undefined ? origFrame.dispose : false
            });
        }

        // Save the new animation
        await WebP.Image.save(outputPath, {
            width: image.width,
            height: image.height,
            bgColor: anim?.bgColor || [0, 0, 0, 0],
            loops: anim?.loops || 0,
            frames: newFrames
        });

        console.log(`Successfully saved to ${path.basename(outputPath)}`);

    } catch (error) {
        console.error("Error processing animation:", error);
        throw error;
    }
}
