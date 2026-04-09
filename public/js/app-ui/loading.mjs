import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { Page } from '../custom-ui/layout/page.mjs';
import { Icon } from '../custom-ui/layout/icon.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  gap: ${() => currentTheme.value.spacing.large.gap};
`;
Container.className = 'loading-container';

const Title = styled('h1')`
  font-size: 2rem;
  color: ${() => currentTheme.value.colors.text.primary};
`;
Title.className = 'loading-title';

const ServiceList = styled('ul')`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  padding: 0;
`;
ServiceList.className = 'loading-service-list';

const ServiceItem = styled('li')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
  font-size: ${() => currentTheme.value.typography.fontSize.large};
`;
ServiceItem.className = 'loading-service-item';

const Subtitle = styled('p')`
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  color: ${() => currentTheme.value.colors.text.secondary};
`;
Subtitle.className = 'loading-subtitle';

// =========================================================================
// Loading App Component
// =========================================================================

function LoadingApp() {
  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get('redirect') || '/';

  const [status, setStatus] = useState({ ollama: false, comfyui: false });
  const [theme, setTheme] = useState(currentTheme.value);

  useEffect(() => {
    const unsub = currentTheme.subscribe((t) => setTheme(t));
    return () => unsub();
  }, []);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          if (data.ollama && data.comfyui) {
            window.location.replace(redirectTo);
          }
        }
      } catch (_) {
        // Server not yet reachable — keep waiting
      }
    }

    // Poll immediately on mount, then every 15 seconds
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [redirectTo]);

  const services = [
    { key: 'ollama', label: 'Ollama' },
    { key: 'comfyui', label: 'ComfyUI' },
  ];

  return html`
    <${Page}>
      <${Container}>
        <${Title}>Starting services…<//>
        <${Subtitle}>Please wait while required services become available.<//> 
        <${ServiceList}>
          ${services.map(({ key, label }) => {
            const ready = status[key];
            return html`
              <${ServiceItem} key=${key} style=${{ color: ready ? theme.colors.success.background : theme.colors.text.secondary }}>
                <${Icon}
                  name=${ready ? 'check-circle' : 'loader'}
                  size="24px"
                  color=${ready
                    ? theme.colors.success.background
                    : theme.colors.text.secondary}
                  animation=${ready ? undefined : 'spin'}
                />
                ${label}
              <//>
            `;
          })}
        <//>
      <//>
    <//>
  `;
}

render(html`<${LoadingApp} />`, document.getElementById('app'));
