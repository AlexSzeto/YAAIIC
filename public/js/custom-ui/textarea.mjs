import { html } from 'htm/preact';

/**
 * Textarea Component
 * @param {Object} props
 * @param {string} props.label - Label text
 * @param {string} [props.error] - Error message
 * @param {boolean} [props.fullWidth=true] - Default true for textareas
 */
export function Textarea({ label, error, id, fullWidth = true, className = '', ...props }) {
  const inputId = id || props.name;

  return html`
    <div class="form-group ${fullWidth ? 'full-width' : ''} ${className}">
      ${label && html`<label for=${inputId}>${label}</label>`}
      <textarea id=${inputId} ...${props}></textarea>
      ${error && html`<span class="error-message" style="color: var(--danger-text); font-size: 0.85em;">${error}</span>`}
    </div>
  `;
}
