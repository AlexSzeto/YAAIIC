import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const StyledPanel = styled('div')`
  transition: background-color 0.2s ease, 
              border-color 0.2s ease,
              box-shadow 0.2s ease;
`;

/**
 * Panel - Container component with rounded corners and themed background
 * 
 * A versatile container for grouping related content with consistent styling.
 * Supports four visual variants for different use cases.
 * 
 * @param {Object} props
 * @param {'default'|'elevated'|'outlined'|'glass'} [props.variant='default'] - Panel style variant
 *   - 'default': Solid background with subtle border
 *   - 'elevated': Raised appearance with shadow, no border
 *   - 'outlined': Transparent background with prominent border
 *   - 'glass': Semi-transparent background with blur effect (for overlays/labels)
 * @param {preact.ComponentChildren} [props.children] - Panel content
 * @returns {preact.VNode}
 * 
 * @example
 * // Default panel
 * <Panel>Content here</Panel>
 * 
 * @example
 * // Elevated panel with shadow
 * <Panel variant="elevated">Elevated content</Panel>
 * 
 * @example
 * // Outlined panel
 * <Panel variant="outlined">Outlined content</Panel>
 */
export class Panel extends Component {
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
    const { variant = 'default', children, style: propStyle, ...rest } = this.props;
    const { theme } = this.state;

    // Build dynamic styles based on variant and theme
    const baseStyle = {
      padding: theme.spacing.medium.padding,
      borderRadius: theme.spacing.medium.borderRadius,
    };

    let variantStyle = {};
    switch (variant) {
      case 'default':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: `${theme.border.width} ${theme.border.style} ${theme.colors.border.primary}`,
        };
        break;
      case 'elevated':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: 'none',
          boxShadow: `0 4px 12px ${theme.colors.shadow.color}, 0 2px 4px ${theme.colors.shadow.color}`,
        };
        break;
      case 'outlined':
        variantStyle = {
          backgroundColor: 'transparent',
          border: `2px ${theme.border.style} ${theme.colors.border.secondary}`,
        };
        break;
      case 'glass':
        variantStyle = {
          backgroundColor: theme.colors.overlay.glass,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: 'none',
        };
        break;
    }

    const combinedStyle = { ...baseStyle, ...variantStyle, ...propStyle };

    return html`<${StyledPanel} style=${combinedStyle} ...${rest}>${children}</${StyledPanel}>`;
  }
}
