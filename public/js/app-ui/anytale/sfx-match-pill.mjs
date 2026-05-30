/**
 * sfx-match-pill.mjs – Pill indicating an SFX match on a plot page.
 *
 * When the SFX record has an `audioUrl`, the pill renders as a button and
 * clicking plays/toggles the preview audio via globalAudioPlayer (channel 0).
 * When no `audioUrl` is available, the pill is a non-interactive span.
 *
 * The first matching pill (primary=true) uses a filled primary background to
 * indicate that this is the SFX that will actually generate and play.
 * Additional matches use an outline style.
 *
 * Label format: "[sfx.name]: [matchingTag]"
 *
 * @module app-ui/anytale/sfx-match-pill
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { globalAudioPlayer } from '../../custom-ui/global-audio-player.mjs';

// Styles are inlined in each component so goober's tagged-template processor
// can correctly resolve the () => theme.value... dynamic interpolations.
// Sharing them via a plain string literal would stringify the functions instead.

const PillSpan = styled('span')`
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  height: 28px;
  padding: 0 10px;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  white-space: nowrap;
  user-select: none;
  background: ${({ primary }) => primary
    ? currentTheme.value.colors.primary.background
    : 'transparent'};
  color: ${({ primary }) => primary
    ? currentTheme.value.colors.primary.text ?? currentTheme.value.colors.text.primary
    : currentTheme.value.colors.text.secondary};
  border: 1px solid ${({ primary }) => primary
    ? 'transparent'
    : currentTheme.value.colors.border.primary};
`;
PillSpan.className = 'sfx-match-pill';

const PillButton = styled('button')`
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  height: 28px;
  padding: 0 10px;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  background: ${({ primary }) => primary
    ? currentTheme.value.colors.primary.background
    : 'transparent'};
  color: ${({ primary }) => primary
    ? currentTheme.value.colors.primary.text ?? currentTheme.value.colors.text.primary
    : currentTheme.value.colors.text.secondary};
  border: 1px solid ${({ primary }) => primary
    ? 'transparent'
    : currentTheme.value.colors.border.primary};

  &:hover {
    filter: brightness(0.85);
  }
  &:active {
    filter: brightness(0.7);
  }
`;
PillButton.className = 'sfx-match-pill sfx-match-pill--clickable';

/**
 * @param {Object}  props
 * @param {{ uid: string, name: string, audioUrl?: string }} props.sfx
 * @param {string}  props.matchingTag - The page tag that caused the match
 * @param {boolean} [props.primary=false] - Filled primary vs outline style
 */
export function SfxMatchPill({ sfx, matchingTag, primary = false }) {
  const label = `${sfx.name}: ${matchingTag}`;
  const hasAudio = !!sfx.audioUrl;

  const handleClick = useCallback(() => {
    if (!sfx.audioUrl) return;
    globalAudioPlayer.toggle(sfx.audioUrl, null, sfx.uid);
  }, [sfx.audioUrl, sfx.uid]);

  if (hasAudio) {
    return html`
      <${PillButton}
        primary=${primary}
        onClick=${handleClick}
        title="Play SFX preview"
        type="button"
      >${label}</${PillButton}>
    `;
  }

  return html`<${PillSpan} primary=${primary}>${label}</${PillSpan}>`;
}
