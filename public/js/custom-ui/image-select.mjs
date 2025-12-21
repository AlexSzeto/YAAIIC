import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { createImageModal } from './modal.mjs';

/**
 * ImageSelect Component (formerly ImageUpload)
 * A reusable component for selecting images via gallery or upload.
 */
export function ImageSelect({ 
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

  const handleBoxClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    
    if (previewUrl) {
      // Preview logic
      if (typeof value === 'string') {
        createImageModal(value, true);
      } else if (previewUrl) {
         createImageModal(previewUrl, true);
      }
    } else {
        // Empty state click
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

  return html`
    <div class="image-select-component">
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
        class="image-select-area ${previewUrl ? 'has-image' : ''} ${disabled ? 'disabled' : ''}"
        onClick=${handleBoxClick}
      >
        ${previewUrl ? html`
          <!-- Image Preview -->
          <img 
            src=${previewUrl} 
            alt="Selected image" 
            class="image-select-preview"
          />
          
          <!-- Overlay Buttons -->
          <div class="image-select-overlay">
            <button 
              class="image-select-btn image-select-clear-btn"
              onClick=${handleClearClick}
              title="Clear image"
            >
              <box-icon name='x' color='#ffffff' size='20px'></box-icon>
            </button>
            <button
               class="image-select-btn image-select-replace-btn"
               onClick=${(e) => { e.stopPropagation(); if(onSelectFromGallery) onSelectFromGallery(); else fileInputRef.current.click(); }}
               title="Replace image"
               style="margin-right: 8px;"
            >
               <box-icon name='image' color='#ffffff' size='20px'></box-icon>
            </button>
          </div>
        ` : html`
          <!-- Empty State -->
          <div class="image-select-empty">
            <box-icon name='image-add' color='#888888' size='48px'></box-icon>
            <div class="image-select-text">Select Image</div>
          </div>
        `}
      </div>
    </div>
  `;
}
