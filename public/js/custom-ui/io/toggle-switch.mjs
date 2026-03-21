import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

// The outer <label> wraps the hidden checkbox, track, and knob together
// so clicking anywhere on the component toggles the checkbox.
const SwitchLabel = styled('label')`
  display: inline-flex;
  align-items: center;
  gap: ${props => props.gap};
  cursor: ${props => props.cursor};
  opacity: ${props => props.opacity};
  user-select: none;
  font-family: ${props => props.fontFamily};
`;
SwitchLabel.className = 'toggle-switch-label';

// Visually-hidden checkbox — browser handles toggle logic and focus.
const HiddenCheckbox = styled('input')`
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
HiddenCheckbox.className = 'toggle-switch-hidden-checkbox';

// The pill-shaped track
const Track = styled('div')`
  position: relative;
  width: 42px;
  height: 22px;
  border-radius: 12px;
  flex-shrink: 0;
  background-color: ${props => props.backgroundColor};
  border: 2px solid ${props => props.borderColor};
  transition: background-color ${props => props.transition}, border-color ${props => props.transition};
`;
Track.className = 'toggle-switch-track';

// The circular knob that slides left/right
const Knob = styled('div')`
  position: absolute;
  top: 2px;
  left: ${props => props.left};
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: ${props => props.backgroundColor};
  box-shadow: ${props => props.shadow};
  transition: left ${props => props.transition}, background-color ${props => props.transition};
`;
Knob.className = 'toggle-switch-knob';

const LabelText = styled('span')`
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
  color: ${props => props.color};
`;
LabelText.className = 'toggle-switch-label-text';

// =========================================================================
// Component
// =========================================================================

/**
 * ToggleSwitch — Themed on/off toggle using a hidden checkbox with CSS transitions.
 *
 * The `checked` state is managed entirely via the native checkbox `onChange`
 * event — no manual JS toggle logic. Visual transitions (track color, knob
 * position) are driven by CSS through goober props. The `disabled` attribute
 * is forwarded directly to the underlying checkbox for native browser behavior.
 *
 * @param {Object}   props
 * @param {boolean}  [props.checked=false]   - Checked (on) state
 * @param {Function} [props.onChange]        - Change handler, called with the native event
 * @param {boolean}  [props.disabled=false]  - Disabled state (native, reduces opacity)
 * @param {string}   [props.label]           - Optional label displayed beside the switch
 * @param {'left'|'right'} [props.labelPosition='right'] - Side of the label relative to switch
 * @param {string}   [props.id]              - ID forwarded to the hidden checkbox
 * @returns {preact.VNode}
 *
 * @example
 * // Minimal toggle
 * <ToggleSwitch checked={true} onChange={(e) => console.log(e.target.checked)} />
 *
 * @example
 * // With label
 * <ToggleSwitch label="Enable feature" checked={false} onChange={handleChange} />
 *
 * @example
 * // Disabled
 * <ToggleSwitch label="Unavailable" disabled={true} checked={false} />
 *
 * @example
 * // Label on left
 * <ToggleSwitch label="Dark mode" labelPosition="left" checked={isDark} onChange={toggle} />
 */
export class ToggleSwitch extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value,
    };
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const {
      checked = false,
      onChange,
      disabled = false,
      label,
      labelPosition = 'right',
      id,
      ...rest
    } = this.props;
    const { theme } = this.state;

    const hasLabel = label != null && String(label).trim() !== '';

    const trackEl = html`
      <${Track}
        backgroundColor=${checked ? theme.colors.primary.background : theme.colors.background.tertiary}
        borderColor=${checked ? theme.colors.primary.background : theme.colors.border.primary}
        transition=${theme.transitions.normal}
      >
        <${Knob}
          left=${checked ? '22px' : '2px'}
          backgroundColor=${checked ? theme.colors.primary.text : theme.colors.text.muted}
          shadow=${theme.shadow.elevated}
          transition=${theme.transitions.normal}
        />
      </${Track}>
    `;

    const labelEl = hasLabel ? html`
      <${LabelText}
        fontSize=${theme.typography.fontSize.medium}
        fontWeight=${theme.typography.fontWeight.medium}
        color=${disabled ? theme.colors.text.disabled : theme.colors.text.secondary}
      >${label}</${LabelText}>
    ` : null;

    return html`
      <${SwitchLabel}
        gap=${hasLabel ? '8px' : '0'}
        cursor=${disabled ? 'not-allowed' : 'pointer'}
        opacity=${disabled ? '0.5' : '1'}
        fontFamily=${theme.typography.fontFamily}
      >
        <${HiddenCheckbox}
          type="checkbox"
          id=${id}
          name=${id}
          checked=${checked}
          disabled=${disabled}
          onChange=${onChange}
          ...${rest}
        />
        ${labelPosition === 'left'
          ? html`${labelEl}${trackEl}`
          : html`${trackEl}${labelEl}`
        }
      </${SwitchLabel}>
    `;
  }
}
