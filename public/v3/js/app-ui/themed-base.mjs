/**
 * themed-base.mjs - Themed base components specific to app * 
 */
import { styled } from 'goober';
import { currentTheme } from '../custom-ui/theme.mjs';

export const AppHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
AppHeader.className = 'app-header';