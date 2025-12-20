import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { createImageModal } from './modal.mjs';

/**
 * ImageUpload Component
 * A reusable component for uploading images via file selection or gallery.
 */
export function ImageUpload({ 
  label,
  value, // string (URL) or Blob/File
  onChange, // (fileOrUrl) => void
  onSelectFromGallery,
  disabled = false
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Update preview when value changes
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }

    if (typeof value === 'string') {
      setPreviewUrl(value);
    } else if (value instanceof Blob || value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [value]);

  const handleFileSelect = (e) => {
    if (disabled) return;
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.error('Selected file is not an image');
      return;
    }
    
    // Pass the file up
    if (onChange) onChange(file);
    
    // Clear input so same file can be selected again if needed
    e.target.value = '';
  };

  const handleUploadClick = (e) => {
    // Only open file dialog if we don't have an image, or if we want to replace it?
    // User flow: 
    // - empty -> click -> open file (or gallery depending on implementation details)
    // - filled -> click -> open preview
    
    // The previous implementation:
    // - hasImage: preview click
    // - !hasImage: gallery click (if props.onGalleryRequest) OR file input if no gallery request? 
    // Actually the logic was: `onClick=${hasImage ? this.handlePreviewClick : this.handleGalleryClick}`
    // And `handleGalleryClick` calls `onGalleryRequest`.
    
    // But what if I want to upload a file from disk explicitly?
    // The previous component had a hidden file input but only triggered it... wait.
    // `handleGalleryClick`: if (this.props.onGalleryRequest) ... 
    // It didn't seem to trigger file input unless `onGalleryRequest` wasn't passed?
    // Looking at old code: 
    // handleUploadClick trigered fileInputRef.click(). 
    // But the main render onclick was: `onClick=${hasImage ? this.handlePreviewClick : this.handleGalleryClick}`
    // So if I click the box, it opens gallery. How do I upload from disk?
    // Ah, maybe the user wants both options.
    
    // Let's improve UI:
    // If empty: Show "Select Image" (triggers Gallery if available, or File Input?)
    // Maybe we should allow both?
    // For now, let's replicate: Click -> Gallery.
    // But how to get file from disk?
    // Perhaps `onSelectFromGallery` handles that choice?
    
    // Re-reading task: "Convert to: export function ImageUpload(...)".
    // "Refactor Image Upload (`custom-ui/image-upload.mjs`)"
    
    // I will add a small button for "Upload from Disk" if possible, or just default to file input if onSelectFromGallery is strictly for gallery.
    // Let's assume the main click triggers `onSelectFromGallery` which opens a modal that might have "Upload" tab?
    // Or, simpler: Main click triggers File Input. Gallery button (if provided) triggers Gallery.
    
    // Old code:
    // hasImage ? handlePreviewClick : handleGalleryClick
    
    // I will make the empty state click trigger onSelectFromGallery if provided, otherwise file input.
    // And I will add a small "upload" icon/button for file input explicitly?
    
    e.stopPropagation();
    if (disabled) return;
    
    if (previewUrl) {
      if (typeof value === 'string') {
        createImageModal(value, true);
      } else if (previewUrl) {
         createImageModal(previewUrl, true);
      }
    } else {
        if (onSelectFromGallery) {
            onSelectFromGallery();
        } else {
            fileInputRef.current.click();
        }
    }
  };

  const handleClearClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) onChange(null);
  };

  const triggerFileUpload = (e) => {
      e.stopPropagation();
      if (disabled) return;
      fileInputRef.current.click();
  };

  return html`
    <div class="image-upload-component">
      ${label && html`<label class="input-label">${label}</label>`}
      <input
        type="file"
        ref=${fileInputRef}
        accept="image/*"
        style="display: none;"
        onChange=${handleFileSelect}
        disabled=${disabled}
      />
      
      <div 
        class="image-upload-area ${previewUrl ? 'has-image' : ''} ${disabled ? 'disabled' : ''}"
        onClick=${handleUploadClick}
      >
        ${previewUrl ? html`
          <!-- Image Preview -->
          <img 
            src=${previewUrl} 
            alt="Upload preview" 
            class="image-upload-preview"
          />
          
          <!-- Overlay Buttons -->
          <div class="image-upload-overlay">
            <button 
              class="image-upload-btn image-upload-clear-btn"
              onClick=${handleClearClick}
              title="Clear image"
            >
              <box-icon name='x' color='#ffffff' size='20px'></box-icon>
            </button>
            <button
               class="image-upload-btn image-upload-replace-btn"
               onClick=${(e) => { e.stopPropagation(); if(onSelectFromGallery) onSelectFromGallery(); else fileInputRef.current.click(); }}
               title="Replace image"
               style="margin-right: 8px;"
            >
               <box-icon name='image' color='#ffffff' size='20px'></box-icon>
            </button>
          </div>
        ` : html`
          <!-- Empty State -->
          <div class="image-upload-empty">
            <box-icon name='image-add' color='#888888' size='48px'></box-icon>
            <div class="image-upload-text">Select Image</div>
            <div class="image-upload-subtext">From Gallery</div>
            
            <!-- File upload explicit button -->
            <button 
                class="btn-text-only" 
                style="margin-top: 8px; font-size: 0.8rem; color: var(--text-secondary);"
                onClick=${triggerFileUpload}
            >
                Or upload from device
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

