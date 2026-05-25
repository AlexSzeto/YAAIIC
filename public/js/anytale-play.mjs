// AnyTale play mode entry point
import { render } from 'preact';
import { html } from 'htm/preact';
import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { TooltipProvider } from './custom-ui/overlays/tooltip.mjs';
import { AnyTalePlayPage } from './app-ui/anytale-play/anytale-play.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${TooltipProvider}>
        <${Page}>
          <${ToastProvider}>
            <${AnyTalePlayPage} />
          </${ToastProvider}>
        </${Page}>
      </${TooltipProvider}>
    `, root);
  } else {
    console.error('Root element #app not found');
  }
});
