import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

/**
 * Input - Themed text input with label and error state support
 * 
 * A styled text input component with optional label, error message display,
 * and full theme integration for all states.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the input
 * @param {string} [props.error] - Error message displayed below the input
 * @param {string} [props.id] - ID for label association (falls back to name prop)
 * @param {boolean} [props.fullWidth=false] - Whether to span full container width
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.type='text'] - Input type (text, password, email, number, etc.)
 * @param {string} [props.name] - Input name attribute
 * @param {*} [props.value] - Input value
 * @param {Function} [props.onChange] - Change handler
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic input with label
 * <Input label="Username" name="username" />
 * 
 * @example
 * // Input with error state
 * <Input label="Email" error="Invalid email format" />
 * 
 * @example
 * // Full width input
 * <Input label="Description" fullWidth={true} />
 */
export class Input extends Component {
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
      fullWidth = false, 
      disabled = false,
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

    const StyledInput = styled('input')`
      padding: 8px 12px;
      border: 2px ${theme.border.style} ${error ? theme.colors.danger.border : theme.colors.border.primary};
      border-radius: 6px;
      background-color: ${theme.colors.background.tertiary};
      color: ${theme.colors.text.primary};
      font-size: ${theme.typography.fontSize.medium};
      font-family: ${theme.typography.fontFamily};
      transition: border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast};
      
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
        <${StyledInput} id=${inputId} disabled=${disabled} ...${rest} />
        ${error ? html`<${ErrorMessage}>${error}</${ErrorMessage}>` : ''}
      </${FormGroup}>
    `;
  }
}
