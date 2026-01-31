// Custom Dialog Module
import { render, Component } from 'preact'
import { html } from 'htm/preact'
import { createPortal } from 'preact/compat'
import { currentTheme } from '../theme.mjs'
import { Button } from '../io/button.mjs'
import { Input } from '../io/input.mjs'
import { 
  BaseOverlay, 
  BaseContainer, 
  BaseHeader,
  BaseTitle, 
  BaseContent, 
  BaseFooter 
} from './modal-base.mjs'



// ============================================================================
// Dialog Component
// ============================================================================

// Dialog component
class Dialog extends Component {
  constructor(props) {
    super(props);
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
    if (e.target === e.currentTarget) {
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
      // Create option buttons - first option is danger (destructive action), rest are primary
      return options.map((optionText, index) => {
        const color = index === 0 ? 'danger' : 'primary';
        return html`
          <${Button}
            key=${optionText}
            variant="medium-text"
            color=${color}
            onClick=${() => this.handleOptionClick(optionText)}
            ref=${index === 0 ? (btn) => { if (btn && btn.buttonRef) setTimeout(() => btn.buttonRef.focus(), 0); } : null}
          >
            ${optionText}
          <//>
        `;
      });
    } else {
      // Create default close button for backward compatibility
      return html`
        <${Button}
          variant="medium-text"
          color="secondary"
          onClick=${this.handleClose}
          ref=${(btn) => { if (btn && btn.buttonRef) setTimeout(() => btn.buttonRef.focus(), 0); }}
        >
          Close
        <//>
      `;
    }
  }

  render() {
    const { text, title } = this.props;
    const theme = currentTheme.value;
    
    // Process content text
    const contentText = text.trim() 
      ? text
      : '';
    const isEmpty = !text.trim();

    return createPortal(
      html`
        <${BaseOverlay}
          bgColor=${theme.colors.overlay.background}
          onClick=${this.handleOverlayClick}
          class="dialog-overlay"
        >
          <${BaseContainer}
            bgColor=${theme.colors.background.card}
            textColor=${theme.colors.text.primary}
            borderRadius=${theme.spacing.medium.borderRadius}
            maxWidth="500px"
            maxHeight="400px"
            shadowColor=${theme.shadow.colorStrong}
          >
            <${BaseHeader} marginBottom="16px">
              <${BaseTitle} 
                color=${theme.colors.text.primary}
                fontFamily=${theme.typography.fontFamily}
                fontWeight=${theme.typography.fontWeight.bold}
              >
                ${title}
              <//>
            <//>
            <${BaseContent}
              isEmpty=${isEmpty}
              color=${isEmpty ? theme.colors.text.muted : theme.colors.text.secondary}
              fontFamily=${theme.typography.fontFamily}
              fontSize=${theme.typography.fontSize.medium}
              marginBottom="20px"
            >
              ${contentText}
            <//>
            <${BaseFooter} 
              gap="10px"
              marginTop="20px"
            >
              ${this.renderButtons()}
            <//>
          <//>
        <//>
      `,
      document.body
    );
  }
}

// ============================================================================
// TextPromptDialog Component
// ============================================================================

// TextPromptDialog component
class TextPromptDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: props.initialValue || ''
    };
  }

  componentDidMount() {
    // Set up keyboard listeners
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    // Clean up event listener
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.handleCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.handleConfirm();
    }
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }

  handleInputChange = (e) => {
    this.setState({ inputValue: e.target.value });
  }

  handleConfirm = () => {
    if (this.props.onConfirm) {
      this.props.onConfirm(this.state.inputValue);
    }
  }

  handleCancel = () => {
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  }

  render() {
    const { title, placeholder } = this.props;
    const { inputValue } = this.state;
    const theme = currentTheme.value;

    return createPortal(
      html`
        <${BaseOverlay}
          bgColor=${theme.colors.overlay.background}
          onClick=${this.handleOverlayClick}
        >
          <${BaseContainer}
            bgColor=${theme.colors.background.card}
            textColor=${theme.colors.text.primary}
            borderRadius=${theme.spacing.medium.borderRadius}
            maxWidth="500px"
            maxHeight="400px"
            minWidth="400px"
            shadowColor=${theme.shadow.colorStrong}
          >
            <${BaseHeader} marginBottom="16px">
            <${BaseTitle}
              color=${theme.colors.text.primary}
              fontFamily=${theme.typography.fontFamily}
              fontWeight=${theme.typography.fontWeight.bold}
            >
              ${title}
            <//>
            <//>
            <${BaseContent}
              as="div"
              color=${theme.colors.text.secondary}
              fontFamily=${theme.typography.fontFamily}
              fontSize=${theme.typography.fontSize.medium}
              marginBottom="20px"
            >
              <${Input}
                type="text"
                value=${inputValue}
                placeholder=${placeholder || ''}
                onInput=${this.handleInputChange}
                fullWidth=${true}
              />
            <//>
            <${BaseFooter}
              gap="10px"
              marginTop="20px"
            >
              <${Button}
                variant="medium-text"
                color="secondary"
                onClick=${this.handleCancel}
              >
                Cancel
              <//>
              <${Button}
                variant="medium-text"
                color="primary"
                onClick=${this.handleConfirm}
                ref=${(btn) => { if (btn && btn.buttonRef) setTimeout(() => btn.buttonRef.focus(), 0); }}
              >
                OK
              <//>
            <//>
          <//>
        <//>
      `,
      document.body
    );
  }
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Dialog - Modal dialog component with overlay
 * 
 * Displays a custom modal dialog with title, content text, and action buttons.
 * The dialog is automatically centered on screen with an overlay background.
 * Users can close the dialog by clicking buttons, clicking the overlay, or pressing Escape.
 * Supports portal rendering to ensure proper z-index stacking.
 * 
 * Internal component - use showDialog() or showTextPrompt() functions to display.
 * 
 * @param {Object} props
 * @param {string} props.text - The main content text to display (required)
 * @param {string} [props.title='Generate Image'] - The title displayed in header
 * @param {Array<string>} [props.options] - Array of button labels. First option is styled as danger (destructive).
 * @param {Function} props.onClose - Callback when dialog closes, receives selected option or null (required)
 * @returns {preact.VNode}
 */

/**
 * TextPromptDialog - Text input dialog component
 * 
 * Displays a modal dialog with a text input field for user entry.
 * Includes Cancel and OK buttons. Enter key confirms, Escape key cancels.
 * 
 * Internal component - use showTextPrompt() function to display.
 * 
 * @param {Object} props
 * @param {string} props.title - Dialog title (required)
 * @param {string} [props.initialValue=''] - Initial value for text input
 * @param {string} [props.placeholder=''] - Placeholder text for input field
 * @param {Function} props.onConfirm - Callback when OK clicked, receives input value (required)
 * @param {Function} props.onCancel - Callback when cancelled (required)
 * @returns {preact.VNode}
 */

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
    // First unmount the component
    render(null, container);
    // Then remove the container
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

/**
 * Displays a text prompt dialog with an input field.
 * 
 * @param {string} title - The title to display in the dialog header
 * @param {string} [initialValue=''] - Initial value for the text input
 * @param {string} [placeholder=''] - Placeholder text for the input field
 * 
 * @returns {Promise<string|null>} - Promise that resolves with the input value on confirm, or null on cancel
 * 
 * @example
 * const folderName = await showTextPrompt('Enter folder name', '', 'My Folder');
 * if (folderName) {
 *   // User confirmed with folderName
 * } else {
 *   // User cancelled
 * }
 */
export function showTextPrompt(title, initialValue = '', placeholder = '') {
  console.log('showTextPrompt called with:', { title, initialValue, placeholder });

  // Create container element
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Function to clean up dialog
  const cleanup = () => {
    // First unmount the component
    render(null, container);
    // Then remove the container
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  };

  return new Promise((resolve) => {
    const handleConfirm = (value) => {
      cleanup();
      resolve(value);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    render(html`<${TextPromptDialog} 
      title=${title}
      initialValue=${initialValue}
      placeholder=${placeholder}
      onConfirm=${handleConfirm}
      onCancel=${handleCancel}
    />`, container);
  });
}
