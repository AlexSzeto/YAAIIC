/**
 * image-preview.mjs – Standardized 128×128 clickable image preview for the AnyTale page.
 *
 * Clicking the preview opens the full-size image in a modal (when a src is available).
 * An optional loading overlay is shown while a preview is being generated.
 *
 * Props:
 *   @param {string}  [src]            – Image URL; if falsy, shows placeholder text.
 *   @param {string}  [alt]            – Alt text for the image element.
 *   @param {boolean} [isGenerating]   – Show a "Generating…" overlay when true.
 *   @param {string}  [placeholderText] – Text shown when no src is available.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { createImageModal } from '../../custom-ui/overlays/modal.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const PreviewArea = styled('div')`
  flex: 0 0 128px;
  width: 128px;
  height: 128px;
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  border: ${() => `${currentTheme.value.border.width} ${currentTheme.value.border.style} ${currentTheme.value.colors.border.secondary}`};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
`;
PreviewArea.className = 'anytale-image-preview-area';

const PreviewImage = styled('img')`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
`;
PreviewImage.className = 'anytale-image-preview-img';

const PreviewPlaceholder = styled('div')`
  color: ${() => currentTheme.value.colors.text.muted};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  text-align: center;
  padding: ${() => currentTheme.value.spacing.small.padding};
`;
PreviewPlaceholder.className = 'anytale-image-preview-placeholder';

const LoadingOverlay = styled('div')`
  position: absolute;
  inset: 0;
  background-color: ${() => currentTheme.value.colors.overlay.glass};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.primary};
`;
LoadingOverlay.className = 'anytale-image-preview-loading';

// ============================================================================
// Component
// ============================================================================

/**
 * ImagePreview
 *
 * @param {Object}  props
 * @param {string}  [props.src]             – Image URL to display.
 * @param {string}  [props.alt]             – Alt text.
 * @param {boolean} [props.isGenerating]    – Show loading overlay.
 * @param {string}  [props.placeholderText] – Placeholder text when no image.
 */
export function ImagePreview({ src, alt = 'Preview', isGenerating = false, placeholderText = 'No preview' }) {
  const handleClick = useCallback(() => {
    if (src) createImageModal(src);
  }, [src]);

  return html`
    <${PreviewArea}
      onClick=${handleClick}
      style=${{ cursor: src ? 'pointer' : 'default' }}
      title=${src ? 'Click to view full size' : ''}
    >
      ${src
        ? html`<${PreviewImage} src=${src} alt=${alt} />`
        : html`<${PreviewPlaceholder}>${placeholderText}</${PreviewPlaceholder}>`
      }
      ${isGenerating
        ? html`<${LoadingOverlay}>Generating…</${LoadingOverlay}>`
        : null
      }
    </${PreviewArea}>
  `;
}
