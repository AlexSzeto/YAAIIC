import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';
import { PageTitleManager } from '../util.mjs';

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
 * This component subscribes to SSE progress updates via the passed sseManager.
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

    const pageTitleManager = new PageTitleManager(defaultTitle || document.title);

    const handleProgressUpdate = (data) => {
      if (!data.progress) return;

      // Use currentStep if provided, otherwise derive from node type
      let message = data.progress.currentStep || 'Processing...';
      
      // If we have node information, use the mapped step name
      if (data.progress.node) {
        message = getStepName(data.progress.node);
      }

      // Add percentage display to the message for page title
      let titleMessage = message;
      if (data.progress.percentage > 0) {
        titleMessage = `(${data.progress.percentage}%) ${message}`;
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

  const getStatusClass = () => {
    switch (state.status) {
      case 'completed': return 'progress-banner-success';
      case 'error': return 'progress-banner-error';
      default: return 'progress-banner-active';
    }
  };

  return html`
    <div className="progress-banner ${getStatusClass()}">
      <div className="progress-banner-content">
        <div className="progress-banner-info">
          <span className="progress-banner-message">${state.message}</span>
          ${state.percentage > 0 ? html`<span className="progress-banner-percentage">${Math.round(state.percentage)}%</span>` : null}
        </div>
        ${state.percentage > 0 ? html`
          <div className="progress-banner-bar-container">
            <div 
              className="progress-banner-bar" 
              style="width: ${state.percentage}%"
            ></div>
          </div>
        ` : null}
      </div>
      <button 
        className="progress-banner-dismiss" 
        onClick=${() => setState(prev => ({ ...prev, isVisible: false }))}
        aria-label="Dismiss"
      >
        <box-icon name='x' color='currentColor'></box-icon>
      </button>
    </div>
  `;
}

export default ProgressBanner;
