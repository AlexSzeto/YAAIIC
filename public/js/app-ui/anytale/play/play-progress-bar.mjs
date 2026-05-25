import { html } from 'htm/preact';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';

const ProgressContainer = styled('div')`
  position: relative;
  height: 8px;
  border-radius: 9999px;
  overflow: hidden;
`;
ProgressContainer.className = 'play-progress-bar';

const ProgressLayer = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
`;
ProgressLayer.className = 'progress-layer';

/**
 * PlayProgressBar - Three-layer pill progress bar.
 *
 * Layer stacking (bottom to top):
 *   1. Loading (full width, danger red) — unloaded area
 *   2. Loaded (loadedPercent, grey) — buffered area
 *   3. Current (currentPercent, primary blue) — playback position
 *
 * @param {Object} props
 * @param {number} [props.loadedPercent=0] - Buffered portion (0–100)
 * @param {number} [props.currentPercent=0] - Playback position (0–100)
 */
export function PlayProgressBar({ loadedPercent = 0, currentPercent = 0, ...rest }) {
  const theme = currentTheme.value;
  return html`
    <${ProgressContainer} ...${rest}>
      <${ProgressLayer} style=${{
        width: '100%',
        backgroundColor: theme.colors.danger.background,
        zIndex: 1,
      }} />
      <${ProgressLayer} style=${{
        width: `${loadedPercent}%`,
        backgroundColor: theme.colors.background.elevated,
        zIndex: 2,
      }} />
      <${ProgressLayer} style=${{
        width: `${currentPercent}%`,
        backgroundColor: theme.colors.primary.background,
        zIndex: 3,
      }} />
    </${ProgressContainer}>
  `;
}
