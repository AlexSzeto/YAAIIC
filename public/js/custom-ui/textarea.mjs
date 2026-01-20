import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

/**
 * Textarea - Themed multi-line text input with label and error state support
 * 
 * A styled textarea component with optional label, error message display,
 * and full theme integration for all states. Matches Input component styling
 * for visual consistency.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the textarea
 * @param {string} [props.error] - Error message displayed below the textarea
 * @param {string} [props.id] - ID for label association (falls back to name prop)
 * @param {boolean} [props.fullWidth=true] - Whether to span full container width (default true for textareas)
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.placeholder] - Placeholder text
 * @param {number} [props.rows=4] - Number of visible text lines
 * @param {string} [props.name] - Textarea name attribute
 * @param {*} [props.value] - Textarea value
 * @param {Function} [props.onChange] - Change handler
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic textarea with label
 * <Textarea label="Description" name="description" />
 * 
 * @example
 * // Textarea with error state
 * <Textarea label="Comments" error="Comments are required" />
 * 
 * @example
 * // Textarea with custom rows
 * <Textarea label="Notes" rows={6} />
 */
export class Textarea extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value
    };
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const { 
      label, 
      error, 
      id, 
      fullWidth = true, 
      disabled = false,
      rows = 4,
      ...rest 
    } = this.props;
    const { theme } = this.state;

    const inputId = id || rest.name;

    const FormGroup = styled('div')`
      display: flex;
      flex-direction: column;
      min-width: 200px;
      width: ${fullWidth ? '100%' : '200px'};
      ${fullWidth ? 'flex: 1 0 0;' : ''}
    `;

    const Label = styled('label')`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.fontSize.medium};
      margin-bottom: 5px;
      font-weight: ${theme.typography.fontWeight.medium};
    `;

    const StyledTextarea = styled('textarea')`
      padding: 8px 12px;
      border: 2px ${theme.border.style} ${error ? theme.colors.danger.border : theme.colors.border.primary};
      border-radius: 6px;
      background-color: ${theme.colors.background.tertiary};
      color: ${theme.colors.text.primary};
      font-size: ${theme.typography.fontSize.medium};
      font-family: ${theme.typography.fontFamily};
      transition: border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast};
      resize: vertical;
      min-height: 80px;
      
      &::placeholder {
        color: ${theme.colors.text.placeholder};
      }
      
      &:focus {
        outline: none;
        border-color: ${error ? theme.colors.danger.border : theme.colors.border.focus};
        box-shadow: 0 0 0 2px ${error ? theme.colors.danger.focus : theme.colors.focus.shadowPrimary};
      }
      
      &:disabled {
        background-color: ${theme.colors.background.tertiary};
        border-color: ${theme.colors.border.secondary};
        color: ${theme.colors.text.muted};
        opacity: 0.6;
        cursor: default;
      }
    `;

    const ErrorMessage = styled('span')`
      color: ${theme.colors.danger.background};
      font-size: ${theme.typography.fontSize.small};
      margin-top: 4px;
    `;

    return html`
      <${FormGroup}>
        ${label ? html`<${Label} for=${inputId}>${label}</${Label}>` : ''}
        <${StyledTextarea} id=${inputId} disabled=${disabled} rows=${rows} ...${rest} />
        ${error ? html`<${ErrorMessage}>${error}</${ErrorMessage}>` : ''}
      </${FormGroup}>
    `;
  }
}
