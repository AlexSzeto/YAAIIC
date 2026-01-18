import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';

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
    const { variant = 'default', children, ...rest } = this.props;
    const { theme } = this.state;

    const StyledPanel = styled('div')`
      padding: ${theme.spacing.medium.padding};
      border-radius: ${theme.spacing.medium.borderRadius};
      transition: background-color ${theme.transitions.normal}, 
                  border-color ${theme.transitions.normal},
                  box-shadow ${theme.transitions.normal};
      
      ${variant === 'default' ? `
        background-color: ${theme.colors.background.card};
        border: ${theme.border.width} ${theme.border.style} ${theme.colors.border.primary};
      ` : ''}
      
      ${variant === 'elevated' ? `
        background-color: ${theme.colors.background.card};
        border: none;
        box-shadow: 0 4px 12px ${theme.colors.shadow.color}, 
                    0 2px 4px ${theme.colors.shadow.color};
      ` : ''}
      
      ${variant === 'outlined' ? `
        background-color: transparent;
        border: 2px ${theme.border.style} ${theme.colors.border.secondary};
      ` : ''}
      
      ${variant === 'glass' ? `
        background-color: ${theme.colors.overlay.glass};
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        border: none;
      ` : ''}
    `;

    return html`<${StyledPanel} ...${rest}>${children}</${StyledPanel}>`;
  }
}
