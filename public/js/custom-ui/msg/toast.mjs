import { html } from 'htm/preact';
import { createContext } from 'preact';
import { useContext, useState, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled, keyframes } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Panel } from '../layout/panel.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideOut = keyframes`
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
`;

const ToastContainer = styled('div')`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 15000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.medium.gap};
`;

const ToastWrapper = styled('div')`
  max-width: 400px;
  min-width: 200px;
  pointer-events: auto;
  animation: ${props => props.isRemoving ? slideOut : slideIn} 0.3s ease;
  cursor: pointer;
  
  &:hover {
    opacity: 0.9;
  }
`;

const ToastContent = styled('div')`
  padding: 12px 20px;
  text-align: center;
`;

const ToastText = styled('p')`
  margin: 0;
  line-height: 1.4;
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-family: ${props => props.theme.typography.fontFamily};
`;

// ============================================================================
// Context
// ============================================================================

// Create Context
export const ToastContext = createContext(null);

/**
 * Toast Provider Component
 * Manages the state of toasts and provides the 'show' method.
 * 
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children - App content wrapped by toast provider (required)
 * @returns {preact.VNode}
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const theme = currentTheme.value;

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((text, options = {}) => {
    const id = Date.now() + Math.random();
    const duration = options.duration || Math.max(text.length * 50, 2000);
    const type = options.type || 'info'; // 'info', 'success', 'error'

    // Map type to color property
    let color;
    switch (type) {
      case 'success':
        color = 'success';
        break;
      case 'error':
        color = 'danger';
        break;
      case 'info':
      default:
        color = 'secondary';
        break;
    }

    const newToast = { id, text, duration, color, isRemoving: false };

    setToasts(prev => [...prev.slice(-4), newToast]); // Keep max 5

    if (duration > 0) {
      setTimeout(() => {
        // Mark as removing to trigger exit animation
        setToasts(prev => prev.map(t => t.id === id ? { ...t, isRemoving: true } : t));
        // Actually remove after animation completes
        setTimeout(() => removeToast(id), 300);
      }, duration);
    }
  }, [removeToast, theme]);

  const value = {
    show,
    success: (text, duration) => show(text, { type: 'success', duration }),
    error: (text, duration) => show(text, { type: 'error', duration }),
    info: (text, duration) => show(text, { type: 'info', duration }),
  };

  return html`
    <${ToastContext.Provider} value=${value}>
      ${children}
      ${createPortal(html`
        <${ToastContainer} theme=${theme}>
          ${toasts.map(toast => html`
            <${ToastWrapper}
              key=${toast.id}
              isRemoving=${toast.isRemoving}
              onClick=${() => {
                setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, isRemoving: true } : t));
                setTimeout(() => removeToast(toast.id), 300);
              }}
            >
              <${Panel} variant="elevated" color=${toast.color}>
                <${ToastContent}>
                  <${ToastText} theme=${theme}>${toast.text}</>
                </>
              </>
            <//>
          `)}
        <//>
      `, document.body)}
    <//>
  `;
}

/**
 * Hook to use Toast
 * Provides methods to show toast notifications with different variants.
 * 
 * @returns {Object} Toast methods
 * @returns {Function} return.show - Show toast with custom options: show(text, { type: 'info'|'success'|'error', duration: number })
 * @returns {Function} return.success - Show success toast: success(text, duration?)
 * @returns {Function} return.error - Show error toast: error(text, duration?)
 * @returns {Function} return.info - Show info toast: info(text, duration?)
 * 
 * @example
 * const toast = useToast();
 * toast.success('Operation completed!');
 * toast.error('Something went wrong');
 * toast.show('Custom message', { type: 'info', duration: 5000 });
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
