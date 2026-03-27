import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const StyledTabPanelsRoot = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;
StyledTabPanelsRoot.className = 'styled-tab-panels-root';

const StyledTabBar = styled('div')`
  display: flex;
  gap: ${props => props.gap};
  align-items: flex-end;
  position: relative;
  z-index: ${props => props.zIndex};
`;
StyledTabBar.className = 'styled-tab-bar';

const StyledTab = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.tabPadding};
  transition: background-color 0.2s ease, 
              border-color 0.2s ease,
              box-shadow 0.2s ease;
  
  /* Apply variant-specific styles */
  background-color: ${props => props.bgColor};
  box-shadow: ${props => props.boxShadow};
  backdrop-filter: ${props => props.backdropFilter};
  -webkit-backdrop-filter: ${props => props.backdropFilter};
  
  /* Border control for each side */
  border-top: ${props => props.borderTop};
  border-left: ${props => props.borderLeft};
  border-right: ${props => props.borderRight};
  border-bottom: ${props => props.borderBottom};
  
  /* Tab shape: rounded top, flat bottom */
  border-top-left-radius: ${props => props.borderRadius};
  border-top-right-radius: ${props => props.borderRadius};
`;
StyledTab.className = 'styled-tab';

const StyledTabPanel = styled('div')`
  transition: background-color 0.2s ease, 
              border-color 0.2s ease,
              box-shadow 0.2s ease;
  position: relative;
  margin-top: ${props => props.marginTop};
  z-index: ${props => props.zIndex};
`;
StyledTabPanel.className = 'styled-tab-panel';

/**
 * TabPanels - Horizontal tab-based content switcher
 * 
 * A controlled tabbed interface for organizing content into switchable panels.
 * Tabs match the panel styling (background, borders, effects) based on variant.
 * The active tab button is highlighted (primary color), while inactive tab buttons
 * use a transparent style that blends with the tab background.
 * 
 * @param {Object} props
 * @param {Array<{id: string, label: string, content: preact.VNode}>} props.tabs - Tab definitions (required)
 *   - id: Unique identifier for the tab
 *   - label: Display text shown on the tab button
 *   - content: VNode to render when this tab is active
 * @param {string} props.activeTab - ID of the currently active tab (required, controlled)
 * @param {Function} props.onTabChange - Callback when tab is clicked: (id: string) => void (required)
 * @param {'small-text'|'medium-text'} [props.tabSize='medium-text'] - Size of tab buttons
 * @param {'default'|'elevated'|'outlined'|'glass'} [props.variant='default'] - Panel body style variant
 *   - 'default': Solid background with subtle border
 *   - 'elevated': Raised appearance with shadow, no border
 *   - 'outlined': Transparent background with prominent border
 *   - 'glass': Semi-transparent background with blur effect
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic tabs
 * <TabPanels
 *   tabs={[
 *     { id: 'tab1', label: 'First', content: html`<p>First content</p>` },
 *     { id: 'tab2', label: 'Second', content: html`<p>Second content</p>` }
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 * 
 * @example
 * // Small tabs with elevated panel
 * <TabPanels
 *   tabs={tabs}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   tabSize="small-text"
 *   variant="elevated"
 * />
 */
export class TabPanels extends Component {
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
      tabs = [], 
      activeTab, 
      onTabChange, 
      tabSize = 'medium-text',
      variant = 'default',
      style: propStyle,
      ...rest 
    } = this.props;
    const { theme } = this.state;

    // Find the active tab content
    const activeTabObj = tabs.find(tab => tab.id === activeTab);
    const activeTabContent = activeTabObj ? activeTabObj.content : null;

    // Build panel body styles based on variant
    const baseStyle = {
      padding: theme.spacing.medium.padding,
      borderRadius: theme.spacing.medium.borderRadius,
      borderTopLeftRadius: 0, // First tab will cover this corner
    };

    let variantStyle = {};
    const borderValue = `${theme.border.width} ${theme.border.style} ${theme.colors.border.secondary}`;
    
    switch (variant) {
      case 'default':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: 'none',
        };
        break;
      case 'elevated':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: 'none',
          boxShadow: theme.shadow.elevated,
        };
        break;
      case 'outlined':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: borderValue,
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

    // Calculate panel margin for outlined variant to overlap with active tab
    const panelMarginTop = variant === 'outlined' ? '-2px' : '0';
    
    // Z-index handling: elevated panel should be above tabs to hide their shadows
    // outlined tabs should be above panel to hide border where active tab meets panel
    const tabBarZIndex = variant === 'elevated' ? 0 : 1;
    const panelZIndex = variant === 'elevated' ? 2 : 0;

    // Apply the same variant styling to tabs
    const getTabVariantStyles = (isActive) => {
      let tabVariantStyle = {};
      const borderValue = `${theme.border.width} ${theme.border.style} ${theme.colors.border.secondary}`;
      
      switch (variant) {
        case 'default':
          tabVariantStyle = {
            bgColor: theme.colors.background.card,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            boxShadow: 'none',
            backdropFilter: 'none',
          };
          break;
        case 'elevated':
          tabVariantStyle = {
            bgColor: theme.colors.background.card,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            boxShadow: theme.shadow.elevated,
            backdropFilter: 'none',
          };
          break;
        case 'outlined':
          tabVariantStyle = {
            bgColor: theme.colors.background.card,
            borderTop: borderValue,
            borderLeft: borderValue,
            borderRight: borderValue,
            borderBottom: isActive ? 'none' : borderValue,
            boxShadow: 'none',
            backdropFilter: 'none',
          };
          break;
        case 'glass':
          tabVariantStyle = {
            bgColor: theme.colors.overlay.glass,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            boxShadow: 'none',
            backdropFilter: 'blur(4px)',
          };
          break;
      }
      
      return tabVariantStyle;
    };

    return html`
      <${StyledTabPanelsRoot} ...${rest}>
        <${StyledTabBar} gap=${theme.spacing.small.gap} zIndex=${tabBarZIndex}>
          ${tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const tabStyles = getTabVariantStyles(isActive);
            
            return html`
              <${StyledTab}
                key=${tab.id}
                tabPadding=${theme.spacing.small.padding}
                bgColor=${tabStyles.bgColor}
                borderTop=${tabStyles.borderTop}
                borderLeft=${tabStyles.borderLeft}
                borderRight=${tabStyles.borderRight}
                borderBottom=${tabStyles.borderBottom}
                boxShadow=${tabStyles.boxShadow}
                backdropFilter=${tabStyles.backdropFilter}
                borderRadius=${theme.spacing.medium.borderRadius}
              >
                <${Button}
                  variant=${tabSize}
                  color=${isActive ? 'primary' : 'transparent'}
                  onClick=${() => onTabChange(tab.id)}
                >
                  ${tab.label}
                </${Button}>
              </${StyledTab}>
            `;
          })}
        </${StyledTabBar}>
        <${StyledTabPanel} style=${combinedStyle} marginTop=${panelMarginTop} zIndex=${panelZIndex}>
          ${activeTabContent}
        </${StyledTabPanel}>
      </${StyledTabPanelsRoot}>
    `;
  }
}
