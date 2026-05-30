/**
 * play-toggle-button.mjs – Glass toggle button for play mode audio options.
 *
 * When `enabled` is false, a "block" icon is rendered on top of the base icon
 * in the bottom-right corner to indicate the option is currently off.
 *
 * @module app-ui/anytale/play/play-toggle-button
 */
import { html } from 'htm/preact';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';
import { Icon } from '../../../custom-ui/layout/icon.mjs';

const GlassButton = styled('button')`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  background-color: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  color: ${() => currentTheme.value.colors.text.primary};
  transition: background-color 0.2s ease;
  &:hover:not(:disabled) {
    background-color: ${() => currentTheme.value.colors.background.hover};
  }
  &:disabled {
    opacity: 0.20;
    cursor: default;
  }
`;
GlassButton.className = 'play-toggle-button';

const IconWrapper = styled('div')`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;
IconWrapper.className = 'play-toggle-icon-wrapper';

const BlockOverlay = styled('div')`
  position: absolute;
  bottom: -4px;
  right: -4px;
  color: ${() => currentTheme.value.colors.danger.background};
  line-height: 1;
  pointer-events: none;
`;
BlockOverlay.className = 'play-toggle-block-overlay';

/**
 * PlayToggleButton — 48×48 circular glass button for audio-option toggles.
 *
 * @param {Object}   props
 * @param {string}   props.icon     - Base icon name (see icon.mjs)
 * @param {boolean}  [props.enabled=true] - When false, renders a block overlay
 * @param {Function} [props.onClick]
 * @param {string}   [props.title]  - Tooltip text
 * @param {boolean}  [props.disabled] - Disables the button entirely (e.g. not applicable in this phase)
 */
export function PlayToggleButton({ icon, enabled = true, onClick, title, disabled, ...rest }) {
  return html`
    <${GlassButton}
      onClick=${onClick}
      title=${title}
      disabled=${disabled}
      ...${rest}
    >
      <${IconWrapper}>
        <${Icon} name=${icon} size="24px" />
        ${!enabled ? html`
          <${BlockOverlay}>
            <${Icon} name="block" size="14px" />
          </${BlockOverlay}>
        ` : null}
      </${IconWrapper}>
    </${GlassButton}>
  `;
}
