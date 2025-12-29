import WebP from 'node-webpmux';
import sharp from 'sharp';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import webpTools from 'libwebp-static';

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
export async function createFinalFrameFade(inputPath, blendFrames = 10, outputPath = null) {
    // Default outputPath to inputPath if not provided
    if (!outputPath) {
        outputPath = inputPath;
    }
    
    let tempDir = null;

    try {
        console.log(`Processing ${path.basename(inputPath)} with ${blendFrames} blend frames...`);

        // 1. Load the animated WebP using node-webpmux to get frame count and durations
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

        // Get frame durations from node-webpmux
        const frameDurations = image.frames.map(f => f.delay || 100);
        const width = image.width;
        const height = image.height;

        // 2. Use anim_dump to extract fully composited frames as PNG files
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
        tempDir = path.join(actualDirname, 'temp');
        
        // Create temp directory
        if (!fsSync.existsSync(tempDir)) {
            fsSync.mkdirSync(tempDir, { recursive: true });
        }
        
        // Run anim_dump to extract frames
        const animDumpPath = webpTools.anim_dump;
        console.log(`Using anim_dump from: ${animDumpPath}`);
        const command = `"${animDumpPath}" -folder "${tempDir}" -prefix "frame_" "${inputPath}"`;
        console.log(`Running: ${command}`);
        execSync(command);
        
        // Read the extracted PNG frames
        const frameBuffers = [];
        for (let i = 0; i < frameCount; i++) {
            const framePath = path.join(tempDir, `frame_${String(i).padStart(4, '0')}.png`);
            const frameBuffer = await fs.readFile(framePath);
            frameBuffers.push(frameBuffer);
        }
        
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
                
                // Create semi-transparent overlay of the first frame
                // Note: Frames are already PNG from anim_dump
                const fadedFirstFrame = await sharp(firstFrameBuffer)
                    .composite([{
                        input: Buffer.from([0, 0, 0, Math.round(255 * opacity)]),
                        raw: { width: 1, height: 1, channels: 4 },
                        tile: true,
                        blend: 'dest-in'
                    }])
                    .toBuffer();

                // Composite the faded first frame OVER the current frame
                const blendedBuffer = await sharp(frameBuffers[i])
                    .composite([{ input: fadedFirstFrame, blend: 'over' }])
                    .png()
                    .toBuffer();

                // Replace the frame buffer
                frameBuffers[i] = blendedBuffer;
            }
        }

        // 5. Reassemble the animation using node-webpmux
        // Create a new image for output
        const outputImage = await WebP.Image.getEmptyImage();
        
        // Set animation properties
        await outputImage.initLib();
        
        // Convert frame buffers back to frames and add to new image
        const newFrames = [];
        for (let i = 0; i < frameCount; i++) {
            // Convert PNG buffer back to WebP for node-webpmux
            const webpBuffer = await sharp(frameBuffers[i])
                .webp({ lossless: true })
                .toBuffer();
            
            const frameImage = new WebP.Image();
            await frameImage.load(webpBuffer);
            
            newFrames.push({
                img: frameImage,
                x: 0,
                y: 0,
                delay: frameDurations[i] || 100,
                blend: true,
                dispose: false
            });
        }

        // Save the new animation
        await WebP.Image.save(outputPath, {
            width,
            height,
            bgColor: [0, 0, 0, 0],
            loops: 0,
            frames: newFrames
        });

        console.log(`Successfully saved to ${path.basename(outputPath)}`);

    } catch (error) {
        console.error("Error processing animation:", error);
        throw error;
    } finally {
        // Clean up temp directory
        if (tempDir && fsSync.existsSync(tempDir)) {
            try {
                // Use fs.rm instead of fs.promises.rm to avoid issues if reference is lost, 
                // but we imported fs/promises as fs. 
                // We imported fsSync as fsSync. 
                // Use fsSync.rmSync for simplicity in finally block or await fs.rm
                // Since this is an async function, await fs.rm is fine.
                await fs.rm(tempDir, { recursive: true, force: true });
                console.log(`Cleaned up temp directory: ${tempDir}`);
            } catch (cleanupError) {
                console.error('Warning: Failed to clean up temp directory:', cleanupError);
            }
        }
    }
}

/**
 * Cross-fades the final frames into the start of an animation and removes the blended frames.
 * For example, if totalFrames is 40 and blendFrames is 5:
 * - Frame 1 gets Frame 36 overlaid at 5/6 opacity
 * - Frame 2 gets Frame 37 overlaid at 4/6 opacity
 * - Frame 3 gets Frame 38 overlaid at 3/6 opacity
 * - Frame 4 gets Frame 39 overlaid at 2/6 opacity
 * - Frame 5 gets Frame 40 overlaid at 1/6 opacity
 * - Frames 36-40 are then deleted
 * 
 * @param {string} inputPath - Local path to the input .webp file
 * @param {number} [blendFrames=10] - Number of frames to blend (default: 10)
 * @param {string} [outputPath=null] - Local path to save result (defaults to inputPath)
 */
export async function createCrossFade(inputPath, blendFrames = 10, outputPath = null) {
    // Default outputPath to inputPath if not provided
    if (!outputPath) {
        outputPath = inputPath;
    }
    
    let tempDir = null;

    try {
        console.log(`Processing ${path.basename(inputPath)} with ${blendFrames} cross-fade frames...`);

        // 1. Load the animated WebP using node-webpmux to get frame count and durations
        const image = new WebP.Image();
        await image.load(inputPath);

        // Check if it's an animation
        if (!image.hasAnim) {
            console.log('Skipping: Image is not an animation.');
            return;
        }

        const frameCount = image.frames.length;
        if (frameCount <= blendFrames) {
            console.log(`Animation has ${frameCount} frames, which is less than or equal to blendFrames (${blendFrames}). Skipping.`);
            return;
        }

        console.log(`Animation has ${frameCount} frames`);

        // Get frame durations from node-webpmux
        const frameDurations = image.frames.map(f => f.delay || 100);
        const width = image.width;
        const height = image.height;

        // 2. Use anim_dump to extract fully composited frames as PNG files
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const actualDirname = process.platform === 'win32' && __dirname.startsWith('/') ? __dirname.slice(1) : __dirname;
        tempDir = path.join(actualDirname, 'temp');
        
        // Create temp directory
        if (!fsSync.existsSync(tempDir)) {
            fsSync.mkdirSync(tempDir, { recursive: true });
        }
        
        // Run anim_dump to extract frames
        const animDumpPath = webpTools.anim_dump;
        console.log(`Using anim_dump from: ${animDumpPath}`);
        const command = `"${animDumpPath}" -folder "${tempDir}" -prefix "frame_" "${inputPath}"`;
        console.log(`Running: ${command}`);
        execSync(command);
        
        
        // Read the extracted PNG frames
        const frameBuffers = [];
        for (let i = 0; i < frameCount; i++) {
            const framePath = path.join(tempDir, `frame_${String(i).padStart(4, '0')}.png`);
            const frameBuffer = await fs.readFile(framePath);
            frameBuffers.push(frameBuffer);
        }
        
        // 3. Process the first blendFrames frames
        for (let i = 0; i < blendFrames; i++) {
            // Calculate which frame from the end to overlay
            // Frame i (0-indexed) gets frame at position (frameCount - blendFrames + i)
            const endFrameIndex = frameCount - blendFrames + i;
            
            // Calculate opacity: (blendFrames - i) / (blendFrames + 1)
            const opacity = (blendFrames - i) / (blendFrames + 1);

            console.log(`Blending frame ${i} with frame ${endFrameIndex} at opacity ${(opacity * 100).toFixed(0)}%`);

            // Frames are already PNG from anim_dump
            // Create semi-transparent overlay of the end frame
            const fadedEndFrame = await sharp(frameBuffers[endFrameIndex])
                .composite([{
                    input: Buffer.from([0, 0, 0, Math.round(255 * opacity)]),
                    raw: { width: 1, height: 1, channels: 4 },
                    tile: true,
                    blend: 'dest-in'
                }])
                .toBuffer();

            // Composite the faded end frame OVER the current frame
            const blendedBuffer = await sharp(frameBuffers[i])
                .composite([{ input: fadedEndFrame, blend: 'over' }])
                .png()
                .toBuffer();

            // Replace the frame buffer
            frameBuffers[i] = blendedBuffer;
        }

        // 4. Remove the last blendFrames frames - all frames are already PNG format
        const finalFrameCount = frameCount - blendFrames;
        const finalFrameBuffers = frameBuffers.slice(0, finalFrameCount);

        
        console.log(`Removed last ${blendFrames} frames. Final frame count: ${finalFrameCount}`);

        // 5. Reassemble the animation using node-webpmux
        // Create a new image for output
        const outputImage = await WebP.Image.getEmptyImage();
        
        // Set animation properties
        await outputImage.initLib();
        
        // Convert frame buffers back to frames and add to new image
        const newFrames = [];
        for (let i = 0; i < finalFrameCount; i++) {
            // Convert PNG buffer back to WebP for node-webpmux
            const webpBuffer = await sharp(finalFrameBuffers[i])
                .webp({ lossless: true })
                .toBuffer();
            
            const frameImage = new WebP.Image();
            await frameImage.load(webpBuffer);
            
            newFrames.push({
                img: frameImage,
                x: 0,
                y: 0,
                delay: frameDurations[i] || 100,
                blend: true,
                dispose: false
            });
        }

        // Save the new animation
        await WebP.Image.save(outputPath, {
            width,
            height,
            bgColor: [0, 0, 0, 0],
            loops: 0,
            frames: newFrames
        });

        console.log(`Successfully saved cross-faded animation to ${path.basename(outputPath)}`);

    } catch (error) {
        console.error("Error processing animation:", error);
        throw error;
    } finally {
        // Clean up temp directory
        if (tempDir && fsSync.existsSync(tempDir)) {
            try {
                // Use fsSync.rmSync for simplicity in finally block
                // But fs.rm is available via fs/promises import as 'fs' and we are in async function
                await fs.rm(tempDir, { recursive: true, force: true });
                console.log(`Cleaned up temp directory: ${tempDir}`);
            } catch (cleanupError) {
                console.error('Warning: Failed to clean up temp directory:', cleanupError);
            }
        }
    }
}
