import { render, Component } from 'preact'
import { html } from 'htm/preact'

// Custom Toast Module - Class-based implementation
let dismissedToastContainer = null;
let toastContainerElement = null;
let activeToasts = []; // Track all active toasts in order
const maximumToastsVisible = 1; // Maximum number of toasts that can be visible at once

// ToastContainer component to manage all toasts
class ToastContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      toasts: []
    };
  }

  addToast = (toastProps) => {
    const newToast = { ...toastProps, id: ++toastCounter };
    
    this.setState(prevState => {
      let newToasts = [...prevState.toasts, newToast];
      
      // Remove excess toasts if we exceed maximum
      while (newToasts.length > maximumToastsVisible) {
        newToasts.shift();
      }
      
      return { toasts: newToasts };
    });

    return newToast.id;
  }

  removeToast = (id) => {
    this.setState(prevState => ({
      toasts: prevState.toasts.filter(toast => toast.id !== id)
    }));
  }

  render() {
    return html`
      <div class="toast-container">
        ${this.state.toasts.map(toast => 
          html`<${Toast} 
            key=${toast.id}
            text=${toast.text}
            duration=${toast.duration}
            backgroundColor=${toast.backgroundColor}
            borderColor=${toast.borderColor}
            onDismiss=${() => this.removeToast(toast.id)}
          />`
        )}
      </div>
    `;
  }
}

// Helper function to ensure toast container exists
function ensureToastContainer() {
  if (!toastContainerElement) {
    toastContainerElement = document.createElement('div');
    document.body.appendChild(toastContainerElement);
    
    // Create the container instance
    window.toastContainerInstance = render(
      html`<${ToastContainer} ref=${(ref) => { window.toastContainerRef = ref; }} />`, 
      toastContainerElement
    );
  }
}

let toastCounter = 0; // For unique IDs

// Helper function to calculate toast duration based on message length
function calculateToastDuration(text) {
  const baseDuration = text.length * 20; // 20ms per character
  return Math.max(baseDuration, 2000); // Minimum 2 seconds
}

// Toast class to manage individual toast instances
class Toast extends Component {
  constructor(props) {
    super(props);
    this.hideTimeout = null;
    this.isDestroyed = false;
    
    this.state = {
      isVisible: false,
      isHiding: false
    };
  }

  componentDidMount() {
    // Trigger show animation after component is mounted
    requestAnimationFrame(() => {
      if (!this.isDestroyed) {
        this.setState({ isVisible: true });
      }
    });

    // Auto-dismiss after duration
    if (this.props.duration > 0) {
      this.hideTimeout = setTimeout(() => {
        this.dismiss();
      }, this.props.duration);
    }
  }

  componentWillUnmount() {
    // Clean up timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  dismiss = () => {
    if (this.isDestroyed || this.state.isHiding) return;

    this.isDestroyed = true;

    // Clear auto-dismiss timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Start hide animation
    this.setState({ isHiding: true });

    // Call parent's onDismiss after animation
    setTimeout(() => {
      if (this.props.onDismiss) {
        this.props.onDismiss();
      }
    }, 300);
  }

  render() {
    const toastClasses = `toast ${this.state.isVisible ? 'show' : ''} ${this.state.isHiding ? 'hide' : ''}`;
    
    return html`
      <div 
        class=${toastClasses}
        style=${{
          backgroundColor: this.props.backgroundColor || '#2a2a2a',
          borderColor: this.props.borderColor || '#555'
        }}
        onClick=${this.dismiss}
      >
        <p class="toast-text">${this.props.text}</p>
      </div>
    `;
  }
}

// Public API functions that create Toast instances
export function showToast(text, duration = 0) {
  ensureToastContainer();
  const calculatedDuration = duration || calculateToastDuration(text);
  
  if (window.toastContainerRef) {
    return window.toastContainerRef.addToast({
      text,
      duration: calculatedDuration
    });
  }
  return null;
}

export function showSuccessToast(text, duration = 0) {
  ensureToastContainer();
  const calculatedDuration = duration || calculateToastDuration(text);
  
  if (window.toastContainerRef) {
    return window.toastContainerRef.addToast({
      text,
      duration: calculatedDuration,
      borderColor: '#28a745',
      backgroundColor: '#1e3a2e'
    });
  }
  return null;
}

export function showErrorToast(text, duration = 0) {
  ensureToastContainer();
  const calculatedDuration = duration || calculateToastDuration(text);
  
  if (window.toastContainerRef) {
    return window.toastContainerRef.addToast({
      text,
      duration: calculatedDuration,
      borderColor: '#dc3545',
      backgroundColor: '#3a1e1e'
    });
  }
  return null;
}

export function showInfoToast(text, duration = 0) {
  ensureToastContainer();
  const calculatedDuration = duration || calculateToastDuration(text);
  
  if (window.toastContainerRef) {
    return window.toastContainerRef.addToast({
      text,
      duration: calculatedDuration,
      borderColor: '#17a2b8',
      backgroundColor: '#1e2a3a'
    });
  }
  return null;
}
