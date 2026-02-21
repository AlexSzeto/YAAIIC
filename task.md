# Rewrite Importing Custom UI Components

## Goal

Rewrite the three UI components from `public/js/importing-custom-ui/` (`number-range-picker.js`, `discrete-value-slider.js`, `toggle-button.js`) as compliant custom-ui components in `public/js/custom-ui/io/`. These components were built in a similar Preact/HTM environment but use Tailwind CSS classes, `.js` file extensions, store props as instance variables, lack theme integration, and hardcode colors — all violations of the project's implementation rules.

## Tasks

- [ ] **Create `range-slider.mjs`** — Rewrite `NumberRangePicker` as a themed, goober-styled component in `public/js/custom-ui/io/range-slider.mjs`.
  - [ ] Use `.mjs` extension and follow the file naming convention (`range-slider.mjs`).
  - [ ] Import `styled` from `../goober-setup.mjs` (not directly from `goober`).
  - [ ] Import and subscribe to `currentTheme` from `../theme.mjs` using the class component pattern (subscribe in `componentDidMount`, unsubscribe in `componentWillUnmount`).
  - [ ] Replace all Tailwind CSS utility classes with goober `styled` components using theme tokens for colors, spacing, borders, typography, and transitions.
  - [ ] Assign readable `.className` to every styled component (e.g., `StyledTrack.className = 'styled-track';`).
  - [ ] Destructure props with defaults in `render()` instead of storing them as `this.*` instance variables in the constructor.
  - [ ] Forward DOM-compatible props via `...rest`.
  - [ ] Document public props with JSDoc, including usage examples.
  - [ ] Preserve all existing interaction behavior: min/max dot dragging, track click to move nearest handle, inline editing of values on click, snap-to-increment, and z-index priority when min equals max.
  - [ ] **Manual Test:** Open `public/js/custom-ui/test.html` in a browser. Verify the RangeSlider renders with themed colors, drag both handles, click the track, click a value label to edit inline, and toggle light/dark theme to confirm colors update.

- [ ] **Create `discrete-slider.mjs`** — Rewrite `DiscreteValueSlider` as a themed, goober-styled component in `public/js/custom-ui/io/discrete-slider.mjs`.
  - [ ] Use `.mjs` extension and follow the file naming convention (`discrete-slider.mjs`).
  - [ ] Import `styled` from `../goober-setup.mjs`.
  - [ ] Import and subscribe to `currentTheme` from `../theme.mjs` using the class component pattern.
  - [ ] Replace all Tailwind CSS utility classes with goober `styled` components using theme tokens.
  - [ ] Assign readable `.className` to every styled component.
  - [ ] Destructure props with defaults in `render()` instead of storing them as instance variables.
  - [ ] Forward DOM-compatible props via `...rest`.
  - [ ] Document public props with JSDoc, including usage examples.
  - [ ] Preserve all existing interaction behavior: knob dragging with smooth visual feedback, snap-to-nearest on release, track click to jump, option label click to select, and CSS animation toggle between snap and drag transitions.
  - [ ] **Manual Test:** Open `public/js/custom-ui/test.html` in a browser. Verify the DiscreteSlider renders with themed colors, drag the knob, click an option label, click the track, and toggle light/dark theme to confirm colors update.

- [ ] **Create `toggle-switch.mjs`** — Rewrite `ToggleButton` as a themed, goober-styled component in `public/js/custom-ui/io/toggle-switch.mjs`.
  - [ ] Use `.mjs` extension and follow the file naming convention (`toggle-switch.mjs`).
  - [ ] Import `styled` from `../goober-setup.mjs`.
  - [ ] Import and subscribe to `currentTheme` from `../theme.mjs` using the class component pattern.
  - [ ] Replace all Tailwind CSS utility classes with goober `styled` components using theme tokens.
  - [ ] Assign readable `.className` to every styled component.
  - [ ] Destructure props with defaults in `render()` instead of storing them as instance variables.
  - [ ] Forward DOM-compatible props via `...rest`.
  - [ ] Document public props with JSDoc, including usage examples.
  - [ ] Preserve all existing interaction behavior: click to toggle, optional label, disabled state rendering with reduced opacity and `cursor: not-allowed`.
  - [ ] **Manual Test:** Open `public/js/custom-ui/test.html` in a browser. Verify the ToggleSwitch renders with themed colors, click to toggle on/off, verify disabled state, and toggle light/dark theme to confirm colors update.

- [ ] **Add usage examples to `test.html`** — Add demo sections for all three new components to `public/js/custom-ui/test.html`.
  - [ ] Add a `RangeSlider` section showing: default range, custom snap increment (e.g., `snap={0.5}`), and narrow allowed range.
  - [ ] Add a `DiscreteSlider` section showing: a set of labeled options with a pre-selected value.
  - [ ] Add a `ToggleSwitch` section showing: default toggle, toggle with label, and disabled toggle.
  - [ ] Ensure all examples log `onChange` output to the console for interactive verification.
  - [ ] **Manual Test:** Open `public/js/custom-ui/test.html` in a browser. Scroll to each new section and interact with every demo instance. Open the browser console and confirm that `onChange` callbacks fire with correct values.

## Implementation Details

### Source → Target File Mapping

| Original File | New File | Export Name |
|---|---|---|
| `importing-custom-ui/number-range-picker.js` | `custom-ui/io/range-slider.mjs` | `RangeSlider` |
| `importing-custom-ui/discrete-value-slider.js` | `custom-ui/io/discrete-slider.mjs` | `DiscreteSlider` |
| `importing-custom-ui/toggle-button.js` | `custom-ui/io/toggle-switch.mjs` | `ToggleSwitch` |

### Pattern Reference: Existing `custom-ui/io` Components

All new components must follow the same structural pattern as `input.mjs` and `checkbox.mjs`:

```javascript
import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// Styled components at module scope using theme via props
const StyledTrack = styled('div')`
  background-color: ${props => props.backgroundColor};
  /* ... */
`;
StyledTrack.className = 'styled-track';

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
    // Use theme tokens: theme.colors.*, theme.spacing.*, theme.transitions.*, etc.
    return html`...`;
  }
}
```

### Theme Token Mapping for Hardcoded Values

The original components hardcode Tailwind colors. Map them to theme tokens as follows:

| Tailwind / Hardcoded Value | Theme Token |
|---|---|
| `bg-gray-300` (track background) | `theme.colors.border.primary` |
| `bg-gray-400` (track hover) | `theme.colors.secondary.hover` |
| `bg-blue-500` (active range / selected) | `theme.colors.primary.background` |
| `border-blue-500` (dot border) | `theme.colors.primary.background` |
| `bg-white` (dot fill) | `theme.colors.background.primary` |
| `text-gray-500` / `text-gray-600` (labels) | `theme.colors.text.muted` / `theme.colors.text.secondary` |
| `text-blue-600` (selected label) | `theme.colors.primary.background` |
| `text-gray-700` (value badge text) | `theme.colors.text.secondary` |
| `border-gray-400` (disabled border) | `theme.colors.border.secondary` |
| `text-gray-400` (disabled text) | `theme.colors.text.disabled` |
| `shadow-sm` / `shadow-md` | `theme.shadow.elevated` |
| transition durations (`duration-150`, `duration-200`, `duration-300`) | `theme.transitions.fast` / `theme.transitions.normal` |

### Behavioral Notes

- **RangeSlider**: The `mousemove` and `mouseup` listeners are attached to `document` during drag. These must be cleaned up in `componentWillUnmount` if a drag is in progress to prevent memory leaks.
- **DiscreteSlider**: Uses `forceUpdate()` during drag for smooth knob tracking. This is acceptable but should be documented with a comment explaining why.
- **ToggleSwitch**: The original stores `label` and `disabled` as instance variables in the constructor, meaning prop updates are ignored. The rewrite must read these from `this.props` in `render()` to support dynamic prop changes.