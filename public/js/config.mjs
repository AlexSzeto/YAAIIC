import { render } from 'preact';
import { html } from 'htm/preact';

import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { HoverPanelProvider } from './custom-ui/overlays/hover-panel.mjs';
import { TooltipProvider } from './custom-ui/overlays/tooltip.mjs';
import { ConfigApp } from './app-ui/config-app.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${HoverPanelProvider}>
        <${TooltipProvider}>
          <${Page}>
            <${ToastProvider}>
              <${ConfigApp} />
            </${ToastProvider}>
          </${Page}>
        </${TooltipProvider}>
      </${HoverPanelProvider}>
    `, root);
  }
});
