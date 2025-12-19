import { html } from 'htm/preact';
import { Input } from '../custom-ui/input.mjs';
import { Checkbox } from '../custom-ui/checkbox.mjs';

/**
 * Seed Control Component
 * Manages seed value and lock state
 * 
 * @param {Object} props
 * @param {number} props.seed - Current seed value
 * @param {Function} props.setSeed - Callback to update seed: (newSeed) => void
 * @param {boolean} props.locked - Whether seed is locked
 * @param {Function} props.setLocked - Callback to update lock state: (isLocked) => void
 */
export function SeedControl({ seed, setSeed, locked, setLocked }) {
  
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
    />
    
    <div style="margin-bottom: 6px;">
      <${Checkbox}
        label="Lock seed"
        checked=${locked}
        onChange=${handleLockChange}
      />
    </div>
  `;
}
