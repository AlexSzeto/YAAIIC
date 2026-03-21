import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { getWidthScaleStyle } from '../util.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const LABEL_WIDTH = 50; // px — fixed width for endpoint labels
const SLIDER_RADIUS = 9; // px — half of thumb width/height

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  width: ${props => props.width};
  flex: ${props => props.flex};
  opacity: ${props => props.disabled ? 0.5 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
`;
FormGroup.className = 'range-slider-form-group';

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
`;
Label.className = 'range-slider-label';

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
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

const RangeInput = styled('input')`
  font-size: ${props => props.fontSize};
  color: ${props => props.color};
  width: ${LABEL_WIDTH}px;
  text-align: center;
  flex-shrink: 0;
  border: 2px ${props => props.borderStyle} ${props => props.borderColor};
  border-radius: 6px;
  background: transparent;
  padding: 2px 0;
  font-family: inherit;
  outline: none;
  transition: border-color ${props => props.transition}, box-shadow ${props => props.transition};
  -moz-appearance: textfield;
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  &:focus {
    box-shadow: 0 0 0 2px ${props => props.focusBorderColor};
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;
RangeInput.className = 'range-slider-range-input';

const TrackContainer = styled('div')`
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;
  margin: 0 ${(LABEL_WIDTH / 2) - SLIDER_RADIUS}px;

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
    width: ${SLIDER_RADIUS * 2}px;
    height: ${SLIDER_RADIUS * 2}px;
    border-radius: 50%;
    background-color: ${props => props.thumbFill};
    border: 2px solid ${props => props.thumbBorder};
    cursor: grab;
    transition: transform ${props => props.transition};
  }

  input[type="range"]::-moz-range-thumb {
    width: ${SLIDER_RADIUS * 2}px;
    height: ${SLIDER_RADIUS * 2}px;
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
 * @param {'normal'|'compact'|'full'} [props.widthScale='normal'] - Width category (200px | 50px | 100%+flex-grow)
 * @param {boolean} [props.disabled=false]    - When true, disables interaction and dims the slider
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
 * // Disabled state
 * <RangeSlider disabled={true} minAllowed={0} maxAllowed={10} />
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
      minRaw: null, // string while min input is focused, null otherwise
      maxRaw: null, // string while max input is focused, null otherwise
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

  componentDidUpdate(prevProps) {
    const { minAllowed = 0, maxAllowed = 100, onChange } = this.props;
    if (prevProps.minAllowed === minAllowed && prevProps.maxAllowed === maxAllowed) return;
    const { currentMin, currentMax } = this.state;
    const clampedMin = Math.max(minAllowed, Math.min(currentMin, maxAllowed));
    const clampedMax = Math.max(minAllowed, Math.min(currentMax, maxAllowed));
    if (clampedMin === currentMin && clampedMax === currentMax) return;
    this.setState({ currentMin: clampedMin, currentMax: clampedMax });
    if (onChange) onChange({ min: clampedMin, max: clampedMax });
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

  handleTrackMouseDown(e) {
    // Only primary button; if user clicked the thumb itself let the browser handle it natively
    if (e.button !== 0 || e.target.tagName === 'INPUT') return;
    const { minAllowed = 0, maxAllowed = 100, snap = 1, onChange } = this.props;

    const trackEl = e.currentTarget;
    const inputs = trackEl.querySelectorAll('input[type="range"]');
    const minInput = inputs[0];
    const maxInput = inputs[1];

    // Capture current min/max at the start of the drag
    let { currentMin, currentMax } = this.state;

    const getClickValue = (clientX) => {
      const rect = trackEl.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return minAllowed + fraction * (maxAllowed - minAllowed);
    };

    const snapClamp = (v, lo, hi) =>
      Math.max(lo, Math.min(Math.round(v / snap) * snap, hi));

    // Determine which knob to pick based on the initial click
    const clickValue = getClickValue(e.clientX);
    const distToMin = Math.abs(clickValue - currentMin);
    const distToMax = Math.abs(clickValue - currentMax);
    let pickMin;
    if (distToMin === distToMax) {
      pickMin = clickValue <= currentMin; // left → min, right → max
    } else {
      pickMin = distToMin < distToMax;
    }

    // Apply initial position — set DOM value directly for instant visual
    if (pickMin) {
      const v = snapClamp(clickValue, minAllowed, currentMax);
      if (minInput) minInput.value = v;
      currentMin = v;
      this.setState({ currentMin: v });
      if (onChange) onChange({ min: v, max: currentMax });
    } else {
      const v = snapClamp(clickValue, currentMin, maxAllowed);
      if (maxInput) maxInput.value = v;
      currentMax = v;
      this.setState({ currentMax: v });
      if (onChange) onChange({ min: currentMin, max: v });
    }

    // Continue dragging via document-level listeners
    const onMouseMove = (moveEvent) => {
      const cv = getClickValue(moveEvent.clientX);
      if (pickMin) {
        const v = snapClamp(cv, minAllowed, this.state.currentMax);
        // Update DOM directly for smooth 60fps visual, setState for state sync
        if (minInput) minInput.value = v;
        this.setState({ currentMin: v });
        if (onChange) onChange({ min: v, max: this.state.currentMax });
      } else {
        const v = snapClamp(cv, this.state.currentMin, maxAllowed);
        if (maxInput) maxInput.value = v;
        this.setState({ currentMax: v });
        if (onChange) onChange({ min: this.state.currentMin, max: v });
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /** Apply a typed min-label value, clamped to [minAllowed, currentMax]. */
  applyMinLabel(rawValue) {
    const { minAllowed = 0, snap = 1, onChange } = this.props;
    let v = parseFloat(rawValue);
    if (isNaN(v)) return;
    // Snap to step
    v = Math.round(v / snap) * snap;
    v = Math.max(minAllowed, Math.min(v, this.state.currentMax));
    this.setState({ currentMin: v });
    if (onChange) onChange({ min: v, max: this.state.currentMax });
  }

  /** Apply a typed max-label value, clamped to [currentMin, maxAllowed]. */
  applyMaxLabel(rawValue) {
    const { maxAllowed = 100, snap = 1, onChange } = this.props;
    let v = parseFloat(rawValue);
    if (isNaN(v)) return;
    v = Math.round(v / snap) * snap;
    v = Math.max(this.state.currentMin, Math.min(v, maxAllowed));
    this.setState({ currentMax: v });
    if (onChange) onChange({ min: this.state.currentMin, max: v });
  }

  handleMinLabelChange(e) {
    this.setState({ minRaw: e.target.value });
  }

  handleMaxLabelChange(e) {
    this.setState({ maxRaw: e.target.value });
  }

  handleMinLabelBlur(e) {
    this.applyMinLabel(this.state.minRaw ?? e.target.value);
    this.setState({ minRaw: null });
  }

  handleMaxLabelBlur(e) {
    this.applyMaxLabel(this.state.maxRaw ?? e.target.value);
    this.setState({ maxRaw: null });
  }

  handleMinLabelKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.applyMinLabel(e.target.value);
      this.setState({ minRaw: null });
      e.target.blur();
    }
  }

  handleMaxLabelKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.applyMaxLabel(e.target.value);
      this.setState({ maxRaw: null });
      e.target.blur();
    }
  }

  render() {
    const {
      minAllowed = 0,
      maxAllowed = 100,
      snap = 1,
      label,
      widthScale = 'normal',
      disabled = false,
      // consumed props — not forwarded
      min: _min,
      max: _max,
      onChange: _onChange,
      ...rest
    } = this.props;
    const { currentMin, currentMax, theme, minRaw, maxRaw } = this.state;
    const { width, flex } = getWidthScaleStyle(widthScale);

    const range = maxAllowed - minAllowed;
    const minPct = ((currentMin - minAllowed) / range) * 100;
    const maxPct = ((currentMax - minAllowed) / range) * 100;

    // Use muted colours when disabled
    const thumbFill = disabled ? theme.colors.text.disabled : theme.colors.primary.background;
    const thumbBorder = thumbFill;
    const activeBg = disabled ? theme.colors.text.disabled : theme.colors.primary.background;
    const trackBg = disabled ? theme.colors.background.disabled : theme.colors.border.primary;

    return html`
      <${FormGroup} width=${width} flex=${flex} disabled=${disabled}>
        ${label ? html`
          <${Label}
            color=${disabled ? theme.colors.text.disabled : theme.colors.text.secondary}
            fontSize=${theme.typography.fontSize.medium}
            fontWeight=${theme.typography.fontWeight.medium}
          >${label}</${Label}>
        ` : ''}
        <${Wrapper}
          fontFamily=${theme.typography.fontFamily}
          ...${rest}
        >

        <!-- Slider track + dual thumbs -->
        <${TrackContainer}
          thumbFill=${thumbFill}
          thumbBorder=${thumbBorder}
          transition=${theme.transitions.fast}
          onMouseDown=${(e) => this.handleTrackMouseDown(e)}
        >
          <${TrackFill}
            trackBg=${trackBg}
            activeBg=${activeBg}
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
            disabled=${disabled}
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
            disabled=${disabled}
            onChange=${(e) => this.handleMaxChange(e)}
            style="z-index: ${currentMin === currentMax ? 2 : 1}"
          />
        </${TrackContainer}>

        <!-- Min / Max bounds inputs -->
        <${BoundsRow}>
          <${RangeInput}
            type="number"
            fontSize=${theme.typography.fontSize.medium}
            color=${disabled ? theme.colors.text.disabled : theme.colors.text.primary}
            borderColor=${disabled ? theme.colors.border.secondary : theme.colors.border.primary}
            borderStyle=${theme.border.style}
            focusBorderColor=${theme.colors.primary.border}
            transition=${theme.transitions.fast}
            value=${minRaw !== null ? minRaw : this.formatValue(currentMin)}
            disabled=${disabled}
            step=${snap}
            min=${minAllowed}
            max=${currentMax}
            onChange=${(e) => this.handleMinLabelChange(e)}
            onBlur=${(e) => this.handleMinLabelBlur(e)}
            onKeyDown=${(e) => this.handleMinLabelKeyDown(e)}
          />
          <${RangeInput}
            type="number"
            fontSize=${theme.typography.fontSize.medium}
            color=${disabled ? theme.colors.text.disabled : theme.colors.text.primary}
            borderColor=${disabled ? theme.colors.border.secondary : theme.colors.border.primary}
            borderStyle=${theme.border.style}
            focusBorderColor=${theme.colors.primary.border}
            transition=${theme.transitions.fast}
            value=${maxRaw !== null ? maxRaw : this.formatValue(currentMax)}
            disabled=${disabled}
            step=${snap}
            min=${currentMin}
            max=${maxAllowed}
            onChange=${(e) => this.handleMaxLabelChange(e)}
            onBlur=${(e) => this.handleMaxLabelBlur(e)}
            onKeyDown=${(e) => this.handleMaxLabelKeyDown(e)}
          />
        </${BoundsRow}>
      </${Wrapper}>
      </${FormGroup}>
    `;
  }
}
