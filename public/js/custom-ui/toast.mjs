import { html } from 'htm/preact';
import { createContext, useContext, useState, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';

// Create Context
export const ToastContext = createContext(null);

/**
 * Toast Provider Component
 * Manages the state of toasts and provides the 'show' method.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((text, options = {}) => {
    const id = Date.now() + Math.random();
    const duration = options.duration || Math.max(text.length * 50, 2000);
    const type = options.type || 'info'; // 'info', 'success', 'error'

    let backgroundColor = '#2a2a2a';
    let borderColor = '#555';

    if (type === 'success') {
      borderColor = '#28a745';
      backgroundColor = '#1e3a2e';
    } else if (type === 'error') {
      borderColor = '#dc3545';
      backgroundColor = '#3a1e1e';
    } else if (type === 'info') {
      borderColor = '#17a2b8';
      backgroundColor = '#1e2a3a';
    }

    const newToast = { id, text, duration, backgroundColor, borderColor };

    setToasts(prev => [...prev.slice(-4), newToast]); // Keep max 5

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const value = {
    show,
    success: (text, duration) => show(text, { type: 'success', duration }),
    error: (text, duration) => show(text, { type: 'error', duration }),
    info: (text, duration) => show(text, { type: 'info', duration })
  };

  return html`
    <${ToastContext.Provider} value=${value}>
      ${children}
      ${createPortal(html`
        <div class="toast-container">
          ${toasts.map(toast => html`
            <div 
              class="toast show"
              key=${toast.id}
              style="background-color: ${toast.backgroundColor}; border-color: ${toast.borderColor}; margin-bottom: 10px; cursor: pointer;"
              onClick=${() => removeToast(toast.id)}
            >
              <p class="toast-text">${toast.text}</p>
            </div>
          `)}
        </div>
      `, document.body)}
    <//>
  `;
}

/**
 * Hook to use Toast
 * @returns {Object} { show(text, opt), success(text), error(text), info(text) }
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
