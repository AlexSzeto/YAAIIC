/**
 * anytale-viewer.mjs – Left-column image viewer for the AnyTale page.
 *
 * Displays the current image at full portrait resolution with prev/next
 * navigation buttons and a {current}/{total} counter.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { useTooltip } from '../../custom-ui/overlays/tooltip.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { createImageModal } from '../../custom-ui/overlays/modal.mjs';
import { SpeechBubble } from './play/speech-bubble.mjs';

const DialogOverlay = styled('div')`
  position: absolute;
  top: 64px;
  left: ${() => currentTheme.value.spacing.medium.padding};
  right: ${() => currentTheme.value.spacing.medium.padding};
  z-index: 2;
  pointer-events: none;
`;
DialogOverlay.className = 'dialog-overlay';

const ViewerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
  width: 100%;
`;
ViewerContainer.className = 'viewer-container';

const ImageWrapper = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
  background-color: ${() => currentTheme.value.colors.background.card};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  max-width: 100%;
  max-height: calc(100vh - 170px);
  overflow: hidden;
`;
ImageWrapper.className = 'image-wrapper';

// Outgoing image shown as a static backdrop during the crossfade
const PrevImage = styled('img')`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
`;
PrevImage.className = 'prev-image';

// Incoming image fades in on top of the outgoing one
const StyledImage = styled('img')`
  display: block;
  position: relative;
  z-index: 1;
  width: auto;
  object-fit: contain;
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  animation: viewer-fadein 0.4s ease-in-out;
  @keyframes viewer-fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;
StyledImage.className = 'styled-image';

const PlotOverlay = styled('div')`
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  color: ${() => currentTheme.value.colors.text.primary};
  pointer-events: none;
  z-index: 2;
`;
PlotOverlay.className = 'plot-overlay';

const EmptyState = styled('div')`
  padding: 60px 20px;
  text-align: center;
  color: ${() => currentTheme.value.colors.text.muted};
  font-style: italic;
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
`;
EmptyState.className = 'empty-state';

const NavRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;
NavRow.className = 'nav-row';

const LeftNavGroup = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
LeftNavGroup.className = 'left-nav-group';

const SlideshowControls = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
SlideshowControls.className = 'slideshow-controls';



/**
 * @param {Object}   props
 * @param {Array}    props.items        – Array of media-data objects
 * @param {number}   props.currentIndex – Zero-based index of the displayed item
 * @param {Function} props.onNavigate   – Called with new index (selectByIndex)
 * @param {Function} props.onPrev
 * @param {Function} props.onNext
 * @param {Object|null} props.currentItem
 * @param {string}     [props.activeTab='parts-plot'] – Active AnyTale form tab id
 * @param {boolean}    [props.canImport]              – Whether import actions are enabled
 * @param {Function}   [props.onImportPartsPlot]      – Parts & Plot import handler
 * @param {Function}   [props.onImportPlot]           – Plot page tags import handler
 * @param {Function}   [props.onImportCharacter]      – Character parts import handler
 * @param {Function}   [props.onImportOutfit]         – Outfit parts import handler
 * @param {Function}   [props.onDelete]     – Called when delete icon is clicked
 * @param {boolean}    [props.canDelete]    – Whether delete is enabled
 * @param {boolean}    [props.dimmed]       – Reduce image opacity when the displayed image doesn't match the active plot/page
 */
export function AnyTaleViewer({
  items = [],
  currentIndex = 0,
  onNavigate,
  onPrev,
  onNext,
  onFirst,
  onLast,
  currentItem,
  activeTab = 'parts-plot',
  canImport = false,
  onImportPartsPlot,
  onImportPlot,
  onImportCharacter,
  onImportOutfit,
  onDelete,
  canDelete = false,
  onImageWidthChange,
  dimmed = false,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const timerRef = useRef(null);
  // Holds the previous imageUrl; updated after each render so that during a render
  // it still carries the old URL — used as the crossfade backdrop.
  const prevUrlRef = useRef('');

  // Start/stop the slideshow timer when isPlaying or intervalSeconds changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        onNext && onNext();
      }, intervalSeconds * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, intervalSeconds, onNext]);

  // Stop slideshow when there are no images
  useEffect(() => {
    if (!items.length) setIsPlaying(false);
  }, [items.length]);

  // Stop slideshow when the last image is reached
  useEffect(() => {
    if (isPlaying && currentIndex === items.length - 1) setIsPlaying(false);
  }, [currentIndex, items.length]);

  useEffect(() => {
    if (!items.length) onImageWidthChange?.(null);
  }, [items.length]);

  if (!items.length) {
    return html`
      <${Panel} variant="outlined">
        <${ViewerContainer}>
          <${EmptyState}>No images yet — generate one to get started.</${EmptyState}>
        </${ViewerContainer}>
      </${Panel}>
    `;
  }

  const tooltip = useTooltip();

  const item = currentItem || items[currentIndex];
  const imageUrl = item?.url || item?.imageUrl || '';

  // prevUrlRef.current is still the old URL during this render; update it after commit.
  const backdropUrl = prevUrlRef.current !== imageUrl ? prevUrlRef.current : '';
  useEffect(() => { prevUrlRef.current = imageUrl; }, [imageUrl]);

  return html`
    <${Panel} variant="outlined">
      <${ViewerContainer}>
        <${ImageWrapper} style=${{ opacity: dimmed ? 0.66 : 1, transition: 'opacity 0.2s' }}>
          ${backdropUrl ? html`<${PrevImage} src=${backdropUrl} alt="" />` : ''}
          <${StyledImage}
            key=${imageUrl}
            src=${imageUrl}
            alt=${item?.name || 'Generated image'}
            onLoad=${(e) => onImageWidthChange?.(e.currentTarget.getBoundingClientRect().width)}
            onMouseEnter=${(e) => { if (item?.prompt) tooltip.show(item.prompt, e.clientX, e.clientY); }}
            onMouseLeave=${() => tooltip.hide()}
          />
          ${item?.dialog ? html`
            <${DialogOverlay}>
              <${SpeechBubble}>${item.dialog}</${SpeechBubble}>
            </${DialogOverlay}>
          ` : null}
          ${item?.plot?.name ? html`
            <${PlotOverlay}>
              <${Panel} variant="glass" padding="small">
                ${item.plot.name}, Page ${item.plot.page + 1}
              </${Panel}>
            </${PlotOverlay}>
          ` : null}
        </${ImageWrapper}>
        <${NavRow}>
          <${LeftNavGroup}>
            <${NavigatorControl}
              currentPage=${currentIndex}
              totalPages=${items.length}
              onPrev=${onPrev}
              onNext=${onNext}
              onFirst=${onFirst}
              onLast=${onLast}
              showFirstLast=${true}
            />
            ${activeTab === 'parts-plot' ? html`
              <${Button}
                variant="medium-icon"
                icon="download"
                tooltip="Import parts"
                onClick=${onImportPartsPlot}
                disabled=${!canImport || !onImportPartsPlot}
              />
              <${Button}
                variant="medium-icon"
                icon="book"
                tooltip="Import plot page tags"
                onClick=${onImportPlot}
                disabled=${!canImport || !onImportPlot}
              />
            ` : null}
            ${activeTab === 'character-outfits' ? html`
              <${Button}
                variant="medium-icon"
                icon="user"
                tooltip="Import character parts"
                onClick=${onImportCharacter}
                disabled=${!canImport || !onImportCharacter}
              />
              <${Button}
                variant="medium-icon"
                icon="t-shirt"
                tooltip="Import outfit parts"
                onClick=${onImportOutfit}
                disabled=${!canImport || !onImportOutfit}
              />
            ` : null}
            <${Button}
              variant="medium-icon"
              icon="trash"
              tooltip="Delete"
              onClick=${onDelete}
              disabled=${!canDelete}
            />
          </${LeftNavGroup}>
          <${SlideshowControls}>
            <${Button}
              variant="medium-icon"
              icon=${isPlaying ? 'pause' : 'play'}
              onClick=${() => setIsPlaying(p => !p)}
              title=${isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            />
            <${Select}
              value=${intervalSeconds}
              onChange=${e => setIntervalSeconds(Number(e.target.value))}
              widthScale="normal"
              heightScale="compact"
              options=${[
                { label: '3 seconds', value: 3 },
                { label: '5 seconds', value: 5 },
                { label: '10 seconds', value: 10 },
              ]}
            />
          </${SlideshowControls}>
        </${NavRow}>
      </${ViewerContainer}>
    </${Panel}>
  `;
}
