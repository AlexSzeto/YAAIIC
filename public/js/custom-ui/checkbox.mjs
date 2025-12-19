import { html } from 'htm/preact';

/**
 * Checkbox Component
 * Custom Dark Theme Implementation using box-icons
 */
export function Checkbox({ label, checked = false, onChange, disabled = false, id, className = '', ...props }) {
  // Styles for the custom visual checkbox
  const checkboxStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    backgroundColor: 'var(--dark-background-tertiary)',
    border: '2px solid var(--dark-border-primary)',
    borderRadius: '4px',
    color: 'var(--primary-background)', // Icon color
    marginRight: '10px',
    flexShrink: 0,
    transition: 'border-color 0.2s, box-shadow 0.2s'
  };

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    userSelect: 'none'
  };

  // Handle click on the container to toggle the hidden input
  const handleClick = (e) => {
    if (disabled) return;
    // If the click hit the input directly, let it propagate. 
    // If it hit the label/div, we need to manually trigger change or rely on label[for] behavior.
    // If we wrap in <label>, text selection defaults are handled nicely.
  };

  return html`
    <label class="form-group ${className}" style=${containerStyle}>
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
      
      <div class="custom-checkbox-visual" style=${checkboxStyle}>
        ${checked && html`<box-icon name='check' size='20px' color='#ffffff'></box-icon>`}
      </div>

      <span class="checkbox-label" style="font-size: 14px; font-weight: 500; color: var(--dark-text-secondary);">
        ${label}
      </span>
    </label>
  `;
}
