import { render, Component } from 'preact';
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
 * This component subscribes to SSE progress updates and displays a fixed banner
 * at the top of the page showing the current progress, percentage, and step name.
 */
class ProgressBanner extends Component {
  constructor(props) {
    super(props);
    
    // Initial state
    this.state = {
      isVisible: true,
      status: 'starting',  // starting, in-progress, completed, error
      percentage: 0,
      message: 'Starting generation...',
      currentValue: 0,
      maxValue: 0
    };
    
    // Create page title manager instance with custom default title from props or document.title
    const defaultTitle = props.defaultTitle || document.title;
    this.pageTitleManager = new PageTitleManager(defaultTitle);
  }

  componentDidMount() {
    // Subscribe to SSE updates when component mounts
    const { taskId, sseManager } = this.props;
    
    if (!sseManager || !taskId) {
      console.error('ProgressBanner requires sseManager and taskId props');
      return;
    }

    sseManager.subscribe(taskId, {
      onProgress: this.handleProgressUpdate.bind(this),
      onComplete: this.handleComplete.bind(this),
      onError: this.handleError.bind(this)
    });
  }

  componentWillUnmount() {
    // Unsubscribe from SSE when component unmounts
    const { taskId, sseManager } = this.props;
    
    if (sseManager && taskId) {
      sseManager.unsubscribe(taskId);
    }
  }

  /**
   * Handle progress update from SSE
   * @param {Object} data - Progress data from server
   */
  handleProgressUpdate(data) {
    if (!data.progress) return;

    // Use currentStep if provided, otherwise derive from node type
    let message = data.progress.currentStep || 'Processing...';
    
    // If we have node information, use the mapped step name
    if (data.progress.node) {
      message = getStepName(data.progress.node);
    }

    // Format page title with step indicator if currentValue and maxValue are available
    let titleMessage = message;
    if (data.progress.currentValue > 0 && data.progress.maxValue > 0) {
      titleMessage = `(${data.progress.currentValue}/${data.progress.maxValue}) ${message}`;
    }

    // Update page title with progress information
    this.pageTitleManager.update(titleMessage);

    this.setState({
      status: 'in-progress',
      percentage: data.progress.percentage || 0,
      message: message,
    });
  }

  /**
   * Handle completion event from SSE
   * @param {Object} data - Completion data from server
   */
  handleComplete(data) {
    // Reset page title to default
    this.pageTitleManager.reset();
    
    this.setState({
      status: 'completed',
      percentage: 100,
      message: 'Complete!',
      currentValue: data.progress?.maxValue || 0,
      maxValue: data.progress?.maxValue || 0
    });

    // Call the onComplete callback if provided
    if (this.props.onComplete) {
      this.props.onComplete(data);
    }

    // Auto-hide the banner after a short delay
    setTimeout(() => {
      this.setState({ isVisible: false });
    }, 2000);
  }

  /**
   * Handle error event from SSE
   * @param {Object} data - Error data from server
   */
  handleError(data) {
    // Reset page title to default
    this.pageTitleManager.reset();
    
    this.setState({
      status: 'error',
      percentage: 0,
      message: data.error?.message || 'Generation failed'
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(data);
    }

    // Auto-hide after showing error
    setTimeout(() => {
      this.setState({ isVisible: false });
    }, 5000);
  }

  /**
   * Handle manual dismiss of the banner
   */
  handleDismiss() {
    this.setState({ isVisible: false });
  }

  /**
   * Get the appropriate CSS class for the current status
   */
  getStatusClass() {
    const { status } = this.state;
    switch (status) {
      case 'completed':
        return 'progress-banner-success';
      case 'error':
        return 'progress-banner-error';
      case 'in-progress':
      case 'starting':
      default:
        return 'progress-banner-active';
    }
  }

  render() {
    const { isVisible, percentage, message } = this.state;

    if (!isVisible) {
      return null;
    }

      return html`
        <div class="progress-banner ${this.getStatusClass()}">
          <div class="progress-banner-content">
            <div class="progress-banner-info">
              <span class="progress-banner-message">${message}</span>
              ${percentage > 0 ? html`<span class="progress-banner-percentage">${Math.round(percentage)}%</span>` : null}
            </div>
            ${percentage > 0 ? html`
              <div class="progress-banner-bar-container">
                <div 
                  class="progress-banner-bar" 
                  style="width: ${percentage}%"
                ></div>
              </div>
            ` : null}
          </div>
          <button 
            class="progress-banner-dismiss" 
            onClick=${() => this.handleDismiss()}
            aria-label="Dismiss"
          >
            <box-icon name='x' color='currentColor'></box-icon>
          </button>
        </div>
      `;
  }
}

/**
 * Create and mount a progress banner for a task
 * @param {string} taskId - Task identifier
 * @param {Object} sseManager - SSEManager instance
 * @param {Function} onComplete - Callback when generation completes
 * @param {Function} onError - Callback when generation fails (optional)
 * @returns {Object} - Object with unmount function
 */
export function createProgressBanner(taskId, sseManager, onComplete, onError) {
  // Create container element if it doesn't exist
  let container = document.getElementById('progress-banner-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'progress-banner-container';
    document.body.insertBefore(container, document.body.firstChild);
  }

  // Render the component
  render(
    html`<${ProgressBanner} 
      taskId=${taskId} 
      sseManager=${sseManager} 
      onComplete=${onComplete}
      onError=${onError}
    />`,
    container
  );

  // Return unmount function
  return {
    unmount: () => {
      render(null, container);
    }
  };
}

export default ProgressBanner;
