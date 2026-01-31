import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 200px;
  width: ${props => props.width};
  flex: ${props => props.flex};
`;
FormGroup.className = 'form-group';

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
`;
Label.className = 'label';

const StyledInput = styled('input')`
  padding: 8px 12px;
  border-radius: 6px;
  border: ${props => props.border};
  background-color: ${props => props.backgroundColor};
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-family: ${props => props.fontFamily};
  transition: ${props => props.transition};
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.focusColor};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;
StyledInput.className = 'styled-input';

const ErrorMessage = styled('span')`
  margin-top: 4px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
`;
ErrorMessage.className = 'error-message';

/**
 * Input - Themed text input with label and error state support
 * 
 * A styled text input component with optional label, error message display,
 * and full theme integration for all states.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the input
 * @param {string} [props.error] - Error message displayed below the input
 * @param {string} [props.id] - ID for the input element (also sets name attribute)
 * @param {boolean} [props.fullWidth=false] - Whether to span full container width
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.type='text'] - Input type (text, password, email, number, etc.)
 * @param {*} [props.value] - Input value
 * @param {Function} [props.onChange] - Change handler
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic input with label
 * <Input label="Username" id="username" />
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

    return html`
      <${FormGroup} 
        width=${fullWidth ? '100%' : '200px'}
        flex=${fullWidth ? '1 0 0' : undefined}
      >
        ${label ? html`
          <${Label} 
            for=${id}
            color=${theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
          >${label}</${Label}>
        ` : ''}
        <${StyledInput} 
          id=${id} 
          name=${id}
          disabled=${disabled}
          border=${`2px ${theme.border.style} ${error ? theme.colors.danger.border : theme.colors.border.primary}`}
          backgroundColor=${theme.colors.background.tertiary}
          color=${theme.colors.text.primary}
          fontSize=${theme.typography.fontSize.medium}
          fontFamily=${theme.typography.fontFamily}
          transition=${`border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`}
          focusColor=${error ? theme.colors.danger.border : theme.colors.primary.border}
          ...${rest} 
        />
        ${error ? html`
          <${ErrorMessage} 
            color=${theme.colors.danger.background}
            fontSize=${theme.typography.fontSize.small}
          >${error}</${ErrorMessage}>
        ` : ''}
      </${FormGroup}>
    `;
  }
}
