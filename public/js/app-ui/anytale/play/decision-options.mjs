import { html } from 'htm/preact';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';

const OptionsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
  width: 100%;
  align-items: center;
`;
OptionsContainer.className = 'decision-options';

const OptionButton = styled('button')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  padding: ${() => currentTheme.value.spacing.small.padding};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  background-color: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  color: ${() => currentTheme.value.colors.text.primary};
  cursor: pointer;
  text-align: left;
  width: 100%;
  min-height: 4em;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: ${() => currentTheme.value.colors.background.hover};
  }
`;
OptionButton.className = 'decision-option-button';

const OptionImage = styled('img')`
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  flex-shrink: 0;
`;
OptionImage.className = 'decision-option-image';

const OptionText = styled('span')`
  flex: 1;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
`;
OptionText.className = 'decision-option-text';

const CenteredOptionText = styled('span')`
  flex: 1;
  text-align: center;
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
`;
CenteredOptionText.className = 'decision-option-text-centered';

/**
 * DecisionOptions - Vertical stack of clickable decision buttons (3 or 4 options).
 *
 * Each option shows an image on the left and word-wrapped text on the right when
 * `image` is provided; without `image` the text is centered.
 *
 * @param {Object} props
 * @param {Array<{text: string, image?: string, onClick: Function}>} props.options
 */
export function DecisionOptions({ options = [] }) {
  return html`
    <${OptionsContainer}>
      ${options.map((opt, i) => html`
        <${OptionButton} key=${i} onClick=${opt.onClick}>
          ${opt.image ? html`<${OptionImage} src=${opt.image} alt="" />` : null}
          ${opt.image
            ? html`<${OptionText}>${opt.text}</${OptionText}>`
            : html`<${CenteredOptionText}>${opt.text}</${CenteredOptionText}>`
          }
        </${OptionButton}>
      `)}
    </${OptionsContainer}>
  `;
}
