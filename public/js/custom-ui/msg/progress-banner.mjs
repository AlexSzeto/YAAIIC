import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';
import { styled, keyframes } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { PageTitleManager } from '../util.mjs';
import { Panel } from '../layout/panel.mjs';

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
  z-index: 9999;
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

  &:hover {
    background-color: ${() => currentTheme.value.colors.background.hover};
    color: ${() => currentTheme.value.colors.text.primary};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${() => currentTheme.value.colors.primary.focus};
  }
`;
DismissButton.className = 'dismiss-button';

/**
 * Map ComfyUI node types to human-readable step names
 */
const NODE_STEP_NAMES = {
  'CheckpointLoaderSimple': 'Loading model...',
  'LoraLoaderModelOnly': 'Loading LoRA...',
  'CLIPTextEncode': 'Encoding prompt...',
  'EmptyLatentImage': 'Preparing canvas...',
  'EmptySD3LatentImage': 'Preparing canvas...',
  'FluxGuidance': 'Configuring guidance...',
  'KSampler': 'Sampling image...',
  'VAEDecode': 'Decoding image...',
  'VAEEncodeForInpaint': 'Encoding for inpaint...',
  'LoadImage': 'Loading image...',
  'LoadImageMask': 'Loading mask...',
  'JWImageSaveToPath': 'Saving image...',
  'SaveImage': 'Saving image...'
};

/**
 * Get human-readable step name from node class type
 * @param {string} nodeType - ComfyUI node class type
 * @returns {string} - Human-readable step name
 */
function getStepName(nodeType) {
  return NODE_STEP_NAMES[nodeType] || 'Processing...';
}

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
 *   defaultTitle: 'Image Generator'
 * });
 */
export function ProgressBanner({ 
  taskId, 
  sseManager, 
  onComplete, 
  onError,
  defaultTitle,
  onDismiss
}) {
  const [state, setState] = useState({
    status: 'starting', // starting, in-progress, completed, error
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

      // Priority: 1) currentStep (if provided), 2) mapped node name, 3) fallback
      let message = 'Processing...';
      
      if (data.progress.currentStep) {
        // Use the explicit step name if provided
        message = data.progress.currentStep;
      } else if (data.progress.node) {
        // Otherwise map from node type
        message = getStepName(data.progress.node);
      }

      // Add percentage display to the message for page title
      let titleMessage = message;
      if (data.progress.percentage > 0) {
        titleMessage = `(${Math.round(data.progress.percentage)}%) ${message}`;
      }

      // Update page title with percentage
      pageTitleManager.update(titleMessage);

      setState(prev => ({
        ...prev,
        status: 'in-progress',
        percentage: data.progress.percentage || 0,
        message: message,
        currentValue: data.progress.currentValue,
        maxValue: data.progress.maxValue
      }));
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

    // Subscribe
    sseManager.subscribe(taskId, {
      onProgress: handleProgressUpdate,
      onComplete: handleComplete,
      onError: handleError
    });

    // Cleanup
    return () => {
      sseManager.unsubscribe(taskId);
      pageTitleManager.reset();
    };
  }, [taskId, sseManager, onComplete, onError, defaultTitle, onDismiss]);

  const statusType = state.status === 'completed' ? 'success' : state.status;
  const panelColor = statusType === 'success' ? 'success' : statusType === 'error' ? 'danger' : 'secondary';

  return html`
    <${BannerWrapper}>
      <${Panel} variant="elevated" color=${panelColor}>
        <${BannerContent}>
          <${Content}>
            <${Info}>
              <${Message} status=${statusType}>${state.message}<//>
              ${state.percentage > 0 ? html`<${Percentage}>${Math.round(state.percentage)}%<//>` : null}
            <//>
            ${state.percentage > 0 ? html`
              <${BarContainer}>
                <${Bar} 
                  percentage=${state.percentage}
                  status=${statusType}
                />
              <//>
            ` : null}
          <//>
          <${DismissButton}
            onClick=${() => onDismiss && onDismiss()}
            aria-label="Dismiss"
          >
            <box-icon name='x' color='currentColor'></box-icon>
          <//>
        <//>
      <//>
    <//>
  `;
}

export default ProgressBanner;
