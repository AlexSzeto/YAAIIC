import { html } from 'htm/preact';

/**
 * Button Component
 * 
 * @param {Object} props
 * @param {string} [props.variant='primary'] - 'primary', 'secondary', 'success', 'danger', 'icon', 'icon-nav'
 * @param {string} [props.size='medium'] - 'small', 'medium', 'large' (mostly handled by class variants)
 * @param {boolean} [props.loading=false] - If true, shows spinner and disables
 * @param {boolean} [props.disabled=false] - HTML disabled attribute
 * @param {string} [props.icon] - box-icon name (e.g. 'play', 'trash')
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.title] - Tooltip text
 * @param {string} [props.type='button'] - Button type
 * @param {string} [props.className] - Extra classes
 */
export function Button({ 
  variant = 'primary', 
  loading = false, 
  disabled = false, 
  icon = null, 
  className = '',
  children, 
  ...props 
}) {
  const getVariantClasses = (v) => {
    switch (v) {
      case 'primary': return 'btn-with-icon btn-primary';
      case 'secondary': return 'btn-with-icon'; // Default gray style
      case 'success': return 'btn-with-icon btn-success';
      case 'danger': return 'btn-with-icon btn-danger';
      case 'icon': return 'info-btn'; // Small square
      // TODO: remove this unnecessary variant
      case 'icon-danger': return 'info-btn'; // Small square, red hover
      case 'icon-nav': return 'btn-icon-nav'; // Medium square
      case 'primary-small-text': return 'btn-tag btn-tag-primary'; // Tag button - primary color
      case 'small-text': return 'btn-tag'; // Tag button - gray/default
      default: return 'btn-with-icon';
    }
  };

  const baseClass = getVariantClasses(variant);
  // Combine variant classes with any additional className prop
  const classes = className ? `${baseClass} ${className}`.trim() : baseClass;

  // Determine icon size based on variant
  const iconSize = variant === 'icon' ? '16px' : (variant === 'icon-nav' ? '24px' : undefined);
  // Default icon color is usually white for buttons, but 'icon' variant might adapt
  const iconColor = '#ffffff';

  return html`
    <button 
      class=${classes} 
      disabled=${disabled || loading} 
      ...${props}
    >
      ${loading 
        ? html`<box-icon name='loader-alt' animation='spin' size=${iconSize} color=${iconColor}></box-icon>`
        : html`
            ${icon && html`<box-icon name=${icon} size=${iconSize} color=${iconColor}></box-icon>`}
            ${children && variant !== 'icon' && variant !== 'icon-nav' ? html`<span class="btn-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">${children}</span>` : null}
            ${/* For icon-only buttons, children might be visually hidden or ignored, but let's render if passed just in case */ null}
            ${(variant === 'icon' || variant === 'icon-nav') && children ? children : null}
          `
      }
    </button>
  `;
}
