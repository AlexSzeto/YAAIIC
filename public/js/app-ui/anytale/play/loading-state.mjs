import { html } from 'htm/preact';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';
import { Icon } from '../../../custom-ui/layout/icon.mjs';

const LoadingContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 200px;
  color: ${() => currentTheme.value.colors.spinner.color};
`;
LoadingContainer.className = 'play-loading-state';

/**
 * PlayLoadingState - Giant centered loading spinner for the portrait panel center area.
 */
export function PlayLoadingState() {
  return html`
    <${LoadingContainer}>
      <${Icon} name="loader-alt" animation="spin" size="80px" />
    </${LoadingContainer}>
  `;
}
