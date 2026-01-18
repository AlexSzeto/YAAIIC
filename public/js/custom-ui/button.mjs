import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled, css, keyframes } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

/**
 * Button - Themed button with multiple variants and states
 * 
 * A versatile button component with support for different sizes, color themes,
 * icons, and loading states. All styling is handled via Goober.
 * 
 * @param {Object} props
 * @param {'medium-text'|'medium-icon'|'medium-icon-text'|'small-text'|'small-icon'} [props.variant='medium-text'] - Size/content variant
 *   - 'medium-text': Standard button with text only
 *   - 'medium-icon': Square button with icon only (44x44)
 *   - 'medium-icon-text': Button with icon and text
 *   - 'small-text': Compact tag-style button with text
 *   - 'small-icon': Small square button with icon only (28x28)
 * @param {'primary'|'secondary'|'success'|'danger'} [props.color='secondary'] - Color theme
 * @param {boolean} [props.loading=false] - Shows spinner, disables button
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.icon] - Box-icon name (e.g. 'play', 'trash')
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.title] - Tooltip text
 * @param {string} [props.type='button'] - Button type attribute
 * @param {preact.ComponentChildren} [props.children] - Button text (for text variants)
 * @returns {preact.VNode}
 * 
 * @example
 * // Primary button with text
 * <Button color="primary">Submit</Button>
 * 
 * @example
 * // Button with icon and text
 * <Button variant="medium-icon-text" icon="play" color="success">Play</Button>
 * 
 * @example
 * // Small icon-only button
 * <Button variant="small-icon" icon="trash" color="danger" />
 * 
 * @example
 * // Loading state
 * <Button loading={true}>Processing...</Button>
 */
export class Button extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value
    };
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const { 
      variant = 'medium-text', 
      color = 'secondary',
      loading = false, 
      disabled = false, 
      icon = null, 
      children, 
      ...rest 
    } = this.props;
    const { theme } = this.state;

    // Determine sizing based on variant
    const isSmall = variant.startsWith('small');
    const isIconOnly = variant === 'medium-icon' || variant === 'small-icon';
    const hasIcon = icon || loading;
    const hasText = children && !isIconOnly;

    // Size configurations
    const sizes = {
      small: {
        height: '28px',
        minWidth: isIconOnly ? '28px' : 'auto',
        padding: isIconOnly ? '0' : '0 12px',
        fontSize: theme.typography.fontSize.small,
        iconSize: '16px',
        borderRadius: theme.spacing.small.borderRadius,
        gap: '4px'
      },
      medium: {
        height: '44px',
        minWidth: isIconOnly ? '44px' : '120px',
        padding: isIconOnly ? '0' : theme.spacing.medium.padding,
        fontSize: theme.typography.fontSize.medium,
        iconSize: isIconOnly ? '24px' : '18px',
        borderRadius: theme.spacing.medium.borderRadius,
        gap: '8px'
      }
    };

    const size = isSmall ? sizes.small : sizes.medium;

    // Color configurations
    const getColorStyles = (colorName) => {
      const colorTheme = theme.colors[colorName] || theme.colors.secondary;
      return {
        bg: colorTheme.background,
        hover: colorTheme.hover,
        focus: colorTheme.focus,
        text: colorTheme.text || '#ffffff'
      };
    };

    const colorStyles = getColorStyles(color);

    // Spin animation for loading
    const spin = keyframes`
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    `;

    const StyledButton = styled('button')`
      /* Base styles */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: ${size.gap};
      height: ${size.height};
      min-width: ${size.minWidth};
      padding: ${size.padding};
      font-size: ${size.fontSize};
      font-weight: ${theme.typography.fontWeight.medium};
      font-family: ${theme.typography.fontFamily};
      border: ${theme.border.width} ${theme.border.style} transparent;
      border-radius: ${size.borderRadius};
      cursor: pointer;
      transition: background-color ${theme.transitions.fast}, 
                  border-color ${theme.transitions.fast},
                  box-shadow ${theme.transitions.fast};
      flex-shrink: 0;
      
      /* Color styles */
      background-color: ${colorStyles.bg};
      color: ${colorStyles.text};
      border-color: ${colorStyles.bg};
      
      &:hover:not(:disabled) {
        background-color: ${colorStyles.hover};
        border-color: ${colorStyles.hover};
      }
      
      &:focus {
        outline: none;
        box-shadow: 0 0 0 2px ${colorStyles.focus};
      }
      
      &:disabled {
        background-color: ${theme.colors.background.disabled};
        border-color: ${theme.colors.border.secondary};
        color: ${theme.colors.text.disabled};
        opacity: 0.6;
        cursor: default;
      }
      
      /* Icon-only adjustments */
      ${isIconOnly ? `
        width: ${size.height};
        min-width: ${size.height};
        padding: 0;
      ` : ''}
    `;

    const iconColor = disabled ? theme.colors.text.disabled : colorStyles.text;
    const iconElement = loading 
      ? html`<box-icon name='loader-alt' animation='spin' size=${size.iconSize} color=${iconColor}></box-icon>`
      : (hasIcon && icon) 
        ? html`<box-icon name=${icon} size=${size.iconSize} color=${iconColor}></box-icon>`
        : null;

    // Text container for proper ellipsis handling
    const TextSpan = styled('span')`
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    `;

    return html`
      <${StyledButton} 
        disabled=${disabled || loading} 
        ...${rest}
      >
        ${iconElement}
        ${hasText && html`<${TextSpan}>${children}</${TextSpan}>`}
      </${StyledButton}>
    `;
  }
}
