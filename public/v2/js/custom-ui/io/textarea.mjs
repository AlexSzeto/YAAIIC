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

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
`;

const StyledTextarea = styled('textarea')`
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  resize: vertical;
  min-height: 80px;
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

const ErrorMessage = styled('span')`
  margin-top: 4px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
`;

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

    return html`
      <${FormGroup} 
        width=${fullWidth ? '100%' : '200px'}
        flex=${fullWidth ? '1 0 0' : undefined}
      >
        ${label ? html`
          <${Label} 
            for=${inputId}
            color=${theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
          >${label}</${Label}>
        ` : ''}
        <${StyledTextarea} 
          id=${inputId} 
          disabled=${disabled} 
          rows=${rows}
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
