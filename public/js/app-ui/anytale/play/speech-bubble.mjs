import { html } from 'htm/preact';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';

const SpeechBubbleContainer = styled('div')`
  position: relative;
  background: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-radius: 0.8em;
  padding: ${() => currentTheme.value.spacing.medium.padding};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: 20px;
    width: 0;
    height: 0;
    border: 24px solid transparent;
    border-top-color: ${() => currentTheme.value.colors.overlay.glass};
    border-bottom: 0;
    border-left: 0;
    margin-bottom: -24px;
  }
`;
SpeechBubbleContainer.className = 'speech-bubble';

/**
 * SpeechBubble - Dialog bubble with triangle pointer at bottom-center.
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children
 */
export function SpeechBubble({ children, ...rest }) {
  return html`<${SpeechBubbleContainer} ...${rest}>${children}</${SpeechBubbleContainer}>`;
}
