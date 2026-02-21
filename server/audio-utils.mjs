import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Cross-fades the tail of an audio file into the head and trims the tail,
 * producing a seamless loop point. The output is shorter by `blendDuration` seconds.
 *
 * Algorithm mirrors `createCrossFade` in `image-utils.mjs` but operates on
 * audio samples via FFmpeg instead of video frames.
 *
 * @param {string} inputPath - Local path to the input audio file
 * @param {number} [blendDuration=3] - Seconds of audio to crossfade (default: 3)
 * @param {string} [outputPath=null] - Local path to save result (defaults to inputPath)
 */
export async function createAudioCrossFade(inputPath, blendDuration = 3, outputPath = null) {
  if (!outputPath) {
    outputPath = inputPath;
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const ext = path.extname(inputPath);
  const dir = path.dirname(inputPath);
  const tempOutputPath = path.join(dir, `_crossfade_temp${ext}`);

  try {
    // 1. Probe the audio duration
    let durationStr;
    try {
      durationStr = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
        { encoding: 'utf8' }
      ).trim();
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('FFmpeg not found on PATH. Ensure FFmpeg is installed and accessible.');
      }
      throw err;
    }

    const duration = parseFloat(durationStr);
    if (isNaN(duration)) {
      throw new Error(`Could not determine audio duration for: ${inputPath}`);
    }

    // 2. Validate blend duration doesn't overlap itself
    if (blendDuration >= duration / 2) {
      console.warn(
        `[AudioCrossFade] blendDuration (${blendDuration}s) >= half of audio duration (${duration / 2}s). Skipping crossfade.`
      );
      return;
    }

    const endMid = duration - blendDuration;

    console.log(
      `[AudioCrossFade] Processing ${path.basename(inputPath)}: duration=${duration.toFixed(2)}s, blend=${blendDuration}s, endMid=${endMid.toFixed(2)}s`
    );

    // 3. Run FFmpeg filter_complex to blend tail into head, then trim tail
    const filterComplex = [
      `[0:a]asplit=3[a1][a2][a3]`,
      `[a1]atrim=0:${blendDuration},asetpts=PTS-STARTPTS[head]`,
      `[a2]atrim=${blendDuration}:${endMid},asetpts=PTS-STARTPTS[middle]`,
      `[a3]atrim=${endMid},asetpts=PTS-STARTPTS[tail]`,
      `[head]afade=t=in:st=0:d=${blendDuration}:curve=tri[head_faded]`,
      `[tail]afade=t=out:st=0:d=${blendDuration}:curve=tri[tail_faded]`,
      `[head_faded][tail_faded]amix=inputs=2:duration=longest:normalize=0[blended]`,
      `[blended][middle]concat=n=2:v=0:a=1[out]`,
    ].join('; ');

    const command = `ffmpeg -y -i "${inputPath}" -filter_complex "${filterComplex}" -map "[out]" "${tempOutputPath}"`;
    console.log(`[AudioCrossFade] Running: ${command}`);

    try {
      execSync(command, { stdio: 'pipe' });
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('FFmpeg not found on PATH. Ensure FFmpeg is installed and accessible.');
      }
      throw err;
    }

    // 4. Replace original with the crossfaded output
    fs.renameSync(tempOutputPath, outputPath);
    console.log(`[AudioCrossFade] Successfully saved crossfaded audio to ${path.basename(outputPath)}`);

  } finally {
    // Clean up temp file if it still exists (e.g. on error before rename)
    if (fs.existsSync(tempOutputPath)) {
      try {
        fs.unlinkSync(tempOutputPath);
      } catch (cleanupErr) {
        console.warn('[AudioCrossFade] Warning: Failed to clean up temp file:', cleanupErr);
      }
    }
  }
}
