// Custom Toast Module - Class-based implementation
let dismissedToastContainer = null;
let toastContainer = null;
let toastCounter = 0; // For unique IDs
let activeToasts = []; // Track all active toasts in order
const maximumToastsVisible = 1; // Maximum number of toasts that can be visible at once

// Helper function to calculate toast duration based on message length
function calculateToastDuration(text) {
  const baseDuration = text.length * 20; // 20ms per character
  return Math.max(baseDuration, 2000); // Minimum 2 seconds
}

// Toast class to manage individual toast instances
class Toast {
  constructor(text, options = {}) {
    this.id = ++toastCounter;
    this.text = text;
    this.duration = options.duration || calculateToastDuration(text);
    this.backgroundColor = options.backgroundColor || '#2a2a2a';
    this.borderColor = options.borderColor || '#555';
    this.element = null;
    this.hideTimeout = null;
    this.isVisible = false;
    this.isDestroyed = false;
    
    this.create();
    this.show();
    this.addToActiveList();
  }

  create() {
    // Ensure container exists
    this.ensureContainer();

    // Create toast element
    this.element = document.createElement('div');
    this.element.className = 'toast';
    this.element.style.backgroundColor = this.backgroundColor;
    this.element.style.borderColor = this.borderColor;

    const textElement = document.createElement('p');
    textElement.className = 'toast-text';
    textElement.textContent = this.text;

    this.element.appendChild(textElement);
    toastContainer.appendChild(this.element);

    // Add click handler for manual dismissal
    this.element.addEventListener('click', () => this.dismiss());
  }

  show() {
    if (this.isDestroyed) return;

    // Trigger show animation after element is in DOM
    requestAnimationFrame(() => {
      if (this.element && !this.isDestroyed) {
        this.element.classList.add('show');
        this.isVisible = true;
      }
    });

    // Auto-dismiss after duration
    if (this.duration > 0) {
      this.hideTimeout = setTimeout(() => {
        this.dismiss();
      }, this.duration);
    }
  }

  dismiss() {
    if (this.isDestroyed || !this.isVisible) return;

    this.isDestroyed = true;

    // Remove from active toasts list
    this.removeFromActiveList();

    // Clear auto-dismiss timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.element) {
      // Immediately remove from layout to prevent spacing issues
      dismissedToastContainer.appendChild(this.element);
      
      // Add hide class for animation
      setTimeout(() => {this.element.classList.add('hide')}, 100);

      // Remove from DOM after animation completes
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
      }, 300); // Match CSS transition duration
    }
  }

  addToActiveList() {
    // Add this toast to the active list
    activeToasts.push(this);
    
    // Dismiss oldest toasts if we exceed the maximum
    while (activeToasts.length > maximumToastsVisible) {
      const oldestToast = activeToasts[0];
      if (oldestToast && !oldestToast.isDestroyed) {
        oldestToast.dismiss();
      } else {
        // Remove from list if already destroyed
        activeToasts.shift();
      }
    }
  }

  removeFromActiveList() {
    const index = activeToasts.indexOf(this);
    if (index !== -1) {
      activeToasts.splice(index, 1);
    }
  }

  ensureContainer() {
    if (!toastContainer) {
      dismissedToastContainer = document.createElement('div');
      dismissedToastContainer.className = 'toast-container dismissed';
      document.body.appendChild(dismissedToastContainer);
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
}

// Public API functions that create Toast instances
export function showToast(text, duration = 0) {
  return new Toast(text, { duration });
}

export function dismissToast() {
  // This is now a no-op since each toast manages itself
  // Keeping for backward compatibility
}

export function showSuccessToast(text, duration = 0) {
  return new Toast(text, {
    duration,
    borderColor: '#28a745',
    backgroundColor: '#1e3a2e'
  });
}

export function showErrorToast(text, duration = 0) {
  return new Toast(text, {
    duration,
    borderColor: '#dc3545',
    backgroundColor: '#3a1e1e'
  });
}

export function showInfoToast(text, duration = 0) {
  return new Toast(text, {
    duration,
    borderColor: '#17a2b8',
    backgroundColor: '#1e2a3a'
  });
}
