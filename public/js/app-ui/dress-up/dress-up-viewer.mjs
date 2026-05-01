/**
 * dress-up-viewer.mjs – Left-column image viewer for the Dress-Up page.
 *
 * Displays the current image at full portrait resolution with prev/next
 * navigation buttons and a {current}/{total} counter.
 */
import { html } from 'htm/preact';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { NavigatorControl } from '../../custom-ui/nav/navigator.mjs';
import { Panel } from '../../custom-ui/layout/panel.mjs';
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
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  background-color: ${() => currentTheme.value.colors.background.card};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  overflow: hidden;
`;
ImageWrapper.className = 'image-wrapper';

const StyledImage = styled('img')`
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  cursor: pointer;
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
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

/**
 * @param {Object}   props
 * @param {Array}    props.items        – Array of media-data objects
 * @param {number}   props.currentIndex – Zero-based index of the displayed item
 * @param {Function} props.onNavigate   – Called with new index (selectByIndex)
 * @param {Function} props.onPrev
 * @param {Function} props.onNext
 * @param {Object|null} props.currentItem
 */
export function DressUpViewer({ items = [], currentIndex = 0, onNavigate, onPrev, onNext, currentItem }) {
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

  const handleImageClick = () => {
    if (imageUrl) {
      createImageModal(imageUrl, item?.name || 'Generated Image');
    }
  };

  return html`
    <${Panel} variant="outlined">
      <${ViewerContainer}>
        <${ImageWrapper}>
          <${StyledImage}
            src=${imageUrl}
            alt=${item?.name || 'Generated image'}
            onClick=${handleImageClick}
          />
        </${ImageWrapper}>
        <${NavigatorControl}
          currentPage=${currentIndex}
          totalPages=${items.length}
          onPrev=${onPrev}
          onNext=${onNext}
          showFirstLast=${false}
        />
      </${ViewerContainer}>
    </${Panel}>
  `;
}
