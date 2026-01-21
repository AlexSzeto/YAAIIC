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

const StyledSelect = styled('select')`
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
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
 * Select - Themed dropdown select with label and error state support
 * 
 * A styled select dropdown component with optional label, error message display,
 * and full theme integration. Matches Input component styling for consistency.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed above the select
 * @param {Array<{label: string, value: any}>} [props.options=[]] - Array of option objects
 * @param {string} [props.error] - Error message displayed below the select
 * @param {string} [props.id] - ID for label association (falls back to name prop)
 * @param {boolean} [props.fullWidth=false] - Whether to span full container width
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {*} [props.value] - Currently selected value
 * @param {Function} [props.onChange] - Change handler
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic select with options
 * <Select 
 *   label="Country" 
 *   options={[
 *     { label: 'USA', value: 'us' },
 *     { label: 'Canada', value: 'ca' }
 *   ]} 
 * />
 * 
 * @example
 * // Select with error state
 * <Select label="Category" options={[...]} error="Please select a category" />
 * 
 * @example
 * // Full width select
 * <Select label="Type" options={[...]} fullWidth={true} />
 */
export class Select extends Component {
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
      options = [],
      error, 
      id, 
      fullWidth = false, 
      disabled = false,
      value,
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
        <${StyledSelect} 
          id=${inputId} 
          disabled=${disabled}
          border=${`2px ${theme.border.style} ${error ? theme.colors.danger.border : theme.colors.border.primary}`}
          backgroundColor=${theme.colors.background.tertiary}
          color=${theme.colors.text.primary}
          fontSize=${theme.typography.fontSize.medium}
          fontFamily=${theme.typography.fontFamily}
          transition=${`border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`}
          focusColor=${error ? theme.colors.danger.border : theme.colors.primary.border}
          ...${rest}
        >
          ${options.map(opt => html`
            <option value=${opt.value} selected=${opt.value === value}>
              ${opt.label}
            </option>
          `)}
        </${StyledSelect}>
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
