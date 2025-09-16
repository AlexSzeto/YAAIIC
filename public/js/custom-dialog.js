// Custom Dialog Module
export function showDialog(text, title = 'Generate Image') {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';

  // Create dialog box
  const dialog = document.createElement('div');
  dialog.className = 'dialog-box';

  // Create dialog content
  const titleElement = document.createElement('h3');
  titleElement.className = 'dialog-title';
  titleElement.textContent = title;

  const content = document.createElement('p');
  content.className = 'dialog-content';
  
  if (text.trim()) {
    content.textContent = `Description text: "${text}"`;
  } else {
    content.textContent = 'No description text provided.';
    content.classList.add('empty');
  }

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'dialog-close-button';
  closeButton.textContent = 'Close';

  closeButton.addEventListener('click', function() {
    closeDialog(overlay);
  });

  // Close dialog when clicking outside
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeDialog(overlay);
    }
  });

  // Close dialog with Escape key
  const handleEscape = function(e) {
    if (e.key === 'Escape') {
      closeDialog(overlay);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Assemble dialog
  dialog.appendChild(titleElement);
  dialog.appendChild(content);
  dialog.appendChild(closeButton);
  overlay.appendChild(dialog);

  // Add to page
  document.body.appendChild(overlay);

  // Focus the close button for accessibility
  closeButton.focus();
}

function closeDialog(overlay) {
  if (overlay && overlay.parentNode) {
    document.body.removeChild(overlay);
  }
}
