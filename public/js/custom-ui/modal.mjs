// Custom Image Modal Module
export function createImageModal(url, autoScale = true, title = null, onSelect = null) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'image-modal-overlay';

  // Create modal wrapper (for positioning the close button)
  const modalWrapper = document.createElement('div');
  modalWrapper.className = 'image-modal-wrapper';

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'image-modal-container';

  // Create image element
  const image = document.createElement('img');
  image.src = url;
  image.alt = 'Modal Image';
  image.className = autoScale ? 'image-modal-autoscale' : 'image-modal-original';

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'image-modal-close';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close modal');

  // Handle image loading
  image.addEventListener('load', function() {
    if (autoScale) {
      // Calculate scaling for auto-scale mode
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const padding = 40; // 20px padding on each side
      const maxWidth = windowWidth - padding;
      const maxHeight = windowHeight - padding;
      const imageAspectRatio = image.naturalWidth / image.naturalHeight;
      const windowAspectRatio = maxWidth / maxHeight;
      let scaledWidth, scaledHeight;
      if (imageAspectRatio > windowAspectRatio) {
        scaledWidth = Math.min(maxWidth, image.naturalWidth);
        scaledHeight = scaledWidth / imageAspectRatio;
      } else {
        scaledHeight = Math.min(maxHeight, image.naturalHeight);
        scaledWidth = scaledHeight * imageAspectRatio;
      }
      image.classList.add('image-modal-scaled');
      image.style.width = scaledWidth + 'px';
      image.style.height = scaledHeight + 'px';
      modalContainer.classList.add('image-modal-overflow-visible');
    } else {
      image.classList.add('image-modal-original-size');
      image.style.width = image.naturalWidth + 'px';
      image.style.height = image.naturalHeight + 'px';
      modalContainer.classList.add('image-modal-overflow-auto');
    }
  });

  // Handle image load error
  image.addEventListener('error', function() {
    const errorText = document.createElement('div');
    errorText.className = 'image-modal-error';
    errorText.textContent = 'Failed to load image';
    modalContainer.appendChild(errorText);
    modalContainer.removeChild(image);
  });

  // Close modal function
  const closeModal = function() {
    if (overlay && overlay.parentNode) {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', handleEscape);
    }
  };

  // Handle escape key
  const handleEscape = function(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  // Event listeners
  closeButton.addEventListener('click', closeModal);
  
  // Close when clicking on overlay (but not on the image or container)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Add escape key listener
  document.addEventListener('keydown', handleEscape);

  // Assemble modal
  modalContainer.appendChild(image);
  // If title is provided, create and style the title element
  if (title) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'image-modal-title';
    titleDiv.textContent = title;
    modalWrapper.appendChild(titleDiv);
    modalWrapper.classList.add('image-modal-title-wrapper');
  }
  
  // If onSelect is provided, create a select button
  if (onSelect) {
    const selectButton = document.createElement('button');
    selectButton.className = 'image-modal-select btn-with-icon gallery-load-btn';
    selectButton.textContent = 'Select';
    selectButton.setAttribute('aria-label', 'Select this image');
    
    // Handle select button click
    selectButton.addEventListener('click', function() {
      onSelect(url);
      closeModal();
    });
    
    modalWrapper.appendChild(selectButton);
  }
  
  modalWrapper.appendChild(modalContainer);
  modalWrapper.appendChild(closeButton);
  overlay.appendChild(modalWrapper);

  // Add to page
  document.body.appendChild(overlay);

  // Focus close button for accessibility
  closeButton.focus();
}