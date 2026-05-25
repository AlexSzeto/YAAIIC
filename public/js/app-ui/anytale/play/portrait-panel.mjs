import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
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

/**
 * PortraitPanel - Full play mode layout with background image and glass overlay controls.
 *
 * Maintains a fixed 896:1152 aspect ratio with no border.
 *
 * @param {Object} props
 * @param {'page'|'decision'|'loading'} [props.mode='page']
 * @param {string} [props.backgroundUrl] - Background scene image URL
 * @param {string} [props.bubbleText=''] - Dialog (page mode) or hint text (decision mode)
 * @param {boolean} [props.muted=false]
 * @param {boolean} [props.musicEnabled=false]
 * @param {Function} [props.onReset]
 * @param {Function} [props.onToggleMute]
 * @param {Function} [props.onToggleMusic]
 * @param {number} [props.chapter=1]
 * @param {number} [props.page=1]
 * @param {number} [props.loadedPercent=0]
 * @param {number} [props.currentPercent=0]
 * @param {Function} [props.onPrev]
 * @param {Function} [props.onPlay]
 * @param {Function} [props.onStop]
 * @param {Function} [props.onNext]
 * @param {Array<{text: string, image?: string, onClick: Function}>} [props.decisions=[]]
 * @param {Function} [props.onBack]
 */
export function PortraitPanel({
  mode = 'page',
  backgroundUrl,
  bubbleText = '',
  muted = false,
  musicEnabled = false,
  onReset,
  onToggleMute,
  onToggleMusic,
  chapter = 1,
  page = 1,
  loadedPercent = 0,
  currentPercent = 0,
  onPrev,
  onPlay,
  onStop,
  onNext,
  decisions = [],
  onBack,
  ...rest
}) {
  const [uiVisible, setUiVisible] = useState(true);
  const toggleUI = () => setUiVisible(v => !v);

  const isPageOrLoading = mode === 'page' || mode === 'loading';

  return html`
    <${PortraitFrame} ...${rest}>
      ${backgroundUrl ? html`<${BackgroundImage} src=${backgroundUrl} alt="" />` : null}

      ${uiVisible ? html`
        <${ContentLayer}>
          <${TopControls}>
            <${PlayButton} icon="refresh" onClick=${onReset} />
            <${PlayButton} icon=${muted ? 'volume-mute' : 'volume-full'} onClick=${onToggleMute} />
            <${PlayButton} icon="music" onClick=${onToggleMusic} />
          </${TopControls}>

          <${CenterSpace}>
            <${FlexSpacer}>
            ${mode === 'decision'
              ? html`<${CaptionBubble}>${bubbleText}</${CaptionBubble}>`
              : mode === 'page'
              ? html`<${SpeechBubble}>${bubbleText}</${SpeechBubble}>`
              : null
            }
            </${FlexSpacer} />

            ${mode === 'loading'
              ? html`<${CenterContent}><${PlayLoadingState} /></${CenterContent}>`
              : mode === 'decision'
              ? html`<${DecisionOptions} options=${decisions} />`
              : html``
            }
          </${CenterSpace}>

          ${isPageOrLoading ? html`
            <${BottomRow}>
              <${HorizontalEdgesLayout}>
                <${HorizontalLayout}>
                  <${PlayButton} icon="skip-previous" onClick=${onPrev} />
                  <${PlayButton} icon="play" onClick=${onPlay} />
                  <${PlayButton} icon="stop" onClick=${onStop} />
                  <${PlayButton} icon="skip-next" onClick=${onNext} />
                  <${PlayButton} icon="eye-slash" onClick=${toggleUI} />
                </${HorizontalLayout}>
                <${ChapterPill}>
                  <${ChapterLabel}>Chapter ${chapter}, Page ${page}</${ChapterLabel}>
                  <${PlayProgressBar} loadedPercent=${loadedPercent} currentPercent=${currentPercent} />
                </${ChapterPill}>
              </${HorizontalEdgesLayout}>
            </${BottomRow}>
          ` : html`
            <${PlayButton} icon="arrow-left-stroke" onClick=${onBack} />
          `}
        </${ContentLayer}>
      ` : html`
        <${ShowUICorner}>
          <${PlayButton} icon="eye" onClick=${toggleUI} />
        </${ShowUICorner}>
      `}
    </${PortraitFrame}>
  `;
}
