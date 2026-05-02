// Dress-Up page entry point
import { render } from 'preact';
import { html } from 'htm/preact';
import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { loadTags } from './app-ui/tags/tags.mjs';
import { loadTagDefinitions } from './app-ui/tags/tag-data.mjs';
import { AnyTalePage } from './app-ui/anytale/anytale.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${Page}>
        <${ToastProvider}>
          <${AnyTalePage} />
        </${ToastProvider}>
      </${Page}>
    `, root);
    console.log('Dress-Up page mounted successfully');

    // Load tags after rendering so DOM elements exist for autocomplete
    setTimeout(async () => {
      await loadTags();
      await loadTagDefinitions();
      console.log('Tags and tag definitions initialized');
    }, 100);
  } else {
    console.error('Root element #app not found');
  }
});
