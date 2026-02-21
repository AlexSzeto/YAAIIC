import { Component, createRef } from 'preact'
import { html } from 'htm/preact'
/**
 * NumberRangePicker - A Preact component for selecting min/max values
 *
 * Props:
 * - width: Width of the component in pixels (default: 300)
 * - snap: Snap increment for values (default: 1)
 * - minAllowed: Minimum allowed value (default: 0)
 * - maxAllowed: Maximum allowed value (default: 100)
 * - min: Initial minimum value
 * - max: Initial maximum value
 * - onChange: Callback function called with { min, max } when values change
 */
export class NumberRangePicker extends Component {
  constructor(props) {
    super(props)

    // Set default props
    const {
      width = 300,
      snap = 1,
      minAllowed = 0,
      maxAllowed = 100,
      min = minAllowed,
      max = maxAllowed,
    } = props

    this.state = {
      currentMin: min,
      currentMax: max,
      editingMin: false,
      editingMax: false,
      isDragging: null,
    }

    // Store props for easy access
    this.width = width
    this.snap = snap
    this.minAllowed = minAllowed
    this.maxAllowed = maxAllowed

    this.minInputRef = createRef()
    this.maxInputRef = createRef()
    this.sliderRef = createRef()

    this.boundMouseMove = this.handleMouseMove.bind(this)
    this.boundMouseUp = this.handleMouseUp.bind(this)
  }

  componentDidUpdate(prevProps, prevState) {
    // Focus input when editing starts
    if (this.state.editingMin && !prevState.editingMin && this.minInputRef) {
      this.minInputRef.current.focus()
      this.minInputRef.current.select()
    }
    if (this.state.editingMax && !prevState.editingMax && this.maxInputRef) {
      this.maxInputRef.current.focus()
      this.maxInputRef.current.select()
    }
  }

  // Clamp values to allowed range and snap to increment
  clampValue(value) {
    const clamped = Math.max(this.minAllowed, Math.min(this.maxAllowed, value))
    return this.snapToIncrement(clamped)
  }

  // Snap value to the nearest increment
  snapToIncrement(value) {
    return Math.round(value / this.snap) * this.snap
  }

  // Helper method to format values for display
  formatValue(value) {
    if (Number.isInteger(this.snap)) {
      return Math.round(value).toString()
    } else {
      // Count decimal places in snap value to determine precision
      const decimalPlaces = (this.snap.toString().split('.')[1] || '').length
      return value.toFixed(decimalPlaces)
    }
  }

  // Convert value to pixel position
  valueToPosition(value) {
    return (
      ((value - this.minAllowed) / (this.maxAllowed - this.minAllowed)) *
      this.width
    )
  }

  // Convert pixel position to value
  positionToValue(position) {
    const ratio = position / this.width
    const value = this.minAllowed + ratio * (this.maxAllowed - this.minAllowed)
    return this.snapToIncrement(value)
  }

  // Handle mouse events for dragging
  handleMouseDown(type, e) {
    e.preventDefault()
    this.setState({ isDragging: type })
    document.addEventListener('mousemove', this.boundMouseMove)
    document.addEventListener('mouseup', this.boundMouseUp)
  }

  handleMouseMove(e) {
    if (!this.state.isDragging || !this.sliderRef.current) return

    const rect = this.sliderRef.current.getBoundingClientRect()
    const position = Math.max(0, Math.min(this.width, e.clientX - rect.left))
    const value = this.clampValue(this.positionToValue(position))

    if (this.state.isDragging === 'min') {
      const newMin = Math.min(value, this.state.currentMax)
      this.setState({ currentMin: newMin })
      this.props.onChange &&
        this.props.onChange({ min: newMin, max: this.state.currentMax })
    } else if (this.state.isDragging === 'max') {
      const newMax = Math.max(value, this.state.currentMin)
      this.setState({ currentMax: newMax })
      this.props.onChange &&
        this.props.onChange({ min: this.state.currentMin, max: newMax })
    }
  }

  handleMouseUp() {
    this.setState({ isDragging: null })
    document.removeEventListener('mousemove', this.boundMouseMove)
    document.removeEventListener('mouseup', this.boundMouseUp)
  }

  handleTrackClick(e) {
    // Prevent track clicks while dragging
    if (this.state.isDragging) return

    const rect = this.sliderRef.current.getBoundingClientRect()
    const position = Math.max(0, Math.min(this.width, e.clientX - rect.left))
    const clickedValue = this.clampValue(this.positionToValue(position))

    const minPosition = this.valueToPosition(this.state.currentMin)
    const maxPosition = this.valueToPosition(this.state.currentMax)

    // Check if click is in the gray areas (outside the blue range)
    if (position < minPosition) {
      // Click to the left of min value - move min to clicked position
      const newMin = clickedValue
      this.setState({ currentMin: newMin })
      this.props.onChange &&
        this.props.onChange({ min: newMin, max: this.state.currentMax })
    } else if (position > maxPosition) {
      // Click to the right of max value - move max to clicked position
      const newMax = clickedValue
      this.setState({ currentMax: newMax })
      this.props.onChange &&
        this.props.onChange({ min: this.state.currentMin, max: newMax })
    }
    // Clicks between min and max (in the blue area) are ignored
  }

  // Handle direct value input
  handleMinInputChange(e) {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      const newMin = this.clampValue(Math.min(value, this.state.currentMax))
      this.setState({ currentMin: newMin })
      this.props.onChange &&
        this.props.onChange({ min: newMin, max: this.state.currentMax })
    }
  }

  handleMaxInputChange(e) {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      const newMax = this.clampValue(Math.max(value, this.state.currentMin))
      this.setState({ currentMax: newMax })
      this.props.onChange &&
        this.props.onChange({ min: this.state.currentMin, max: newMax })
    }
  }

  handleMinInputBlur() {
    this.setState({ editingMin: false })
  }

  handleMaxInputBlur() {
    this.setState({ editingMax: false })
  }

  handleMinInputKeyDown(e) {
    if (e.key === 'Enter') {
      this.setState({ editingMin: false })
    }
  }

  handleMaxInputKeyDown(e) {
    if (e.key === 'Enter') {
      this.setState({ editingMax: false })
    }
  }

  render() {
    const { currentMin, currentMax, editingMin, editingMax } = this.state
    const minPosition = this.valueToPosition(currentMin)
    const maxPosition = this.valueToPosition(currentMax)
    const dotSize = 16

    return html`
      <div class="number-range-picker p-4 pt-12">
        <!-- Value displays -->
        <div class="relative" style="width: ${this.width}px;">
          <!-- Min value -->
          <div
            class="absolute flex items-center justify-center cursor-pointer"
            style="left: ${minPosition - 25}px; top: -30px; width: 50px;"
            onClick=${() => this.setState({ editingMin: true })}
          >
            ${editingMin
              ? html`
                  <input
                    ref=${this.minInputRef}
                    type="number"
                    value=${this.formatValue(currentMin)}
                    onChange=${(e) => this.handleMinInputChange(e)}
                    onBlur=${() => this.handleMinInputBlur()}
                    onKeyDown=${(e) => this.handleMinInputKeyDown(e)}
                    class="w-full text-center text-xs border rounded px-1 py-0.5"
                    step=${this.snap}
                    min=${this.minAllowed}
                    max=${this.maxAllowed}
                  />
                `
              : html`
                  <span
                    class="text-xs font-medium text-gray-700 bg-white px-1 py-0.5 rounded shadow-sm border"
                  >
                    ${this.formatValue(currentMin)}
                  </span>
                `}
          </div>

          <!-- Max value -->
          <div
            class="absolute flex items-center justify-center cursor-pointer"
            style="left: ${maxPosition -
            25}px; top: -30px; width: 50px; z-index: ${currentMin === currentMax
              ? 20
              : 10};"
            onClick=${() => this.setState({ editingMax: true })}
          >
            ${editingMax
              ? html`
                  <input
                    ref=${this.maxInputRef}
                    type="number"
                    value=${this.formatValue(currentMax)}
                    onChange=${(e) => this.handleMaxInputChange(e)}
                    onBlur=${() => this.handleMaxInputBlur()}
                    onKeyDown=${(e) => this.handleMaxInputKeyDown(e)}
                    class="w-full text-center text-xs border rounded px-1 py-0.5"
                    step=${this.snap}
                    min=${this.minAllowed}
                    max=${this.maxAllowed}
                  />
                `
              : html`
                  <span
                    class="text-xs font-medium text-gray-700 bg-white px-1 py-0.5 rounded shadow-sm border"
                  >
                    ${this.formatValue(currentMax)}
                  </span>
                `}
          </div>
        </div>

        <!-- Slider track -->
        <div
          class="relative"
          style="width: ${this.width}px; height: ${dotSize}px;"
        >
          <!-- Clickable track with hover effects on gray areas -->
          <div
            ref=${this.sliderRef}
            class="absolute top-1/2 transform -translate-y-1/2 bg-gray-300 rounded-full cursor-pointer hover:bg-gray-400 transition-colors duration-150"
            style="width: ${this.width}px; height: 4px;"
            onClick=${(e) => this.handleTrackClick(e)}
          >
            <!-- Selected range (blue area) -->
            <div
              class="absolute top-0 bg-blue-500 rounded-full h-full pointer-events-none"
              style="left: ${minPosition}px; width: ${maxPosition -
              minPosition}px;"
            ></div>
          </div>

          <!-- Min dot -->
          <div
            class="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 bg-white border-2 border-blue-500 rounded-full cursor-grab active:cursor-grabbing shadow-md hover:scale-110 transition-transform"
            style="left: ${minPosition}px; width: ${dotSize}px; height: ${dotSize}px; z-index: 10;"
            onMouseDown=${(e) => this.handleMouseDown('min', e)}
          ></div>

          <!-- Max dot (rendered on top when overlapping) -->
          <div
            class="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 bg-white border-2 border-blue-500 rounded-full cursor-grab active:cursor-grabbing shadow-md hover:scale-110 transition-transform"
            style="left: ${maxPosition}px; width: ${dotSize}px; height: ${dotSize}px; z-index: ${currentMin ===
            currentMax
              ? 20
              : 10};"
            onMouseDown=${(e) => this.handleMouseDown('max', e)}
          ></div>
        </div>

        <!-- Range labels -->
        <div
          class="flex justify-between mt-2 text-xs text-gray-500"
          style="width: ${this.width}px;"
        >
          <span>${this.minAllowed}</span>
          <span>${this.maxAllowed}</span>
        </div>
      </div>
    `
  }
}
