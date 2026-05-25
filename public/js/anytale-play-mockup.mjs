import { render } from 'preact';
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider } from './custom-ui/msg/toast.mjs';
import { TooltipProvider } from './custom-ui/overlays/tooltip.mjs';
import { currentTheme } from './custom-ui/theme.mjs';
import { styled } from './custom-ui/goober-setup.mjs';
import { PortraitPanel } from './app-ui/anytale/play/portrait-panel.mjs';

// ── Placeholder data ─────────────────────────────────────────────────────────

const SCREENS = {
  characterChange: {
    backgroundRender: 'http://localhost:3000/media/image_4242.png',
    captionText: 'Who would you like to meet?',
    characters: [
      {
        name: 'Emma',
        personality: 'A lady with a silky voice, a seductive attitude, who is not afraid to flaunt her feminine wiles',
        portraitUrl: 'http://localhost:3000/media/image_3930.png',
      },
      {
        name: 'Isabella',
        personality: 'A loud, unapologetically rambunctious Latina woman.',
        portraitUrl: 'http://localhost:3000/media/image_3644.png',
      },
      {
        name: 'Jenny',
        personality: 'A young Asian woman who sounds honeyed sweet at first, but often throws intense jealousy fits.',
        portraitUrl: 'http://localhost:3000/media/image_3637.png',
      },
    ],
  },
  plotPage: {
    backgroundRender: 'http://localhost:3000/media/image_4242.png',
    dialogText: 'Do allow me to introduce myself properly. You\'re here, and frankly, you deserve the view.',
    chapter: 1,
    page: 2,
    loadedPercent: 60,
    currentPercent: 30,
  },
};

// ── Styled wrappers ──────────────────────────────────────────────────────────

const PageWrapper = styled('div')`
  max-width: 480px;
  margin: 0 auto;
  padding: ${() => currentTheme.value.spacing.medium.padding};
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.medium.gap};
`;
PageWrapper.className = 'mockup-page-wrapper';

const ScreenSwitcher = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
ScreenSwitcher.className = 'screen-switcher';

const SwitcherButton = styled('button')`
  flex: 1;
  padding: ${() => currentTheme.value.spacing.small.padding};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  border: 2px ${() => currentTheme.value.border.style}
          ${() => currentTheme.value.colors.border.secondary};
  cursor: pointer;
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  transition: background-color 0.2s ease, color 0.2s ease;
  background-color: ${props => props.active
    ? currentTheme.value.colors.primary.background
    : currentTheme.value.colors.background.card};
  color: ${props => props.active
    ? currentTheme.value.colors.primary.text
    : currentTheme.value.colors.text.primary};
  border-color: ${props => props.active
    ? currentTheme.value.colors.primary.background
    : currentTheme.value.colors.border.secondary};
`;
SwitcherButton.className = 'switcher-button';

const Title = styled('h2')`
  font-size: ${() => currentTheme.value.typography.fontSize.large};
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  color: ${() => currentTheme.value.colors.text.primary};
  margin: 0;
`;
Title.className = 'mockup-title';

// ── MockupPage component ─────────────────────────────────────────────────────

function MockupPage() {
  const [screen, setScreen] = useState('character-change');
  const [muted, setMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const isCharacterChange = screen === 'character-change';
  const plotData = SCREENS.plotPage;

  const characterDecisions = [
    ...SCREENS.characterChange.characters.map(c => ({
      text: `${c.name}\n${c.personality}`,
      image: c.portraitUrl,
      onClick: () => {},
    })),
    { text: 'Maybe someone else?', onClick: () => {} },
  ];

  return html`
    <${PageWrapper}>
      <${Title}>AnyTale Play Mockup</${Title}>

      <${ScreenSwitcher}>
        <${SwitcherButton}
          active=${isCharacterChange}
          onClick=${() => setScreen('character-change')}
        >Character Change</${SwitcherButton}>
        <${SwitcherButton}
          active=${!isCharacterChange}
          onClick=${() => setScreen('plot-page')}
        >Plot Page</${SwitcherButton}>
      </${ScreenSwitcher}>

      <${PortraitPanel}
        key=${screen}
        mode=${isCharacterChange ? 'decision' : 'page'}
        backgroundUrl=${isCharacterChange
          ? SCREENS.characterChange.backgroundRender
          : plotData.backgroundRender}
        bubbleText=${isCharacterChange
          ? SCREENS.characterChange.captionText
          : plotData.dialogText}
        muted=${muted}
        musicEnabled=${musicEnabled}
        onReset=${() => {}}
        onToggleMute=${() => setMuted(m => !m)}
        onToggleMusic=${() => setMusicEnabled(m => !m)}
        chapter=${plotData.chapter}
        page=${plotData.page}
        loadedPercent=${plotData.loadedPercent}
        currentPercent=${plotData.currentPercent}
        onPrev=${() => {}}
        onPlay=${() => {}}
        onStop=${() => {}}
        onNext=${() => {}}
        decisions=${characterDecisions}
        onBack=${() => {}}
      />
    </${PageWrapper}>
  `;
}

// ── Mount ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${TooltipProvider}>
        <${Page}>
          <${ToastProvider}>
            <${MockupPage} />
          </${ToastProvider}>
        </${Page}>
      </${TooltipProvider}>
    `, root);
  }
});
