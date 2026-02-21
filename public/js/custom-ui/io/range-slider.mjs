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
  gap: 0;
  width: ${props => props.width};
  font-family: ${props => props.fontFamily};
`;
Wrapper.className = 'range-slider-wrapper';

const ValueRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
ValueRow.className = 'range-slider-value-row';

const ValueLabel = styled('span')`
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
  color: ${props => props.color};
  min-width: 36px;
  text-align: center;
`;
ValueLabel.className = 'range-slider-value-label';

const RangeLabel = styled('span')`
  font-size: ${props => props.fontSize};
  color: ${props => props.color};
`;
RangeLabel.className = 'range-slider-range-label';

const TrackContainer = styled('div')`
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;

  /* Hide default track — we render our own filled track line via a pseudo-element */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    position: absolute;
    left: 0;
    width: 100%;
    height: 4px;
    background: transparent;
    pointer-events: none;
    margin: 0;
    padding: 0;
  }

  /* Re-enable pointer events only on the thumb */
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: all;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: ${props => props.thumbFill};
    border: 2px solid ${props => props.thumbBorder};
    cursor: grab;
    transition: transform ${props => props.transition};
  }

  input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: ${props => props.thumbFill};
    border: 2px solid ${props => props.thumbBorder};
    cursor: grab;
    transition: transform ${props => props.transition};
    pointer-events: all;
  }

  input[type="range"]:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.15);
  }

  input[type="range"]:active::-moz-range-thumb {
    cursor: grabbing;
    transform: scale(1.15);
  }
`;
TrackContainer.className = 'range-slider-track-container';

// Filled track bar — rendered behind the native inputs
const TrackFill = styled('div')`
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    ${props => props.trackBg} ${props => props.minPct}%,
    ${props => props.activeBg} ${props => props.minPct}%,
    ${props => props.activeBg} ${props => props.maxPct}%,
    ${props => props.trackBg} ${props => props.maxPct}%
  );
  pointer-events: none;
`;
TrackFill.className = 'range-slider-track-fill';

const BoundsRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;
BoundsRow.className = 'range-slider-bounds-row';

// =========================================================================
// Component
// =========================================================================

/**
 * RangeSlider — Themed dual-handle range slider using two native input[type="range"] elements.
 *
 * Both handles are independently draggable. The min handle is constrained so it
 * never exceeds max, and vice versa. Snap-to-increment is handled natively via
 * the `step` attribute. Keyboard navigation (arrow keys) also works natively.
 *
 * @param {Object} props
 * @param {number} [props.minAllowed=0]       - Minimum allowed value
 * @param {number} [props.maxAllowed=100]     - Maximum allowed value
 * @param {number} [props.min]                - Initial min handle value (defaults to minAllowed)
 * @param {number} [props.max]                - Initial max handle value (defaults to maxAllowed)
 * @param {number} [props.snap=1]             - Step/snap increment
 * @param {string} [props.width='100%']       - CSS width of the component
 * @param {Function} [props.onChange]         - Called with { min, max } on every value change
 * @returns {preact.VNode}
 *
 * @example
 * // Default 0–100
 * <RangeSlider onChange={({ min, max }) => console.log(min, max)} />
 *
 * @example
 * // Custom range and snap
 * <RangeSlider minAllowed={0} maxAllowed={10} snap={0.5} min={2} max={7} />
 *
 * @example
 * // Narrow allowed range
 * <RangeSlider minAllowed={20} maxAllowed={60} />
 */
export class RangeSlider extends Component {
  constructor(props) {
    super(props);
    const {
      minAllowed = 0,
      maxAllowed = 100,
      min,
      max,
    } = props;
    this.state = {
      currentMin: min !== undefined ? min : minAllowed,
      currentMax: max !== undefined ? max : maxAllowed,
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

  /** Format a number for display, respecting the snap decimal precision. */
  formatValue(value) {
    const snap = this.props.snap ?? 1;
    if (Number.isInteger(snap)) {
      return Math.round(value).toString();
    }
    const decimals = (snap.toString().split('.')[1] || '').length;
    return value.toFixed(decimals);
  }

  handleMinChange(e) {
    const {
      maxAllowed = 100,
      onChange,
    } = this.props;
    const raw = parseFloat(e.target.value);
    const newMin = Math.min(raw, this.state.currentMax);
    this.setState({ currentMin: newMin });
    if (onChange) onChange({ min: newMin, max: this.state.currentMax });
  }

  handleMaxChange(e) {
    const {
      minAllowed = 0,
      onChange,
    } = this.props;
    const raw = parseFloat(e.target.value);
    const newMax = Math.max(raw, this.state.currentMin);
    this.setState({ currentMax: newMax });
    if (onChange) onChange({ min: this.state.currentMin, max: newMax });
  }

  render() {
    const {
      minAllowed = 0,
      maxAllowed = 100,
      snap = 1,
      width = '100%',
      // consumed props — not forwarded
      min: _min,
      max: _max,
      onChange: _onChange,
      ...rest
    } = this.props;
    const { currentMin, currentMax, theme } = this.state;

    const range = maxAllowed - minAllowed;
    const minPct = ((currentMin - minAllowed) / range) * 100;
    const maxPct = ((currentMax - minAllowed) / range) * 100;

    return html`
      <${Wrapper}
        width=${width}
        fontFamily=${theme.typography.fontFamily}
        ...${rest}
      >

        <!-- Slider track + dual thumbs -->
        <${TrackContainer}
          thumbFill=${theme.colors.primary.background}
          thumbBorder=${theme.colors.primary.background}
          transition=${theme.transitions.fast}
        >
          <${TrackFill}
            trackBg=${theme.colors.border.primary}
            activeBg=${theme.colors.primary.background}
            minPct=${minPct}
            maxPct=${maxPct}
          />
          <!-- Min handle -->
          <input
            type="range"
            min=${minAllowed}
            max=${maxAllowed}
            step=${snap}
            value=${currentMin}
            onChange=${(e) => this.handleMinChange(e)}
            style="z-index: ${currentMin === currentMax ? 1 : 2}"
          />
          <!-- Max handle -->
          <input
            type="range"
            min=${minAllowed}
            max=${maxAllowed}
            step=${snap}
            value=${currentMax}
            onChange=${(e) => this.handleMaxChange(e)}
            style="z-index: ${currentMin === currentMax ? 2 : 1}"
          />
        </${TrackContainer}>

        <!-- Min / Max bounds labels -->
        <${BoundsRow}>
          <${RangeLabel}
            fontSize=${theme.typography.fontSize.medium}
            color=${theme.colors.text.muted}
          >${this.formatValue(currentMin)}</${RangeLabel}>
          <${RangeLabel}
            fontSize=${theme.typography.fontSize.medium}
            color=${theme.colors.text.muted}
          >${this.formatValue(currentMax)}</${RangeLabel}>
        </${BoundsRow}>
      </${Wrapper}>
    `;
  }
}
