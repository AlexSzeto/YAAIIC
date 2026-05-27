import { html } from 'htm/preact';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';

const CaptionBubbleSpacer = styled('div')`
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
`;
CaptionBubbleSpacer.className = 'caption-bubble-spacer';

const CaptionBubbleContainer = styled('div')`
  position: relative;
  width: 100%;
  background: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-radius: 0.4em;
  padding: ${() => currentTheme.value.spacing.medium.padding};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  min-height: 4em;
  text-align: center;
`;
CaptionBubbleContainer.className = 'caption-bubble';

/**
 * CaptionBubble - Hint text bubble without triangle pointer (used at decision points).
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children
 */
export function CaptionBubble({ children, ...rest }) {
  return html`
  <${CaptionBubbleSpacer}>
    <${CaptionBubbleContainer} ...${rest}>${children}</${CaptionBubbleContainer}>
  </${CaptionBubbleSpacer}>
  `;
}
