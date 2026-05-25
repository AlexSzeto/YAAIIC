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
    opacity: 0.6;
    cursor: default;
  }
`;
GlassButton.className = 'glass-button';

/**
 * PlayButton - 48×48 circular borderless glass control button for play mode.
 * @param {Object} props
 * @param {string} props.icon - Icon name (see icon.mjs)
 * @param {boolean} [props.disabled]
 * @param {Function} [props.onClick]
 */
export function PlayButton({ icon, disabled, onClick, ...rest }) {
  return html`
    <${GlassButton} disabled=${disabled} onClick=${onClick} ...${rest}>
      <${Icon} name=${icon} size="24px" />
    </${GlassButton}>
  `;
}
