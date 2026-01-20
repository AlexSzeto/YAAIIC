import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled, keyframes } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const StyledButton = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  
  &:focus {
    outline: none;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const TextSpan = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`;

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
        padding: isIconOnly ? '0' : theme.spacing.small.buttonPadding,
        fontSize: theme.typography.fontSize.small,
        iconSize: '16px',
        borderRadius: theme.spacing.small.borderRadius,
        gap: '4px'
      },
      medium: {
        height: isIconOnly ? '32px' : '44px',
        minWidth: isIconOnly ? '32px' : '120px',
        padding: isIconOnly ? '0' : theme.spacing.medium.buttonPadding,
        fontSize: theme.typography.fontSize.medium,
        iconSize: isIconOnly ? '20px' : '18px',
        borderRadius: isIconOnly ? theme.spacing.small.borderRadius : theme.spacing.medium.borderRadius,
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

    // Build style object
    const buttonStyle = {
      gap: size.gap,
      height: size.height,
      minWidth: size.minWidth,
      padding: size.padding,
      fontSize: size.fontSize,
      fontWeight: theme.typography.fontWeight.medium,
      fontFamily: theme.typography.fontFamily,
      border: `${theme.border.width} ${theme.border.style} ${colorStyles.bg}`,
      borderRadius: size.borderRadius,
      transition: `background-color ${theme.transitions.fast}, border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
      backgroundColor: colorStyles.bg,
      color: colorStyles.text,
      width: isIconOnly ? size.height : undefined,
    };

    // Disabled styling override
    if (disabled || loading) {
      buttonStyle.backgroundColor = theme.colors.background.disabled;
      buttonStyle.borderColor = theme.colors.border.secondary;
      buttonStyle.color = theme.colors.text.disabled;
    }

    const iconColor = disabled ? theme.colors.text.disabled : colorStyles.text;
    // Use theme spinner color for loading state for better visibility across themes
    const spinnerColor = theme.colors.spinner.color;
    const iconElement = loading 
      ? html`<box-icon name='loader-alt' animation='spin' size=${size.iconSize} color=${spinnerColor}></box-icon>`
      : (hasIcon && icon) 
        ? html`<box-icon name=${icon} size=${size.iconSize} color=${iconColor}></box-icon>`
        : null;

    return html`
      <${StyledButton} 
        disabled=${disabled || loading} 
        style=${buttonStyle}
        ...${rest}
      >
        ${iconElement}
        ${hasText && html`<${TextSpan}>${children}</${TextSpan}>`}
      </${StyledButton}>
    `;
  }
}
