import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';
import { styled, keyframes } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { PageTitleManager } from '../util.mjs';
import { Panel } from '../layout/panel.mjs';
import { Icon } from '../layout/icon.mjs';
import { useToast } from '../msg/toast.mjs';

// Animations
const slideUp = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// Styled components
const BannerWrapper = styled('div')`
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 5000;
  max-width: 400px;
  min-width: 320px;
  animation: ${slideUp} 0.3s ease-out;
`;
BannerWrapper.className = 'banner-wrapper';

const BannerContent = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;
BannerContent.className = 'banner-content';

const Content = styled('div')`
  flex: 1;
  min-width: 0;
`;
Content.className = 'content';

const Info = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${() => currentTheme.value.spacing.medium.margin};
  gap: 12px;
`;
Info.className = 'info';

const Message = styled('span')`
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
Message.className = 'message';

const Percentage = styled('span')`
  color: ${() => currentTheme.value.colors.text.secondary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  flex-shrink: 0;
`;
Percentage.className = 'percentage';

const BarContainer = styled('div')`
  width: 100%;
  height: 6px;
  background-color: ${() => currentTheme.value.colors.overlay.background};
  border-radius: 3px;
  overflow: hidden;
`;
BarContainer.className = 'bar-container';

const Bar = styled('div')`
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease-in-out;
  width: ${props => props.percentage}%;
  
  ${props => {
    if (props.status === 'success') {
      return `background: linear-gradient(90deg, #22c55e, #16a34a);`;
    } else if (props.status === 'error') {
      return `background: linear-gradient(90deg, #ef4444, #dc2626);`;
    } else {
      return `background: linear-gradient(90deg, ${currentTheme.value.colors.primary.background}, ${currentTheme.value.colors.primary.hover});`;
    }
  }}
`;
Bar.className = 'bar';

const DismissButton = styled('button')`
  background: none;
  border: none;
  color: ${() => currentTheme.value.colors.text.secondary};
  cursor: pointer;
  padding: ${() => currentTheme.value.spacing.small.padding};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  transition: background-color ${() => currentTheme.value.transitions.fast}, 
              color ${() => currentTheme.value.transitions.fast};
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background-color: ${() => currentTheme.value.colors.background.hover};
    color: ${() => currentTheme.value.colors.text.primary};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${() => currentTheme.value.colors.primary.focus};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
DismissButton.className = 'dismiss-button';

/**
 * ProgressBanner - Displays real-time progress updates for image generation tasks
 * 
 * This component subscribes to SSE progress updates via the passed sseManager and displays
 * a fixed banner at the bottom-right of the screen. It automatically maps ComfyUI node types
 * to human-readable step names and updates the browser page title with progress percentage.
 * 
 * The banner calls onDismiss after completion (2 seconds) or error (5 seconds), and
 * when manually dismissed by clicking the X button. Parent controls mounting/unmounting.
 * 
 * @param {Object} props
 * @param {string} props.taskId - The unique task ID to monitor (required)
 * @param {Object} props.sseManager - SSE manager instance for subscribing to progress events (required)
 * @param {Function} [props.onComplete] - Callback when generation completes successfully
 * @param {Function} [props.onError] - Callback when generation fails
 * @param {Function} [props.onCancelled] - Callback when generation is cancelled
 * @param {Function} [props.onCancel] - Called when the user clicks the cancel (trash) button
 * @param {string} [props.defaultTitle] - Default page title to restore after completion
 * @param {Function} [props.onDismiss] - Callback when banner should be dismissed (required for provider pattern)
 * @returns {preact.VNode}
 * 
 * @example
 * // Used with ProgressProvider (recommended)
 * const progress = useProgress();
 * progress.show('task-123', {
 *   onComplete: (data) => console.log('Done!', data),
 *   onError: (data) => console.error('Failed!', data),
 *   onCancel: async () => { await fetch('/generate/cancel', { method: 'POST', body: JSON.stringify({ taskId: 'task-123' }) }); },
 *   defaultTitle: 'Image Generator'
 * });
 */
export function ProgressBanner({ 
  taskId, 
  sseManager, 
  onComplete, 
  onError,
  onCancelled,
  onCancel,
  defaultTitle,
  onDismiss
}) {
  const toast = useToast();
  const [state, setState] = useState({
    status: 'starting', // starting, in-progress, cancelling, completed, error
    percentage: 0,
    message: 'Starting generation...',
    currentValue: 0,
    maxValue: 0
  });

  // Effect for SSE subscription
  useEffect(() => {
    if (!sseManager || !taskId) return;

    // Capture the current document title before creating PageTitleManager
    // This ensures we reset to the actual page title, not a potentially modified defaultTitle prop
    const originalTitle = document.title;
    const pageTitleManager = new PageTitleManager(originalTitle);

    const handleProgressUpdate = (data) => {
      if (!data.progress) return;

      // Use currentStep from server (server always provides this)
      const message = data.progress.currentStep || 'Processing...';

      // Add percentage display to the message for page title
      let titleMessage = message;
      if (data.progress.percentage > 0) {
        titleMessage = `(${Math.round(data.progress.percentage)}%) ${message}`;
      }

      // Update page title with percentage
      pageTitleManager.update(titleMessage);

      setState(prev => {
        // Don't overwrite the cancelling state with incoming progress updates
        if (prev.status === 'cancelling') return prev;
        return {
          ...prev,
          status: 'in-progress',
          percentage: data.progress.percentage || 0,
          message: message,
          currentValue: data.progress.currentValue,
          maxValue: data.progress.maxValue
        };
      });
    };

    const handleComplete = (data) => {
      pageTitleManager.reset();
      
      setState(prev => ({
        ...prev,
        status: 'completed',
        percentage: 100,
        message: 'Complete!',
        currentValue: data.progress?.maxValue || 0,
        maxValue: data.progress?.maxValue || 0
      }));

      if (onComplete) onComplete(data);

      // Auto-hide after 2 seconds
      setTimeout(() => {
        if (onDismiss) onDismiss();
      }, 2000);
    };

    const handleError = (data) => {
      pageTitleManager.reset();
      
      setState(prev => ({
        ...prev,
        status: 'error',
        percentage: 0,
        message: data.error?.message || 'Generation failed'
      }));

      if (onError) onError(data);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (onDismiss) onDismiss();
      }, 5000);
    };

    const handleCancelled = (data) => {
      pageTitleManager.reset();
      if (onCancelled) onCancelled(data);
      if (onDismiss) onDismiss();
      toast.info('Generation cancelled');
    };

    // Subscribe
    sseManager.subscribe(taskId, {
      onProgress: handleProgressUpdate,
      onComplete: handleComplete,
      onError: handleError,
      onCancelled: handleCancelled
    });

    // Cleanup
    return () => {
      sseManager.unsubscribe(taskId);
      pageTitleManager.reset();
    };
  }, [taskId, sseManager, onComplete, onError, onCancelled, defaultTitle, onDismiss]);

  const statusType = state.status === 'completed' ? 'success' : state.status;
  const panelColor = statusType === 'success' ? 'success' : statusType === 'error' ? 'danger' : 'secondary';

  // During active generation, show a cancel (trash) button; otherwise show dismiss (x)
  const isActive = state.status === 'starting' || state.status === 'in-progress';
  const isCancelling = state.status === 'cancelling';
  const showCancelButton = (isActive || isCancelling) && !!onCancel;

  const handleCancelClick = useCallback(async () => {
    if (isCancelling) return;
    setState(prev => ({ ...prev, status: 'cancelling', message: 'Cancelling…' }));
    try {
      await onCancel();
    } catch (err) {
      console.error('[ProgressBanner] Cancel failed:', err);
    }
  }, [isCancelling, onCancel]);

  return html`
    <${BannerWrapper}>
      <${Panel} variant="elevated" color=${panelColor}>
        <${BannerContent}>
          <${Content}>
            <${Info}>
              <${Message} status=${statusType}>${state.message}</${Message}>
              ${state.percentage > 0 ? html`<${Percentage}>${Math.round(state.percentage)}%</${Percentage}>` : null}
            </${Info}>
            ${state.percentage > 0 ? html`
              <${BarContainer}>
                <${Bar} 
                  percentage=${state.percentage}
                  status=${statusType}
                />
              </${BarContainer}>
            ` : null}
          </${Content}>
          ${showCancelButton ? html`
            <${DismissButton}
              onClick=${handleCancelClick}
              disabled=${isCancelling}
              aria-label="Cancel generation"
            >
              <${Icon} name='trash' color='currentColor' />
            </${DismissButton}>
          ` : html`
            <${DismissButton}
              onClick=${() => onDismiss && onDismiss()}
              aria-label="Dismiss"
            >
              <${Icon} name='x' color='currentColor' />
            </${DismissButton}>
          `}
        </${BannerContent}>
      </${Panel}>
    </${BannerWrapper}>
  `;
}

export default ProgressBanner;
