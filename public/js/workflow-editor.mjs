// Workflow Editor page entry point
import { render } from 'preact';
import { html } from 'htm/preact';

import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { HoverPanelProvider } from './custom-ui/overlays/hover-panel.mjs';
import { WorkflowEditor } from './app-ui/WorkflowEditor.mjs';
import { HamburgerMenu } from './app-ui/HamburgerMenu.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${HoverPanelProvider}>
        <${Page}>
          <${ToastProvider}>
            <${WorkflowEditor} />
          </${ToastProvider}>
        </${Page}>
        <${HamburgerMenu} />
      </${HoverPanelProvider}>
    `, root);
    console.log('Workflow Editor mounted');
  }
});
