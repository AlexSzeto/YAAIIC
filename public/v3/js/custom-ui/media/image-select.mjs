import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { createImageModal } from '../overlays/modal.mjs';
import { Button } from '../io/button.mjs';
import { Panel } from '../layout/panel.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 200px;
`;

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
`;

const SelectArea = styled('div')`
  position: relative;
  width: 152px;
  height: 152px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: ${props => props.border};
  border-radius: ${props => props.borderRadius};
  background-color: ${props => props.backgroundColor};
  cursor: ${props => props.cursor};
  transition: ${props => props.transition};
  opacity: ${props => props.opacity};
  
  &:hover {
    border-color: ${props => props.hoverBorderColor};
  }
`;

const Preview = styled('img')`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const OverlayWrapper = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  opacity: ${props => props.opacity};
  padding: ${props => props.padding};
  transition: ${props => props.transition};
`;

const OverlayContent = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${props => props.gap};
`;

const EmptyState = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${props => props.gap};
`;

const EmptyText = styled('div')`
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
`;

const HiddenFileInput = styled('input')`
  display: none;
`;

/**
 * ImageSelect Component
 * A reusable component for selecting images via gallery or file upload.
 * Displays a preview area with overlay controls for clearing, replacing,
 * or previewing the selected image.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the select area
 * @param {string|Blob|File} [props.value] - Current image value (URL string or Blob/File)
 * @param {Function} [props.onChange] - Called with new file/URL or null when cleared: (fileOrUrl) => void
 * @param {Function} [props.onSelectFromGallery] - Called when user wants to select from gallery
 * @param {boolean} [props.disabled=false] - Disables all interactions
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic file upload
 * <ImageSelect 
 *   label="Profile Image"
 *   value={imageFile}
 *   onChange={(file) => setImageFile(file)}
 * />
 * 
 * @example
 * // With gallery selection
 * <ImageSelect 
 *   label="Cover Image"
 *   value={imageUrl}
 *   onChange={handleChange}
 *   onSelectFromGallery={() => openGalleryModal()}
 * />
 */
export class ImageSelect extends Component {
  constructor(props) {
    super(props);
    // Initialize previewUrl from value prop if it's a string URL
    const initialPreviewUrl = typeof props.value === 'string' ? props.value : null;
    this.state = {
      theme: currentTheme.value,
      previewUrl: initialPreviewUrl,
      isHovered: false
    };
    this.fileInputRef = null;
    this.prevValueWasBlob = false;
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
    this.updatePreviewUrl();
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup object URL if we created one
    if (this.state.previewUrl && this.props.value instanceof Blob) {
      URL.revokeObjectURL(this.state.previewUrl);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.updatePreviewUrl();
    }
  }

  updatePreviewUrl() {
    const { value } = this.props;
    const { previewUrl } = this.state;

    // Revoke previous object URL if it was created from a Blob
    if (previewUrl && this.prevValueWasBlob) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!value) {
      this.prevValueWasBlob = false;
      this.setState({ previewUrl: null });
      return;
    }

    if (typeof value === 'string') {
      this.prevValueWasBlob = false;
      this.setState({ previewUrl: value });
    } else if (value instanceof Blob || value instanceof File) {
      this.prevValueWasBlob = true;
      const url = URL.createObjectURL(value);
      this.setState({ previewUrl: url });
    }
  }

  handleFileSelect = (e) => {
    if (this.props.disabled) return;
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.error('Selected file is not an image');
      return;
    }
    
    if (this.props.onChange) {
      this.props.onChange(file);
    }
    
    // Clear input so same file can be selected again if needed
    e.target.value = '';
  };

  handleBoxClick = (e) => {
    e.stopPropagation();
    if (this.props.disabled) return;
    
    if (this.state.previewUrl) {
      // Preview the image
      if (typeof this.props.value === 'string') {
        createImageModal(this.props.value, true);
      } else if (this.state.previewUrl) {
        createImageModal(this.state.previewUrl, true);
      }
    } else {
      // Empty state click
      if (this.props.onSelectFromGallery) {
        this.props.onSelectFromGallery();
      } else {
        this.fileInputRef?.click();
      }
    }
  };

  handleClearClick = (e) => {
    e.stopPropagation();
    if (this.props.disabled) return;
    if (this.props.onChange) {
      this.props.onChange(null);
    }
  };

  handleReplaceClick = (e) => {
    e.stopPropagation();
    if (this.props.onSelectFromGallery) {
      this.props.onSelectFromGallery();
    } else {
      this.fileInputRef?.click();
    }
  };

  render() {
    const { label, disabled = false } = this.props;
    const { theme, previewUrl, isHovered } = this.state;

    return html`
      <${Container}>
        ${label ? html`
          <${Label} 
            color=${theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
          >${label}</${Label}>
        ` : ''}
        <${HiddenFileInput}
          type="file"
          ref=${(el) => { this.fileInputRef = el; }}
          accept="image/*"
          onChange=${this.handleFileSelect}
          disabled=${disabled}
        />
        
        <${SelectArea} 
          border=${previewUrl 
            ? `2px solid ${theme.colors.border.primary}` 
            : `2px dashed ${theme.colors.border.secondary}`}
          borderRadius=${theme.spacing.medium.borderRadius}
          backgroundColor=${theme.colors.background.tertiary}
          cursor=${disabled ? 'default' : 'pointer'}
          transition=${`border-color ${theme.transitions.fast}, background-color ${theme.transitions.fast}`}
          opacity=${disabled ? '0.4' : '1'}
          hoverBorderColor=${theme.colors.primary.background}
          onClick=${this.handleBoxClick}
          onMouseEnter=${() => this.setState({ isHovered: true })}
          onMouseLeave=${() => this.setState({ isHovered: false })}
          onClick=${this.handleBoxClick}
        >
          ${previewUrl ? html`
            <!-- Image Preview -->
            <${Preview} src=${previewUrl} alt="Selected image" />
            
            <!-- Overlay Buttons (hidden when disabled) -->
            ${!disabled ? html`
              <${OverlayWrapper} 
                opacity=${isHovered ? '1' : '0'}
                padding=${theme.spacing.small.padding}
                transition=${`opacity ${theme.transitions.fast}`}
              >
                <${Panel} variant="glass">
                  <${OverlayContent} gap=${theme.spacing.small.gap}>
                    <${Button}
                      variant="small-icon"
                      color="secondary"
                      icon="image"
                      onClick=${this.handleReplaceClick}
                      title="Replace image"
                    />
                    <${Button}
                      variant="small-icon"
                      color="danger"
                      icon="x"
                      onClick=${this.handleClearClick}
                      title="Clear image"
                    />
                  </${OverlayContent}>
                </${Panel}>
              </${OverlayWrapper}>
            ` : ''}
          ` : html`
            <!-- Empty State -->
            <${EmptyState} gap=${theme.spacing.small.gap}>
              <box-icon name='image-add' color=${theme.colors.text.muted} size='48px'></box-icon>
              <${EmptyText} 
                color=${theme.colors.text.muted}
                fontSize=${theme.typography.fontSize.small}
              >Select Image</${EmptyText}>
            </${EmptyState}>
          `}
        </${SelectArea}>
      </${Container}>
    `;
  }
}
