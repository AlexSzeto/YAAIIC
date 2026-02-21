# Rewrite Importing Custom UI Components

## Goal

Rewrite the three UI components from `public/js/importing-custom-ui/` (`number-range-picker.js`, `discrete-value-slider.js`, `toggle-button.js`) as compliant custom-ui components in `public/js/custom-ui/io/`. The new implementations avoid DOM refs entirely by leveraging native HTML form elements, eliminating the `getBoundingClientRect` / ref issues that arise with goober's `styled()` wrappers.

## Tasks

- [ ] **Create `range-slider.mjs`** — Rewrite `NumberRangePicker` using dual native `<input type="range">` elements in `public/js/custom-ui/io/range-slider.mjs`.
  - [ ] Use `.mjs` extension and follow the file naming convention.
  - [ ] Import `styled` from `../goober-setup.mjs` and `currentTheme` from `../theme.mjs` (class component pattern).
  - [ ] Use two overlapping native `<input type="range">` elements: one for min, one for max. Constrain via `onChange` so min never exceeds max.
  - [ ] Style the native range thumbs and track using goober CSS pseudo-element selectors (`::-webkit-slider-thumb`, `::-moz-range-thumb`, etc.) with theme tokens.
  - [ ] Display the current min/max values as styled labels or number inputs alongside the slider.
  - [ ] Assign readable `.className` to every styled component.
  - [ ] Destructure props with defaults in `render()`. Forward DOM-compatible props via `...rest`.
  - [ ] Document public props with JSDoc, including usage examples.
  - [ ] Preserve equivalent interaction behavior: both handles independently draggable, snap-to-increment via `step` attribute, keyboard support (native).
  - [ ] **Add to `test.html`:** Add a *RangeSlider* section with demos: default (0–100), custom snap increment (snap=0.5, 0–10), and narrow allowed range (20–60). Log `onChange` to the console.
  - [ ] **Manual Test:** Open `test.html`, verify themed colors, drag both handles, confirm value labels update, toggle light/dark theme.

- [ ] **Create `discrete-slider.mjs`** — Rewrite `DiscreteValueSlider` using a native `<input type="range">` with calculated `step` in `public/js/custom-ui/io/discrete-slider.mjs`.
  - [ ] Use `.mjs` extension and follow the file naming convention.
  - [ ] Import `styled` from `../goober-setup.mjs` and `currentTheme` from `../theme.mjs` (class component pattern).
  - [ ] Use a single native `<input type="range">` with `min=0`, `max=options.length-1`, `step=1`. Map the integer index to the option value.
  - [ ] Style the native range thumb and track using goober CSS pseudo-element selectors with theme tokens.
  - [ ] Render clickable option labels in a flex row beneath the slider. Clicking a label updates the slider value.
  - [ ] Assign readable `.className` to every styled component.
  - [ ] Destructure props with defaults in `render()`. Forward DOM-compatible props via `...rest`.
  - [ ] Document public props with JSDoc, including usage examples.
  - [ ] Preserve drag behavior: the native range input provides smooth dragging with snap-to-nearest on release (via `step`). Option label clicks and keyboard arrows also work natively.
  - [ ] **Add to `test.html`:** Add a *DiscreteSlider* section showing a set of labeled options with a pre-selected value. Log `onChange` to the console.
  - [ ] **Manual Test:** Open `test.html`, verify themed colors, drag the knob, click an option label, toggle light/dark theme.

- [ ] **Create `toggle-switch.mjs`** — Rewrite `ToggleButton` using a hidden `<input type="checkbox">` with CSS in `public/js/custom-ui/io/toggle-switch.mjs`.
  - [ ] Use `.mjs` extension and follow the file naming convention.
  - [ ] Import `styled` from `../goober-setup.mjs` and `currentTheme` from `../theme.mjs` (class component pattern).
  - [ ] Use a hidden native `<input type="checkbox">` inside a styled `<label>`. The track and knob are styled elements whose appearance changes based on the `checked` prop.
  - [ ] Style track (background color transition) and knob (position transition) using goober with theme tokens. No JS toggle logic — use the checkbox `onChange` event.
  - [ ] Support `disabled` state natively via the checkbox `disabled` attribute, with reduced opacity and `cursor: not-allowed`.
  - [ ] Assign readable `.className` to every styled component.
  - [ ] Destructure props with defaults in `render()`. Forward DOM-compatible props via `...rest`.
  - [ ] Document public props with JSDoc, including usage examples.
  - [ ] **Add to `test.html`:** Add a *ToggleSwitch* section showing: default toggle, toggle with label, and disabled toggle. Log `onChange` to the console.
  - [ ] **Manual Test:** Open `test.html`, verify themed colors, click to toggle on/off, verify disabled state, toggle light/dark theme.

- [ ] **Final verification in `test.html`**
  - [ ] Verify all three sections (RangeSlider, DiscreteSlider, ToggleSwitch) appear in `test.html`.
  - [ ] Ensure all examples log `onChange` output to the console.
  - [ ] **Manual Test:** Open `test.html`, scroll to each section, interact with every demo, open console and confirm callbacks fire.

## Implementation Details

### Source → Target File Mapping

| Original File | New File | Export Name |
|---|---|---|
| `importing-custom-ui/number-range-picker.js` | `custom-ui/io/range-slider.mjs` | `RangeSlider` |
| `importing-custom-ui/discrete-value-slider.js` | `custom-ui/io/discrete-slider.mjs` | `DiscreteSlider` |
| `importing-custom-ui/toggle-button.js` | `custom-ui/io/toggle-switch.mjs` | `ToggleSwitch` |

### Design Approach: No DOM Refs

All three components avoid `createRef` and `getBoundingClientRect` by delegating interaction to native HTML form elements. Goober `styled()` components are used only for visual presentation, never as ref targets.

| Component | Native Element | Why It Works |
|---|---|---|
| RangeSlider | `<input type="range">` ×2 | Browser handles drag, keyboard, click natively. No manual position math. |
| DiscreteSlider | `<input type="range">` with `step=1` | Native drag with snap. Index mapped to option values. |
| ToggleSwitch | `<input type="checkbox">` hidden | `onChange` fires on click. CSS drives visual transition. |

### Theme Token Mapping

| Visual Role | Theme Token |
|---|---|
| Track background | `theme.colors.border.primary` |
| Track hover | `theme.colors.secondary.hover` |
| Active / selected fill | `theme.colors.primary.background` |
| Thumb fill | `theme.colors.background.primary` |
| Thumb border | `theme.colors.primary.background` |
| Labels (muted) | `theme.colors.text.muted` |
| Selected label | `theme.colors.primary.background` |
| Value text | `theme.colors.text.secondary` |
| Disabled border | `theme.colors.border.secondary` |
| Disabled text | `theme.colors.text.disabled` |
| Shadows | `theme.shadow.elevated` |
| Transitions | `theme.transitions.fast` / `theme.transitions.normal` |

### Pattern Reference

All new components follow the same structure as `input.mjs` and `checkbox.mjs`:

```javascript
import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

const StyledWrapper = styled('div')`...`;
StyledWrapper.className = 'styled-wrapper';

export class ComponentName extends Component {
  constructor(props) {
    super(props);
    this.state = { theme: currentTheme.value };
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
    const { propA, propB = defaultValue, ...rest } = this.props;
    const { theme } = this.state;
    return html`...`;
  }
}
```