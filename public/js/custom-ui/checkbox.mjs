import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

/**
 * Checkbox - Themed checkbox with label and custom visual styling
 * 
 * A styled checkbox component using box-icons for the check mark,
 * with full theme integration for all visual states.
 * 
 * @param {Object} props
 * @param {string} [props.label] - Label text displayed next to checkbox
 * @param {boolean} [props.checked=false] - Checked state
 * @param {Function} [props.onChange] - Change handler
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {'left'|'right'} [props.labelPosition='right'] - Position of label relative to checkbox
 * @param {string} [props.id] - ID for the input element
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic checkbox with label
 * <Checkbox label="Accept terms" checked={true} onChange={handleChange} />
 * 
 * @example
 * // Checkbox with label on left
 * <Checkbox label="Enable feature" labelPosition="left" />
 * 
 * @example
 * // Disabled checkbox
 * <Checkbox label="Unavailable" disabled={true} />
 * 
 * @example
 * // Checkbox without label
 * <Checkbox checked={true} onChange={handleChange} />
 */
export class Checkbox extends Component {
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
      checked = false, 
      onChange, 
      disabled = false, 
      labelPosition = 'right',
      id,
      ...rest 
    } = this.props;
    const { theme } = this.state;

    const hasLabel = label != null && String(label).trim() !== '';

    // Container - flex row with proper alignment
    const Container = styled('label')`
      display: flex;
      flex-direction: row;
      align-items: center;
      cursor: ${disabled ? 'default' : 'pointer'};
      opacity: ${disabled ? '0.6' : '1'};
      user-select: none;
      gap: ${hasLabel ? '8px' : '0'};
      min-width: ${hasLabel ? '0' : 'auto'};
      justify-content: ${hasLabel ? 'flex-start' : 'center'};
      width: ${hasLabel ? 'auto' : 'min-content'};
      flex: ${hasLabel ? '1' : '0 0 auto'};
    `;

    // Hidden input for accessibility
    const HiddenInput = styled('input')`
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;

    // Custom checkbox visual
    const CheckboxVisual = styled('div')`
      width: 22px;
      height: 22px;
      border: 2px ${theme.border.style} ${checked ? theme.colors.primary.background : theme.colors.border.secondary};
      border-radius: ${theme.spacing.small.borderRadius};
      background-color: ${checked ? theme.colors.primary.background : 'transparent'};
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color ${theme.transitions.fast}, 
                  border-color ${theme.transitions.fast},
                  box-shadow ${theme.transitions.fast};
      flex-shrink: 0;
      
      &:hover {
        border-color: ${disabled ? '' : theme.colors.primary.background};
      }
    `;

    // Label text
    const LabelText = styled('span')`
      font-size: ${theme.typography.fontSize.medium};
      font-weight: ${theme.typography.fontWeight.medium};
      color: ${theme.colors.text.secondary};
    `;

    const checkboxVisual = html`
      <${CheckboxVisual}>
        ${checked ? html`<box-icon name='check' size='16px' color='#ffffff'></box-icon>` : ''}
      </${CheckboxVisual}>
    `;

    const labelElement = hasLabel ? html`
      <${LabelText}>${label}</${LabelText}>
    ` : null;

    return html`
      <${Container}>
        <${HiddenInput} 
          type="checkbox" 
          checked=${checked} 
          disabled=${disabled} 
          onChange=${onChange}
          id=${id}
          ...${rest}
        />
        ${labelPosition === 'left' ? html`${labelElement}${checkboxVisual}` : html`${checkboxVisual}${labelElement}`}
      </${Container}>
    `;
  }
}
