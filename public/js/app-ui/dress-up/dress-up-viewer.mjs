/**
 * dress-up-viewer.mjs – Left-column image viewer for the Dress-Up page.
 *
 * Displays the current image at full portrait resolution with prev/next
 * navigation buttons and a {current}/{total} counter.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { createImageModal } from '../../custom-ui/overlays/modal.mjs';

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
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  animation: viewer-fadein 0.4s ease-in-out;
  @keyframes viewer-fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;
StyledImage.className = 'styled-image';

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
 */
export function DressUpViewer({ items = [], currentIndex = 0, onNavigate, onPrev, onNext, onFirst, onLast, currentItem }) {
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
        onPrev && onPrev();
      }, intervalSeconds * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, intervalSeconds, onPrev]);

  // Stop slideshow when there are no images
  useEffect(() => {
    if (!items.length) setIsPlaying(false);
  }, [items.length]);

  // Stop slideshow when the first image is reached
  useEffect(() => {
    if (isPlaying && currentIndex === 0) setIsPlaying(false);
  }, [currentIndex]);

  if (!items.length) {
    return html`
      <${Panel} variant="outlined">
        <${ViewerContainer}>
          <${EmptyState}>No images yet — generate one to get started.</${EmptyState}>
        </${ViewerContainer}>
      </${Panel}>
    `;
  }

  const item = currentItem || items[currentIndex];
  const imageUrl = item?.url || item?.imageUrl || '';

  // prevUrlRef.current is still the old URL during this render; update it after commit.
  const backdropUrl = prevUrlRef.current !== imageUrl ? prevUrlRef.current : '';
  useEffect(() => { prevUrlRef.current = imageUrl; }, [imageUrl]);

  return html`
    <${Panel} variant="outlined">
      <${ViewerContainer}>
        <${ImageWrapper}>
          ${backdropUrl ? html`<${PrevImage} src=${backdropUrl} alt="" />` : ''}
          <${StyledImage}
            key=${imageUrl}
            src=${imageUrl}
            alt=${item?.name || 'Generated image'}
          />
        </${ImageWrapper}>
        <${NavRow}>
          <${NavigatorControl}
            currentPage=${currentIndex}
            totalPages=${items.length}
            onPrev=${onPrev}
            onNext=${onNext}
            onFirst=${onFirst}
            onLast=${onLast}
            showFirstLast=${true}
          />
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
