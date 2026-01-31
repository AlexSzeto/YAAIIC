import { html } from 'htm/preact';
import { styled } from 'goober';
import { Input } from '../custom-ui/io/input.mjs';
import { Checkbox } from '../custom-ui/io/checkbox.mjs';
import { getThemeValue } from '../custom-ui/theme.mjs';

const CheckboxWrapper = styled('div')`
  margin-bottom: ${getThemeValue('spacing.small.margin')};
  width: 200px;
`;
CheckboxWrapper.className = 'checkbox-wrapper';

/**
 * Seed Control Component
 * Manages seed value and lock state
 * 
 * @param {Object} props
 * @param {number} props.seed - Current seed value
 * @param {Function} props.setSeed - Callback to update seed: (newSeed) => void
 * @param {boolean} props.locked - Whether seed is locked
 * @param {Function} props.setLocked - Callback to update lock state: (isLocked) => void
 * @param {boolean} [props.disabled=false] - Whether the control is disabled
 */
export function SeedControl({ seed, setSeed, locked, setLocked, disabled = false }) {
  
  const handleSeedChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setSeed(value);
    }
  };

  const handleLockChange = (e) => {
    setLocked(e.target.checked);
  };

  return html`
    <${Input}
      label="Seed"
      type="number"
      min="0"
      max="4294967295"
      value=${seed}
      onChange=${handleSeedChange}
      disabled=${disabled}
    />
    
    <${CheckboxWrapper}>
      <${Checkbox}
        label="Lock seed"
        checked=${locked}
        onChange=${handleLockChange}
        disabled=${disabled}
      />
    <//>
  `;
}

