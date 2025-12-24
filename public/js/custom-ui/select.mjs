import { html } from 'htm/preact';

/**
 * Select Component
 * @param {Object} props
 * @param {string} props.label
 * @param {Array<{label: string, value: any}>} props.options
 * @param {string} [props.error]
 */
export function Select({ label, options = [], error, id, fullWidth = false, className = '', ...props }) {
  const inputId = id || props.name;

  return html`
    <div class="form-group ${fullWidth ? 'full-width' : ''} ${className}">
      ${label && html`<label for=${inputId}>${label}</label>`}
      <select id=${inputId} ...${props}>
        ${options.map(opt => html`
          <option value=${opt.value} selected=${opt.value === props.value}>
            ${opt.label}
          </option>
        `)}
      </select>
      ${error && html`<span class="error-message" style="color: var(--danger-text); font-size: 0.85em;">${error}</span>`}
    </div>
  `;
}
