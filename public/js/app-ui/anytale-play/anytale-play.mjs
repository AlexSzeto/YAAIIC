import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { H1, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { AppHeader } from '../themed-base.mjs';
import { HamburgerMenu } from '../hamburger-menu.mjs';
import { loadPlayData } from './play-data.mjs';
import { load as loadSession } from '../anytale/play/play-session.mjs';

export function AnyTalePlayPage() {
  const [, setTheme] = useState(currentTheme.value);
  useEffect(() => currentTheme.subscribe(setTheme), []);

  const [session] = useState(() => loadSession());

  useEffect(() => {
    loadPlayData().catch(err => console.error('[AnyTalePlayPage] Failed to load play data:', err));
  }, []);

  return html`
    <${VerticalLayout}>
      <${AppHeader}>
        <${H1}>AnyTale</${H1}>
        <${HamburgerMenu} />
      </${AppHeader}>
      <p>AnyTale Play Mode</p>
    </${VerticalLayout}>
  `;
}
