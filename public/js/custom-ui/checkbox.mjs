import { html } from 'htm/preact';

/**
 * Checkbox Component
 * Custom Dark Theme Implementation using box-icons
 * 
 * @param {Object} props
 * @param {string} props.label - Label text
 * @param {boolean} [props.checked=false] - Checked state
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.labelPosition='right'] - Position of label: 'left' or 'right'
 * @param {string} [props.id] - ID for the input
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function Checkbox({ 
  label, 
  checked = false, 
  onChange, 
  disabled = false, 
  labelPosition = 'right',
  id, 
  className = '', 
  ...props 
}) {
  const hasLabel = label != null && String(label).trim() !== '';

  const containerStyle = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    userSelect: 'none',
    gap: hasLabel ? '8px' : '0', // Add spacing only if label exists
    minWidth: hasLabel ? undefined : 'auto', // Override .form-group min-width when no label
    justifyContent: hasLabel ? 'flex-start' : 'center', // Center content if no label
    width: hasLabel ? undefined : 'min-content', // Shrink to fit content if no label
    flex: hasLabel ? undefined : '0 0 auto' // Prevent stretching if no label
  };

  const checkboxVisual = html`
    <div class="custom-checkbox-visual">
      ${checked && html`<box-icon name='check' size='20px' color='#ffffff'></box-icon>`}
    </div>
  `;

  const labelElement = hasLabel ? html`
    <span class="checkbox-label" style="font-size: 14px; font-weight: 500; color: var(--dark-text-secondary);">
      ${label}
    </span>
  ` : null;

  return html`
    <label class="form-group ${className} ${disabled ? 'disabled' : ''}" style=${containerStyle}>
      <input 
        type="checkbox" 
        class="visually-hidden" 
        checked=${checked} 
        disabled=${disabled} 
        onChange=${onChange}
        id=${id}
        ...${props}
        style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;"
      />
      
      ${labelPosition === 'left' ? html`${labelElement}${checkboxVisual}` : html`${checkboxVisual}${labelElement}`}
    </label>
  `;
}
