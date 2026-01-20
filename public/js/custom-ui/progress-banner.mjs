import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';
import { styled, keyframes } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { PageTitleManager } from '../util.mjs';

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
const BannerContainer = styled('div')`
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 9999;
  max-width: 400px;
  min-width: 320px;
  background-color: ${() => currentTheme.value.colors.background.card};
  border: ${() => currentTheme.value.border.width} ${() => currentTheme.value.border.style} ${() => currentTheme.value.colors.border.secondary};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  box-shadow: 0 4px 12px ${() => currentTheme.value.colors.shadow.colorStrong}, 0 2px 4px ${() => currentTheme.value.colors.shadow.color};
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  animation: ${slideUp} 0.3s ease-out;

  ${props => props.status === 'success' ? `
    background-color: ${currentTheme.value.colors.success.backgroundLight};
    border-color: ${currentTheme.value.colors.success.border};
  ` : ''}

  ${props => props.status === 'error' ? `
    background-color: ${currentTheme.value.colors.danger.backgroundLight};
    border-color: ${currentTheme.value.colors.danger.border};
  ` : ''}
`;

const Content = styled('div')`
  flex: 1;
  min-width: 0;
`;

const Info = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${() => currentTheme.value.spacing.medium.margin};
  gap: 12px;
`;

const Message = styled('span')`
  color: ${props => {
    if (props.status === 'success') return currentTheme.value.colors.success.background;
    if (props.status === 'error') return currentTheme.value.colors.danger.background;
    return currentTheme.value.colors.text.primary;
  }};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Percentage = styled('span')`
  color: ${() => currentTheme.value.colors.text.secondary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.bold};
  flex-shrink: 0;
`;

const BarContainer = styled('div')`
  width: 100%;
  height: 6px;
  background-color: ${() => currentTheme.value.colors.background.hover};
  border-radius: 3px;
  overflow: hidden;
`;

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
 * The banner automatically dismisses after completion (2 seconds) or error (5 seconds), and
 * can be manually dismissed by clicking the X button.
 * 
 * @param {Object} props
 * @param {string} props.taskId - The unique task ID to monitor (required)
 * @param {Object} props.sseManager - SSE manager instance for subscribing to progress events (required)
 * @param {Function} [props.onComplete] - Callback when generation completes successfully
 * @param {Function} [props.onError] - Callback when generation fails
 * @param {string} [props.defaultTitle] - Default page title to restore after completion
 * @returns {preact.VNode|null}
 * 
 * @example
 * <ProgressBanner 
 *   taskId="task-123" 
 *   sseManager={sseManager}
 *   onComplete={(data) => console.log('Done!', data)}
 *   onError={(data) => console.error('Failed!', data)}
 *   defaultTitle="Image Generator"
 * />
 */
export function ProgressBanner({ 
  taskId, 
  sseManager, 
  onComplete, 
  onError,
  defaultTitle
}) {
  const [state, setState] = useState({
    isVisible: true,
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

      // Auto-hide
      setTimeout(() => {
        setState(prev => ({ ...prev, isVisible: false }));
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

      // Auto-hide
      setTimeout(() => {
        setState(prev => ({ ...prev, isVisible: false }));
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
  }, [taskId, sseManager, onComplete, onError, defaultTitle]);

  if (!state.isVisible) return null;

  const statusType = state.status === 'completed' ? 'success' : state.status;

  return html`
    <${BannerContainer} status=${statusType}>
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
        onClick=${() => setState(prev => ({ ...prev, isVisible: false }))}
        aria-label="Dismiss"
      >
        <box-icon name='x' color='currentColor'></box-icon>
      <//>
    <//>
  `;
}

export default ProgressBanner;
