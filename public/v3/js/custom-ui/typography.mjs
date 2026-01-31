/**
 * typography.mjs - Themed heading components
 * 
 * Provides consistent, themed h1, h2, h3 elements using goober
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
  margin: 0 0 ${() => currentTheme.value.spacing.medium.margin} 0;
  font-size: 2rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.2;

  small {
    font-size: 0.5em;
    opacity: 0.6;
  }
`;

/**
 * H2 - Section heading
 * Size: 1.5rem (24px)
 * Weight: 600 (bold)
 * Usage: Section titles
 */
export const H2 = styled('h2')`
  margin: 0 0 ${() => currentTheme.value.spacing.medium.margin} 0;
  font-size: 1.2rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  line-height: 1.3;
`;

/**
 * H3 - Subsection heading
 * Size: 1rem (16px)
 * Weight: 500 (medium)
 * Usage: Component titles, subsection headings
 */
export const H3 = styled('h3')`
  margin: 0 0 ${() => currentTheme.value.spacing.small.margin} 0;
  font-size: 1rem;
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  color: ${() => currentTheme.value.colors.text.secondary};
  line-height: 1.4;
`;
