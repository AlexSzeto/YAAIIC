import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { createImageModal } from './modal.mjs';
import { Button } from './button.mjs';

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
      previewUrl: initialPreviewUrl
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
    const { theme, previewUrl } = this.state;

    const Container = styled('div')`
      display: flex;
      flex-direction: column;
      min-width: 200px;
    `;

    const Label = styled('label')`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.fontSize.medium};
      margin-bottom: 5px;
      font-weight: ${theme.typography.fontWeight.medium};
    `;

    const SelectArea = styled('div')`
      position: relative;
      width: 152px;
      height: 152px;
      border: 2px dashed ${theme.colors.border.secondary};
      border-radius: ${theme.spacing.medium.borderRadius};
      background-color: ${theme.colors.background.tertiary};
      cursor: ${disabled ? 'default' : 'pointer'};
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color ${theme.transitions.fast}, background-color ${theme.transitions.fast};
      opacity: ${disabled ? '0.4' : '1'};
      
      ${!disabled && !previewUrl ? `
        &:hover {
          border-color: ${theme.colors.primary.background};
          background-color: ${theme.colors.background.hover};
        }
      ` : ''}
      
      ${previewUrl ? `
        border-style: solid;
        border-color: ${theme.colors.border.primary};
      ` : ''}
    `;

    const Preview = styled('img')`
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;

    const Overlay = styled('div')`
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: flex-end;
      padding: ${theme.spacing.small.padding};
      gap: ${theme.spacing.small.gap};
      background: linear-gradient(transparent, ${theme.colors.overlay.backgroundStrong});
      opacity: 0;
      transition: opacity ${theme.transitions.fast};
      
      ${SelectArea}:hover & {
        opacity: 1;
      }
    `;

    const EmptyState = styled('div')`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${theme.spacing.small.gap};
    `;

    const EmptyText = styled('div')`
      color: ${theme.colors.text.muted};
      font-size: ${theme.typography.fontSize.small};
    `;

    return html`
      <${Container}>
        ${label ? html`<${Label}>${label}</${Label}>` : ''}
        <input
          type="file"
          ref=${(el) => { this.fileInputRef = el; }}
          accept="image/*"
          style="display: none;"
          onChange=${this.handleFileSelect}
          disabled=${disabled}
        />
        
        <${SelectArea} onClick=${this.handleBoxClick}>
          ${previewUrl ? html`
            <!-- Image Preview -->
            <${Preview} src=${previewUrl} alt="Selected image" />
            
            <!-- Overlay Buttons (hidden when disabled) -->
            ${!disabled ? html`
              <${Overlay}>
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
              </${Overlay}>
            ` : ''}
          ` : html`
            <!-- Empty State -->
            <${EmptyState}>
              <box-icon name='image-add' color=${theme.colors.text.muted} size='48px'></box-icon>
              <${EmptyText}>Select Image</${EmptyText}>
            </${EmptyState}>
          `}
        </${SelectArea}>
      </${Container}>
    `;
  }
}
