import { Component } from 'preact'
import { html } from 'htm/preact'

/**
 * ToggleButton - A Preact component for boolean value selection
 *
 * Props:
 * - checked: Boolean value indicating if the toggle is on/off
 * - onChange: Callback function called with the new boolean value when it changes
 * - label: Optional label text to display next to the toggle
 * - disabled: Boolean indicating if the toggle is disabled (default: false)
 */
export class ToggleButton extends Component {
  constructor(props) {
    super(props)

    const { checked = false, label = '', disabled = false } = props

    this.state = {
      isChecked: checked,
    }

    // Store props for easy access
    this.label = label
    this.disabled = disabled

    // Slider dimensions - consistent with other components
    this.width = 24 // Short slider width
    this.dotSize = 16 // Same as other components
  }

  handleToggle() {
    if (this.disabled) return

    const newValue = !this.state.isChecked
    this.setState({ isChecked: newValue })
    this.props.onChange && this.props.onChange(newValue)
  }

  render() {
    const { isChecked } = this.state
    const { dotSize } = this

    // Calculate knob position - left for false, right for true
    const knobPosition = isChecked ? this.width : 0

    // Determine colors based on state
    const trackColor = this.disabled
      ? 'bg-gray-300'
      : isChecked
      ? 'bg-blue-500'
      : 'bg-gray-300'
    const knobBorderColor = this.disabled
      ? 'border-gray-400'
      : 'border-blue-500'

    return html`
      <div class="toggle-button inline-flex items-center">
        ${this.label
          ? html`
              <span
                class="mr-4 text-xs cursor-pointer transition-colors duration-200 ${this
                  .disabled
                  ? 'text-gray-400'
                  : isChecked
                  ? 'text-gray-600'
                  : 'text-gray-600'}"
                onClick=${() => this.handleToggle()}
              >
                ${this.label}
              </span>
            `
          : null}

        <!-- Toggle slider container -->
        <div
          class="relative cursor-pointer ${this.disabled
            ? 'cursor-not-allowed'
            : 'cursor-pointer'}"
          style="width: ${this.width}px; height: ${dotSize}px;"
          onClick=${() => this.handleToggle()}
        >
          <!-- Slider track -->
          <div
            class="absolute top-1/2 transform -translate-y-1/2 rounded-full transition-colors duration-200 ${trackColor}"
            style="width: ${this.width}px; height: 4px;"
          ></div>

          <!-- Slider knob -->
          <div
            class="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 bg-white border-2 rounded-full shadow-md transition-all duration-200 ease-out ${knobBorderColor} ${this
              .disabled
              ? ''
              : 'hover:scale-110'}"
            style="left: ${knobPosition}px; width: ${dotSize}px; height: ${dotSize}px; z-index: 10;"
          ></div>
        </div>
      </div>
    `
  }
}
