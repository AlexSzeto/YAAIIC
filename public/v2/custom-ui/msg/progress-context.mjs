import { html } from 'htm/preact';
import { createContext } from 'preact';
import { useContext, useState, useCallback, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { ProgressBanner } from './progress-banner.mjs';

// ============================================================================
// Context
// ============================================================================

export const ProgressContext = createContext(null);

/**
 * Progress Provider Component
 * Manages the state of progress banners and provides methods to show/hide them.
 * Supports multiple concurrent progress instances.
 * 
 * @param {Object} props
 * @param {Object} props.sseManager - SSE manager instance for subscribing to progress events (required)
 * @param {preact.ComponentChildren} props.children - App content wrapped by provider (required)
 * @returns {preact.VNode}
 */
export function ProgressProvider({ sseManager, children }) {
  const [progresses, setProgresses] = useState({});

  const show = useCallback((taskId, options = {}) => {
    if (!taskId) {
      console.error('ProgressProvider.show: taskId is required');
      return;
    }

    const newProgress = {
      id: taskId,
      taskId,
      sseManager,
      onComplete: options.onComplete,
      onError: options.onError,
      defaultTitle: options.defaultTitle,
      visible: true
    };

    setProgresses(prev => ({
      ...prev,
      [taskId]: newProgress
    }));
  }, [sseManager]);

  const hide = useCallback((taskId) => {
    setProgresses(prev => {
      const { [taskId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clear = useCallback(() => {
    setProgresses({});
  }, []);

  const value = {
    show,
    hide,
    clear
  };

  return html`
    <${ProgressContext.Provider} value=${value}>
      ${children}
      ${createPortal(html`
        <div>
          ${Object.values(progresses).map(progress => html`
            <${ProgressBanner}
              key=${progress.id}
              taskId=${progress.taskId}
              sseManager=${progress.sseManager}
              onComplete=${progress.onComplete}
              onError=${progress.onError}
              defaultTitle=${progress.defaultTitle}
              onDismiss=${() => hide(progress.taskId)}
            />
          `)}
        </div>
      `, document.body)}
    <//>
  `;
}

/**
 * Hook to use Progress
 * Provides methods to show, hide, and clear progress banners.
 * 
 * @returns {Object} Progress methods
 * @returns {Function} return.show - Show progress banner: show(taskId, { onComplete?, onError?, defaultTitle? })
 * @returns {Function} return.hide - Hide specific progress banner: hide(taskId)
 * @returns {Function} return.clear - Clear all progress banners: clear()
 * 
 * @example
 * const progress = useProgress();
 * 
 * // Show progress for a task
 * progress.show('task-123', {
 *   onComplete: (data) => console.log('Done!', data),
 *   onError: (data) => console.error('Failed!', data),
 *   defaultTitle: 'My App'
 * });
 * 
 * // Hide specific progress
 * progress.hide('task-123');
 * 
 * // Clear all progress
 * progress.clear();
 */
export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
