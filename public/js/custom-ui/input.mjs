import { html } from 'htm/preact';

/**
 * Input Component
 * @param {Object} props
 * @param {string} props.label - Label text
 * @param {string} [props.error] - Error message
 * @param {string} [props.id] - ID for label association (auto-generated if missing?)
 * @param {boolean} [props.fullWidth=false] - Whether to span full width
 */
export function Input({ label, error, id, fullWidth = false, className = '', ...props }) {
  // Use id if provided, or name if available
  const inputId = id || props.name;

  return html`
    <div class="form-group ${fullWidth ? 'full-width' : ''} ${className}">
      ${label && html`<label for=${inputId}>${label}</label>`}
      <input id=${inputId} ...${props} />
      ${error && html`<span class="error-message" style="color: var(--danger-text); font-size: 0.85em;">${error}</span>`}
    </div>
  `;
}
