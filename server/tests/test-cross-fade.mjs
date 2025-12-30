import { createCrossFade, createFinalFrameFade } from '../image-utils.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to input file
const inputPath = path.join(__dirname, '../storage', 'image_346.webp');

// Path to output file
const frameBlendOutputPath = path.join(__dirname, 'frame-blend-test.webp');
const crossFadeOutputPath = path.join(__dirname, 'cross-fade-test.webp');

console.log('Testing createCrossFade function...');
console.log(`Input: ${inputPath}`);
console.log(`Frame Blend Output: ${frameBlendOutputPath}`);
console.log(`Cross Fade Output: ${crossFadeOutputPath}`);

try {
    await createFinalFrameFade(inputPath, 10, frameBlendOutputPath);
    await createCrossFade(inputPath, 5, crossFadeOutputPath);
    console.log('Test completed successfully!');
} catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
}
