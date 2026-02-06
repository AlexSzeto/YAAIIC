/**
 * themed-base.mjs - Themed base components
 * 
 * Provides consistent, themed heading (h1, h2, h3) and layout elements
 * (header, vertical, horizontal) using goober
 */

import { styled } from 'goober';
import { currentTheme } from './theme.mjs';

/**
 * H1 - Large page heading
 * Size: 2rem (32px)
 * Weight: 600 (bold)
 * Usage: Main page titles
 */
export const H1 = styled('h1')`
  font-size: 2rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.2;

  small {
    font-size: 0.5em;
    opacity: 0.6;
  }
`;
H1.className = 'themed-h1';

/**
 * H2 - Section heading
 * Size: 1.5rem (24px)
 * Weight: 600 (bold)
 * Usage: Section titles
 */
export const H2 = styled('h2')`
  font-size: 1.2rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.3;
`;
H2.className = 'themed-h2';

/**
 * H3 - Subsection heading
 * Size: 1rem (16px)
 * Weight: 500 (medium)
 * Usage: Component titles, subsection headings
 */
export const H3 = styled('h3')`
  font-size: 1rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  color: ${() => currentTheme.value.colors.text.secondary};
  line-height: 1.4;
`;
H3.className = 'themed-h3';

/**
 * HorizontalLayout - A horizontal flex container with themed gap
 * Usage: Layout elements in a row with consistent spacing
 * @param {Object} props
 * @param {'small'|'medium'|'large'} [props.gap='medium'] - Spacing size
 */
export const HorizontalLayout = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: ${props => currentTheme.value.spacing[props.gap && ['small', 'medium', 'large'].includes(props.gap) ? props.gap : 'medium'].gap};
`;
HorizontalLayout.className = 'horizontal-layout';

/**
 * VerticalLayout - A vertical flex container with themed gap
 * Usage: Layout elements in a column with consistent spacing
 * @param {Object} props
 * @param {'small'|'medium'|'large'} [props.gap='medium'] - Spacing size
 */
export const VerticalLayout = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${props => currentTheme.value.spacing[props.gap && ['small', 'medium', 'large'].includes(props.gap) ? props.gap : 'medium'].gap};
`;
VerticalLayout.className = 'vertical-layout';