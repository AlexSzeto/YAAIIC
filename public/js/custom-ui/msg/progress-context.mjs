import { html } from 'htm/preact';
import { createContext } from 'preact';
import { useContext, useState, useCallback, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { ProgressBanner } from './progress-banner.mjs';
import { sseManager } from '../../app-ui/sse-manager.mjs';

// ============================================================================
// Context
// ============================================================================

export const ProgressContext = createContext(null);

/**
 * Progress Provider Component
 * Manages the state of progress banners and provides methods to show/hide them.
 * Supports multiple concurrent progress instances.
 * Fetches active server tasks on mount and exposes them via `activeTasks`.
 *
 * @param {preact.ComponentChildren} props.children - App content wrapped by provider (required)
 * @returns {preact.VNode}
 */
export function ProgressProvider({ children }) {
  const [progresses, setProgresses] = useState({});
  const [activeTasks, setActiveTasks] = useState([]);

  useEffect(() => {
    sseManager.fetchActiveTasks()
      .then(tasks => setActiveTasks(tasks))
      .catch(err => console.error('[ProgressProvider] Failed to fetch active tasks:', err));
  }, []);

  const show = useCallback((taskId, options = {}) => {
    if (!taskId) {
      console.error('ProgressProvider.show: taskId is required');
      return;
    }

    const removeFromActiveTasks = () => {
      setActiveTasks(prev => prev.filter(t => t.taskId !== taskId));
    };

    const wrappedComplete = (data) => {
      removeFromActiveTasks();
      options.onComplete?.(data);
    };
    const wrappedError = (data) => {
      removeFromActiveTasks();
      options.onError?.(data);
    };
    const wrappedCancelled = (data) => {
      removeFromActiveTasks();
      options.onCancelled?.(data);
    };

    // Add to activeTasks if not already present
    setActiveTasks(prev => {
      if (prev.find(t => t.taskId === taskId)) return prev;
      return [...prev, {
        taskId,
        entityType: options.entityType ?? null,
        characterUid: options.characterUid ?? null,
        progress: null
      }];
    });

    // Register banner if not already showing
    setProgresses(prev => {
      if (prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          id: taskId,
          taskId,
          onComplete: wrappedComplete,
          onError: wrappedError,
          onCancelled: wrappedCancelled,
          onCancel: options.onCancel,
          defaultTitle: options.defaultTitle,
          onDismiss: options.onDismiss,
          visible: true
        }
      };
    });
  }, []);

  const hide = useCallback((taskId) => {
    setActiveTasks(prev => prev.filter(t => t.taskId !== taskId));
    setProgresses(prev => {
      const { [taskId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clear = useCallback(() => {
    setActiveTasks([]);
    setProgresses({});
  }, []);

  const value = {
    activeTasks,
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
              sseManager=${sseManager}
              onComplete=${progress.onComplete}
              onError=${progress.onError}
              onCancelled=${progress.onCancelled}
              onCancel=${progress.onCancel}
              defaultTitle=${progress.defaultTitle}
              onDismiss=${() => {
                hide(progress.taskId);
                progress.onDismiss?.();
              }}
            />
          `)}
        </div>
      `, document.body)}
    </${ProgressContext.Provider}>
  `;
}

/**
 * Hook to use Progress
 * Provides methods to show, hide, and clear progress banners, plus the list of active tasks.
 *
 * @returns {Object} Progress context
 * @returns {Array}    return.activeTasks  - Active task list: [{ taskId, entityType, characterUid, progress }]
 * @returns {Function} return.show         - Show progress banner: show(taskId, { onComplete?, onError?, onCancelled?, onCancel?, onDismiss?, defaultTitle?, entityType?, characterUid? })
 * @returns {Function} return.hide         - Hide specific progress banner: hide(taskId)
 * @returns {Function} return.clear        - Clear all progress banners: clear()
 *
 * @example
 * const { show, hide, activeTasks } = useProgress();
 *
 * // Show progress for a task
 * show('task-123', {
 *   onComplete: (data) => console.log('Done!', data),
 *   onError: (data) => console.error('Failed!', data),
 *   defaultTitle: 'My App'
 * });
 *
 * // Hide specific progress
 * hide('task-123');
 *
 * // Check active tasks
 * const portrait = activeTasks.find(t => t.entityType === 'anytale-portrait');
 */
export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
