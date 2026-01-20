import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 200px;
`;

const Label = styled('label')`
  margin-bottom: 5px;
`;

const StyledTextarea = styled('textarea')`
  padding: 8px 12px;
  border-radius: 6px;
  resize: vertical;
  min-height: 80px;
  
  &:focus {
    outline: none;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const ErrorMessage = styled('span')`
  margin-top: 4px;
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

    const formGroupStyle = {
      width: fullWidth ? '100%' : '200px',
      flex: fullWidth ? '1 0 0' : undefined,
    };

    const labelStyle = {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.fontSize.medium,
      fontWeight: theme.typography.fontWeight.medium,
    };

    const textareaStyle = {
      border: `2px ${theme.border.style} ${error ? theme.colors.danger.border : theme.colors.border.primary}`,
      backgroundColor: theme.colors.background.tertiary,
      color: theme.colors.text.primary,
      fontSize: theme.typography.fontSize.medium,
      fontFamily: theme.typography.fontFamily,
      transition: `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
    };

    const errorStyle = {
      color: theme.colors.danger.background,
      fontSize: theme.typography.fontSize.small,
    };

    return html`
      <${FormGroup} style=${formGroupStyle}>
        ${label ? html`<${Label} style=${labelStyle} for=${inputId}>${label}</${Label}>` : ''}
        <${StyledTextarea} id=${inputId} disabled=${disabled} rows=${rows} style=${textareaStyle} ...${rest} />
        ${error ? html`<${ErrorMessage} style=${errorStyle}>${error}</${ErrorMessage}>` : ''}
      </${FormGroup}>
    `;
  }
}
