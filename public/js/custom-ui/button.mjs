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
  children, 
  ...props 
}) {
  const getVariantClasses = (v) => {
    switch (v) {
      case 'primary': return 'btn-with-icon generate-button';
      case 'secondary': return 'btn-with-icon'; // Default gray style
      case 'success': return 'btn-with-icon btn-success';
      case 'danger': return 'btn-with-icon image-delete-btn';
      case 'icon': return 'info-btn'; // Small square
      case 'icon-danger': return 'info-btn image-select-clear-btn'; // Small square, red hover
      case 'icon-nav': return 'carousel-btn'; // Medium square
      default: return 'btn-with-icon';
    }
  };

  const baseClass = getVariantClasses(variant);
  const classes = baseClass.trim();

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
