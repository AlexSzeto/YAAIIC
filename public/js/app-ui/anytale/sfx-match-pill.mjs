/**
 * sfx-match-pill.mjs – Display-only pill indicating an SFX match on a plot page.
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
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';

const Pill = styled('span')`
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 2px 10px;
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
Pill.className = 'sfx-match-pill';

/**
 * @param {Object} props
 * @param {{ uid: string, name: string }} props.sfx - The matching SFX record
 * @param {string} props.matchingTag - The page tag that caused the match
 * @param {boolean} [props.primary=false] - When true, renders as filled primary; otherwise outline
 */
export function SfxMatchPill({ sfx, matchingTag, primary = false }) {
  return html`<${Pill} primary=${primary}>${sfx.name}: ${matchingTag}</${Pill}>`;
}
