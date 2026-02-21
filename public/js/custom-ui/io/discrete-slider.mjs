import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: ${props => props.width};
  font-family: ${props => props.fontFamily};
`;
Wrapper.className = 'discrete-slider-wrapper';

const RangeWrapper = styled('div')`
  height: 28px;
  display: flex;
  align-items: center;
`;
RangeWrapper.className = 'discrete-slider-range-wrapper';

const StyledRange = styled('input')`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: ${props => props.trackBg};
  outline: none;
  cursor: pointer;
  transition: background ${props => props.transition};

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    transform: translateY(-8px);
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: ${props => props.thumbFill};
    border: 2px solid ${props => props.thumbBorder};
    cursor: grab;
    transition: transform ${props => props.transition};
  }

  &::-moz-range-thumb {
    transform: translateY(-8px);
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: ${props => props.thumbFill};
    border: 2px solid ${props => props.thumbBorder};
    cursor: grab;
    transition: transform ${props => props.transition};
    border: 2px solid ${props => props.thumbBorder};
  }

  &:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: translateY(-8px) scale(1.15);
  }

  &:active::-moz-range-thumb {
    cursor: grabbing;
    transform: translateY(-8px) scale(1.15);
  }

  &::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      ${props => props.activeBg} ${props => props.fillPct}%,
      ${props => props.trackBg} ${props => props.fillPct}%
    );
  }

  &::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background-color: ${props => props.activeBg};
  }

  &::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background-color: ${props => props.trackBg};
  }
`;
StyledRange.className = 'discrete-slider-range';

const LabelsRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;
LabelsRow.className = 'discrete-slider-labels-row';

const OptionLabel = styled('span')`
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
  color: ${props => props.color};
  cursor: pointer;
  user-select: none;
  transition: color ${props => props.transition};
  text-align: center;
  flex: 1;

  &:first-child { text-align: left; }
  &:last-child  { text-align: right; }
`;
OptionLabel.className = 'discrete-slider-option-label';

// =========================================================================
// Component
// =========================================================================

/**
 * DiscreteSlider — Themed slider for selecting from a fixed list of options.
 *
 * Uses a single native input[type="range"] with min=0, max=options.length-1
 * and step=1. The integer index is mapped to the corresponding option value.
 * Clickable option labels below the slider let the user jump directly to any
 * value. Keyboard arrow keys and smooth dragging both work natively.
 *
 * @param {Object}   props
 * @param {Array}    props.options          - Array of option values to choose from
 * @param {*}        [props.value]          - Currently selected value (must be in options)
 * @param {Function} [props.onChange]       - Called with the selected value on change
 * @param {string}   [props.width='100%']   - CSS width of the component
 * @returns {preact.VNode}
 *
 * @example
 * // Basic usage
 * <DiscreteSlider
 *   options={['low', 'medium', 'high']}
 *   value="medium"
 *   onChange={(val) => console.log(val)}
 * />
 *
 * @example
 * // Numeric options
 * <DiscreteSlider options={[0.25, 0.5, 1, 2, 4]} value={1} />
 */
export class DiscreteSlider extends Component {
  constructor(props) {
    super(props);
    const { options = [], value } = props;
    const idx = value !== undefined ? options.indexOf(value) : 0;
    this.state = {
      index: idx >= 0 ? idx : 0,
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

  handleRangeChange(e) {
    const { options = [], onChange } = this.props;
    const idx = parseInt(e.target.value, 10);
    this.setState({ index: idx });
    if (onChange) onChange(options[idx]);
  }

  handleLabelClick(idx) {
    const { options = [], onChange } = this.props;
    this.setState({ index: idx });
    if (onChange) onChange(options[idx]);
  }

  render() {
    const {
      options = [],
      width = '100%',
      // consumed — not forwarded
      value: _value,
      onChange: _onChange,
      ...rest
    } = this.props;
    const { index, theme } = this.state;

    const maxIdx = options.length - 1;
    // Fill percentage for the webkit runnable track gradient
    const fillPct = maxIdx > 0 ? (index / maxIdx) * 100 : 0;

    return html`
      <${Wrapper}
        width=${width}
        fontFamily=${theme.typography.fontFamily}
        ...${rest}
      >
        <${RangeWrapper}>
          <${StyledRange}
            type="range"
            min="0"
            max=${maxIdx}
            step="1"
            value=${index}
            onChange=${(e) => this.handleRangeChange(e)}
            trackBg=${theme.colors.border.primary}
            activeBg=${theme.colors.primary.background}
            thumbFill=${theme.colors.primary.background}
            thumbBorder=${theme.colors.primary.background}
            thumbShadow=${theme.shadow.elevated}
            transition=${theme.transitions.fast}
            fillPct=${fillPct}
          />
        </${RangeWrapper}>
        <${LabelsRow}>
          ${options.map((opt, i) => html`
            <${OptionLabel}
              key=${i}
              fontSize=${theme.typography.fontSize.medium}
              fontWeight=${i === index ? theme.typography.fontWeight.bold : theme.typography.fontWeight.normal}
              color=${i === index ? theme.colors.primary.background : theme.colors.text.muted}
              transition=${theme.transitions.fast}
              onClick=${() => this.handleLabelClick(i)}
            >${opt}</${OptionLabel}>
          `)}
        </${LabelsRow}>
      </${Wrapper}>
    `;
  }
}
