import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Page } from './custom-ui/layout/page.mjs';
import { currentTheme } from './custom-ui/theme.mjs';

function App() {
  const [theme, setTheme] = useState(currentTheme.value);

  useEffect(() => {
    return currentTheme.subscribe(setTheme);
  }, []);

  return html`
    <${Page}>
      <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
        <h1 style="color:${theme.colors.text.primary}">Hello World</h1>
      </div>
    </${Page}>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
