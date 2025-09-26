// Custom Image Modal Module
export function createImageModal(url, autoScale = true) {
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
        // Image is wider relative to window
        scaledWidth = Math.min(maxWidth, image.naturalWidth);
        scaledHeight = scaledWidth / imageAspectRatio;
      } else {
        // Image is taller relative to window
        scaledHeight = Math.min(maxHeight, image.naturalHeight);
        scaledWidth = scaledHeight * imageAspectRatio;
      }
      
      image.style.width = scaledWidth + 'px';
      image.style.height = scaledHeight + 'px';
      modalContainer.style.overflow = 'visible';
    } else {
      // Original size mode - set max dimensions and enable scrolling
      image.style.width = image.naturalWidth + 'px';
      image.style.height = image.naturalHeight + 'px';
      modalContainer.style.maxWidth = '90vw';
      modalContainer.style.maxHeight = '90vh';
      modalContainer.style.overflow = 'auto';
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
  modalWrapper.appendChild(modalContainer);
  modalWrapper.appendChild(closeButton);
  overlay.appendChild(modalWrapper);

  // Add to page
  document.body.appendChild(overlay);

  // Focus close button for accessibility
  closeButton.focus();
}