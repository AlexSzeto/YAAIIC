// Custom Dialog Module
import { render, Component } from 'preact'
import { html } from 'htm/preact'

// Dialog component
class Dialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isVisible: true
    };
  }

  componentDidMount() {
    // Set up escape key listener
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    // Clean up event listener
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.handleClose();
    } else if (e.key === 'Enter' && this.props.options && this.props.options.length > 0) {
      // Enter key selects the first option if options are available
      this.handleOptionClick(this.props.options[0]);
    }
  }

  handleOverlayClick = (e) => {
    if (e.target.classList.contains('dialog-overlay')) {
      this.handleClose();
    }
  }

  handleClose = () => {
    if (this.props.onClose) {
      this.props.onClose(null);
    }
  }

  handleOptionClick = (optionText) => {
    if (this.props.onClose) {
      this.props.onClose(optionText);
    }
  }

  renderButtons() {
    const { options } = this.props;
    
    if (options && Array.isArray(options) && options.length > 0) {
      // Create option buttons
      return options.map((optionText, index) => html`
        <button
          key=${optionText}
          class="dialog-option-button"
          onClick=${() => this.handleOptionClick(optionText)}
          ref=${index === 0 ? (btn) => { if (btn) setTimeout(() => btn.focus(), 0); } : null}
        >
          ${optionText}
        </button>
      `);
    } else {
      // Create default close button for backward compatibility
      return html`
        <button
          class="dialog-close-button"
          onClick=${this.handleClose}
          ref=${(btn) => { if (btn) setTimeout(() => btn.focus(), 0); }}
        >
          Close
        </button>
      `;
    }
  }

  render() {
    const { text, title } = this.props;
    
    // Process content text
    const contentText = text.trim() 
      ? text
      : '';
    const contentClass = text.trim() ? 'dialog-content' : 'dialog-content empty';

    return html`
      <div class="dialog-overlay" onClick=${this.handleOverlayClick}>
        <div class="dialog-box">
          <h3 class="dialog-title">${title}</h3>
          <p class=${contentClass}>${contentText}</p>
          <div class="dialog-buttons">
            ${this.renderButtons()}
          </div>
        </div>
      </div>
    `;
  }
}
/**
 * Displays a custom modal dialog with the provided text and title.
 * The dialog is automatically centered on screen with an overlay background.
 * Users can close the dialog by clicking buttons, clicking outside 
 * the dialog, or pressing the Escape key.
 * 
 * @param {string} text - The main content text to display in the dialog body.
 *                       If empty or whitespace-only, shows "No description text provided."
 * @param {string} [title='Generate Image'] - The title to display in the dialog header.
 *                                           Defaults to 'Generate Image' if not provided.
 * @param {Array<string>} [options] - Array of option labels to display as buttons.
 *                                   If provided, returns a Promise that resolves with the selected option.
 *                                   If not provided, shows default "Close" button and returns undefined.
 * 
 * @returns {Promise<string>|undefined} - If options provided, returns Promise that resolves with selected option label.
 *                                       If no options, returns undefined for backward compatibility.
 * 
 * @example
 * // Basic usage with default title (backward compatible)
 * showDialog('This is the dialog content');
 * 
 * @example
 * // Custom title and content (backward compatible)
 * showDialog('Image generation completed successfully!', 'Success');
 * 
 * @example
 * // With custom options - returns a Promise
 * const result = await showDialog('Delete this item?', 'Confirm', ['Delete', 'Cancel']);
 * if (result === 'Delete') {
 *   // User clicked Delete
 * }
 */
export function showDialog(text, title = 'Generate Image', options = null) {
  console.log('showDialog called with:', { text, title, options });

  // Create container element
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Function to clean up dialog
  const cleanup = () => {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  };

  // If options are provided, return a Promise
  if (options && Array.isArray(options) && options.length > 0) {
    return new Promise((resolve) => {
      const handleClose = (selectedOption) => {
        cleanup();
        resolve(selectedOption);
      };

      render(html`<${Dialog} 
        text=${text} 
        title=${title} 
        options=${options} 
        onClose=${handleClose} 
      />`, container);
    });
  } else {
    // Backward compatibility - no return value
    const handleClose = () => {
      cleanup();
    };

    render(html`<${Dialog} 
      text=${text} 
      title=${title} 
      onClose=${handleClose} 
    />`, container);
    
    return undefined;
  }
}
