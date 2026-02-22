// Brew Editor page entry point
import { render } from 'preact';
import { html } from 'htm/preact';

import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { HoverPanelProvider } from './custom-ui/overlays/hover-panel.mjs';
import { BrewEditor } from './app-ui/brew-editor/brew-editor.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${HoverPanelProvider}>
        <${Page}>
          <${ToastProvider}>
            <${BrewEditor} />
          </${ToastProvider}>
        </${Page}>
      </${HoverPanelProvider}>
    `, root);
    console.log('Brew Editor mounted');
  }
});
