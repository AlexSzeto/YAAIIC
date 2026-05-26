import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from '../../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../../custom-ui/theme.mjs';
import { PlayButton } from './glass-button.mjs';
import { SpeechBubble } from './speech-bubble.mjs';
import { CaptionBubble } from './caption-bubble.mjs';
import { DecisionOptions } from './decision-options.mjs';
import { PlayProgressBar } from './play-progress-bar.mjs';
import { PlayLoadingState } from './loading-state.mjs';
import { HorizontalLayout, HorizontalEdgesLayout } from '../../../custom-ui/themed-base.mjs';

// 896 × 1152 is the canonical play-mode render resolution.
const PortraitFrameWrapper = styled('div')`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PortraitFrame = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 896px;
  height: 1152px;
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  overflow: hidden;
`;
PortraitFrame.className = 'portrait-panel';

const BackgroundImage = styled('img')`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;
BackgroundImage.className = 'portrait-background';

const ContentLayer = styled('div')`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${() => currentTheme.value.spacing.medium.padding};
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
ContentLayer.className = 'portrait-content-layer';

const TopControls = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
TopControls.className = 'portrait-top-controls';

const CenterSpace = styled('div')`
  flex: 1;
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-self: center;
`;
CenterSpace.className = 'portrait-center-space';

const FlexSpacer = styled('div')`
  flex: 1;
`;
FlexSpacer.className = 'portrait-flex-spacer';

const CenterContent = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
CenterContent.className = 'portrait-center-content';

const StartOverlay = styled('div')`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
`;
StartOverlay.className = 'portrait-start-overlay';

// Single-row bottom bar: chapter pill (flex: 1) + nav buttons.
const BottomRow = styled('div')`
  width: 100%;
`;
BottomRow.className = 'portrait-bottom-row';

// Pill containing chapter/page label on top and progress bar below.
// Height matches the 48px PlayButton so the row stays uniform.
const ChapterPill = styled('div')`
  flex: 1;
  height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 0 24px;
  max-width: 200px;
  border-radius: 9999px;
  background-color: ${() => currentTheme.value.colors.overlay.glass};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  overflow: hidden;
`;
ChapterPill.className = 'chapter-pill';

const ChapterLabel = styled('span')`
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.secondary};
  white-space: nowrap;
  line-height: 1;
`;
ChapterLabel.className = 'chapter-label';


const ShowUICorner = styled('div')`
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 2;
`;
ShowUICorner.className = 'show-ui-corner';

const CROSSFADE_MS = 600;

/**
 * PortraitPanel - Full play mode layout with background image and glass overlay controls.
 *
 * Maintains a fixed 896:1152 aspect ratio with no border.
 * Background image transitions use a crossfade: the old image stays visible until
 * the new one finishes loading, then both images' opacities animate simultaneously.
 *
 * @param {Object} props
 * @param {'page'|'decision'|'loading'|'start'} [props.mode='page']
 * @param {string} [props.backgroundUrl] - Background scene image URL
 * @param {string} [props.bubbleText=''] - Dialog (page mode) or hint text (decision mode)
 * @param {'caption'|'speech'} [props.bubbleType='caption'] - Bubble style used in decision mode
 * @param {boolean} [props.muted=false]
 * @param {boolean} [props.musicEnabled=false]
 * @param {Function} [props.onReset]
 * @param {Function} [props.onToggleMute]
 * @param {Function} [props.onToggleMusic]
 * @param {number} [props.chapter=1]
 * @param {number} [props.page=1]
 * @param {number} [props.loadedPercent=0]
 * @param {number} [props.currentPercent=0]
 * @param {boolean} [props.isAutoplay=false] - When true, bottom bar shows only a Stop button
 * @param {Function} [props.onPrev]
 * @param {Function} [props.onPlay]
 * @param {Function} [props.onStop]
 * @param {Function} [props.onNext]
 * @param {Array<{text: string, subtitle?: string, image?: string, onClick: Function}>} [props.decisions=[]]
 * @param {Function} [props.onBack]
 * @param {Function} [props.onStart] - Called when the user clicks the start button (mode="start")
 */
export function PortraitPanel({
  mode = 'page',
  backgroundUrl,
  bubbleText = '',
  bubbleType = 'caption',
  muted = false,
  musicEnabled = false,
  onReset,
  onToggleMute,
  onToggleMusic,
  chapter = 1,
  page = 1,
  loadedPercent = 0,
  currentPercent = 0,
  isAutoplay = false,
  onPrev,
  onPlay,
  onStop,
  onNext,
  decisions = [],
  onBack,
  onStart,
  ...rest
}) {
  const [uiVisible, setUiVisible] = useState(true);
  const toggleUI = () => setUiVisible(v => !v);

  // Crossfade state: shownUrl is the currently visible image, pendingUrl is loading in the background.
  const [shownUrl, setShownUrl] = useState(backgroundUrl || null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [crossfading, setCrossfading] = useState(false);

  useEffect(() => {
    if (!backgroundUrl || backgroundUrl === shownUrl) return;
    if (!shownUrl) {
      // First image — no transition needed, show immediately.
      setShownUrl(backgroundUrl);
      return;
    }
    // Queue the incoming image; crossfade starts when it finishes loading (onLoad).
    setPendingUrl(backgroundUrl);
    setCrossfading(false);
  }, [backgroundUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePendingLoad = useCallback(() => {
    if (!pendingUrl) return;
    setCrossfading(true);
    setTimeout(() => {
      setShownUrl(pendingUrl);
      setPendingUrl(null);
      setCrossfading(false);
    }, CROSSFADE_MS);
  }, [pendingUrl]);

  return html`
    <${PortraitFrameWrapper}>
    <${PortraitFrame} ...${rest}>
      ${shownUrl ? html`<${BackgroundImage}
        src=${shownUrl}
        style=${{ opacity: crossfading ? 0 : 1, transition: crossfading ? `opacity ${CROSSFADE_MS}ms ease` : 'none' }}
        alt=""
      />` : null}
      ${pendingUrl ? html`<${BackgroundImage}
        src=${pendingUrl}
        style=${{ opacity: crossfading ? 1 : 0, transition: crossfading ? `opacity ${CROSSFADE_MS}ms ease` : 'none', zIndex: 0 }}
        onLoad=${handlePendingLoad}
        alt=""
      />` : null}

      ${mode === 'start' ? html`
        <${StartOverlay}>
          <${PlayButton} icon="play" onClick=${onStart} />
        </${StartOverlay}>
      ` : null}

      ${mode !== 'start' && (uiVisible ? html`
        <${ContentLayer}>
          <${TopControls}>
            <${PlayButton} icon="refresh" onClick=${onReset} />
            <${PlayButton} icon=${muted ? 'volume-mute' : 'volume-full'} onClick=${onToggleMute} />
            <${PlayButton} icon="music" onClick=${onToggleMusic} />
          </${TopControls}>

          <${CenterSpace}>
            <${FlexSpacer}>
              ${mode === 'loading'
                ? html`<${CaptionBubble}>${bubbleText || 'Loading'}</${CaptionBubble}>`
                : bubbleText
                  ? (mode === 'decision' && bubbleType !== 'speech'
                    ? html`<${CaptionBubble}>${bubbleText}</${CaptionBubble}>`
                    : html`<${SpeechBubble}>${bubbleText}</${SpeechBubble}>`)
                  : null
              }
            </${FlexSpacer}>

            ${mode === 'loading'
              ? html`<${CenterContent}><${PlayLoadingState} /></${CenterContent}>`
              : mode === 'decision'
              ? html`<${DecisionOptions} options=${decisions} />`
              : null
            }
          </${CenterSpace}>

          ${mode === 'page' ? html`
            <${BottomRow}>
              <${HorizontalEdgesLayout}>
                <${HorizontalLayout}>
                  ${isAutoplay
                    ? html`<${PlayButton} icon="stop" onClick=${onStop} />`
                    : html`
                      <${PlayButton} icon="skip-previous" onClick=${onPrev} disabled=${!onPrev} />
                      <${PlayButton} icon="play" onClick=${onPlay} disabled=${!onPlay} />
                      <${PlayButton} icon="skip-next" onClick=${onNext} disabled=${!onNext} />
                      <${PlayButton} icon="eye-slash" onClick=${toggleUI} />
                    `
                  }
                </${HorizontalLayout}>
                <${ChapterPill}>
                  <${ChapterLabel}>Chapter ${chapter}, Page ${page}</${ChapterLabel}>
                  <${PlayProgressBar} loadedPercent=${loadedPercent} currentPercent=${currentPercent} />
                </${ChapterPill}>
              </${HorizontalEdgesLayout}>
            </${BottomRow}>
          ` : mode === 'decision' ? html`
            <${PlayButton} icon="arrow-left-stroke" onClick=${onBack} />
          ` : null}
        </${ContentLayer}>
      ` : html`
        <${ShowUICorner}>
          <${PlayButton} icon="eye" onClick=${toggleUI} />
        </${ShowUICorner}>
      `)}
    </${PortraitFrame}>
    </${PortraitFrameWrapper}>
  `;
}
