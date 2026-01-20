import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

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

    const StyledSelect = styled('select')`
      padding: 8px 12px;
      border: 2px ${theme.border.style} ${error ? theme.colors.danger.border : theme.colors.border.primary};
      border-radius: 6px;
      background-color: ${theme.colors.background.tertiary};
      color: ${theme.colors.text.primary};
      font-size: ${theme.typography.fontSize.medium};
      font-family: ${theme.typography.fontFamily};
      transition: border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast};
      cursor: pointer;
      
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
        cursor: not-allowed;
      }
      
      option {
        background-color: ${theme.colors.background.tertiary};
        color: ${theme.colors.text.primary};
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
        <${StyledSelect} id=${inputId} disabled=${disabled} ...${rest}>
          ${options.map(opt => html`
            <option value=${opt.value} selected=${opt.value === value}>
              ${opt.label}
            </option>
          `)}
        </${StyledSelect}>
        ${error ? html`<${ErrorMessage}>${error}</${ErrorMessage}>` : ''}
      </${FormGroup}>
    `;
  }
}
