/**
 * tag-selector-panel.mjs - Tag Selector Panel Component
 * 
 * Provides a hierarchical browser for selecting Danbooru tags from the category tree.
 * Displays tags organized by categories, allows navigation through the tree structure,
 * and includes search functionality with autocomplete.
 */

import { html, Component } from 'htm/preact';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { getCategoryTree, getTagDefinition, formatTagDisplayName } from './tag-data.mjs';

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Main panel container with glass effect and positioning
 */
const PanelContainer = styled('div')`
  position: fixed;
  z-index: 10001;
  max-width: 400px;
  min-width: 300px;
  max-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: ${props => props.padding};
  border-radius: ${props => props.borderRadius};
  background-color: ${props => props.backgroundColor};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: ${props => props.boxShadow};
  color: ${props => props.color};
  font-family: ${props => props.fontFamily};
  font-size: ${props => props.fontSize};
`;
PanelContainer.className = 'tag-selector-panel-container';

/**
 * Breadcrumb navigation section
 */
const BreadcrumbSection = styled('div')`
  display: flex;
  gap: ${props => props.gap};
  flex-wrap: wrap;
  margin-bottom: ${props => props.marginBottom};
`;
BreadcrumbSection.className = 'tag-selector-panel-breadcrumb-section';

/**
 * Search input section
 */
const SearchSection = styled('div')`
  margin-bottom: ${props => props.marginBottom};
`;
SearchSection.className = 'tag-selector-panel-search-section';

/**
 * Title section
 */
const TitleSection = styled('div')`
  margin-bottom: ${props => props.marginBottom};
`;
TitleSection.className = 'tag-selector-panel-title-section';

/**
 * Title text
 */
const Title = styled('h3')`
  margin: 0;
  padding: 0;
  font-size: ${props => props.fontSize};
  font-weight: ${props => props.fontWeight};
  color: ${props => props.color};
`;
Title.className = 'tag-selector-panel-title';

/**
 * Navigation section with scrollable area
 */
const NavigationSection = styled('div')`
  flex: 1;
  overflow-y: auto;
  margin-bottom: ${props => props.marginBottom};
  display: flex;
  flex-wrap: wrap;
  gap: ${props => props.gap};
  align-content: flex-start;
`;
NavigationSection.className = 'tag-selector-panel-navigation-section';

/**
 * Footer section with action buttons
 */
const FooterSection = styled('div')`
  display: flex;
  gap: ${props => props.gap};
  padding-top: ${props => props.paddingTop};
  border-top: 1px solid ${props => props.borderColor};
`;
FooterSection.className = 'tag-selector-panel-footer-section';

// ============================================================================
// Tag Selector Panel Component
// ============================================================================

/**
 * Tag Selector Panel Component
 * 
 * Displays a hierarchical interface for browsing and selecting tags from
 * the Danbooru category tree.
 * 
 * @param {Object} props
 * @param {Function} props.onSelect - Callback when a tag is selected: (tagName) => void
 * @param {Function} props.onClose - Callback when panel should close: () => void
 * @param {Object} props.position - Cursor position for panel placement: {x, y}
 * @returns {preact.VNode}
 * 
 * @example
 * <TagSelectorPanel
 *   onSelect={(tag) => console.log('Selected:', tag)}
 *   onClose={() => console.log('Closed')}
 *   position={{x: 100, y: 200}}
 * />
 */
export class TagSelectorPanel extends Component {
  constructor(props) {
    super(props);
    
    const categoryTree = getCategoryTree();
    
    this.state = {
      theme: currentTheme.value,
      path: [], // Navigation path as array of node names
      currentNode: 'tag_groups', // Current node key
      searchValue: '',
      categoryTree: categoryTree
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

  /**
   * Get the children of the current node
   */
  getCurrentChildren() {
    const { categoryTree, currentNode } = this.state;
    
    if (!categoryTree || !currentNode) {
      return [];
    }
    
    const children = categoryTree[currentNode];
    
    if (!children) {
      return [];
    }
    
    // If children is an array, return it; otherwise return empty
    return Array.isArray(children) ? children : [];
  }

  /**
   * Navigate to a child node
   */
  navigateToNode = (nodeName) => {
    const { path, currentNode } = this.state;
    
    // Add current node to path and set new current node
    this.setState({
      path: [...path, currentNode],
      currentNode: nodeName,
      searchValue: ''
    });
  }

  /**
   * Navigate back to a specific point in the path
   */
  navigateToPathIndex = (index) => {
    const { path } = this.state;
    
    if (index < 0 || index >= path.length) {
      return;
    }
    
    // Set current node to the selected path item
    // and trim path to everything before that index
    this.setState({
      path: path.slice(0, index),
      currentNode: path[index],
      searchValue: ''
    });
  }

  /**
   * Navigate to root
   */
  navigateToRoot = () => {
    this.setState({
      path: [],
      currentNode: 'tag_groups',
      searchValue: ''
    });
  }

  /**
   * Handle tag selection
   */
  handleSelect = () => {
    const { currentNode } = this.state;
    const { onSelect, onClose } = this.props;
    
    // Get the tag name without any prefix or path
    const tagName = currentNode.replace(/^tag_groups?:?\/*/i, '').replace(/.*\//, '');
    
    if (onSelect) {
      onSelect(tagName);
    }
    
    if (onClose) {
      onClose();
    }
  }

  /**
   * Handle cancel
   */
  handleCancel = () => {
    const { onClose } = this.props;
    
    if (onClose) {
      onClose();
    }
  }

  render() {
    const { position } = this.props;
    const { theme, currentNode } = this.state;
    
    const children = this.getCurrentChildren();
    const currentDefinition = getTagDefinition(currentNode);
    const displayName = formatTagDisplayName(currentNode);
    
    // Calculate position to ensure panel stays in viewport
    const panelStyle = {
      left: `${position.x}px`,
      top: `${position.y}px`
    };
    
    return html`
      <${PanelContainer}
        style=${panelStyle}
        padding=${theme.spacing.medium.padding}
        borderRadius=${theme.spacing.medium.borderRadius}
        backgroundColor=${theme.colors.overlay.glass}
        boxShadow=${theme.shadow.elevated}
        color=${theme.colors.text.primary}
        fontFamily=${theme.typography.fontFamily}
        fontSize=${theme.typography.fontSize.medium}
      >
        ${this.renderBreadcrumbs()}
        ${this.renderSearchSection()}
        ${this.renderTitleSection(displayName)}
        ${this.renderDefinitionSection(currentDefinition)}
        ${this.renderNavigationSection(children)}
        ${this.renderFooter()}
      </${PanelContainer}>
    `;
  }

  renderBreadcrumbs() {
    const { theme, path, currentNode } = this.state;
    
    return html`
      <${BreadcrumbSection}
        gap=${theme.spacing.small.gap}
        marginBottom=${theme.spacing.medium.gap}
      >
        <div>Breadcrumbs: TODO</div>
      </${BreadcrumbSection}>
    `;
  }

  renderSearchSection() {
    const { theme, searchValue } = this.state;
    
    return html`
      <${SearchSection}
        marginBottom=${theme.spacing.medium.gap}
      >
        <div>Search: TODO</div>
      </${SearchSection}>
    `;
  }

  renderTitleSection(displayName) {
    const { theme } = this.state;
    
    return html`
      <${TitleSection}
        marginBottom=${theme.spacing.small.gap}
      >
        <${Title}
          fontSize=${theme.typography.fontSize.large}
          fontWeight=${theme.typography.fontWeight.medium}
          color=${theme.colors.text.primary}
        >
          ${displayName}
        </${Title}>
      </${TitleSection}>
    `;
  }

  renderDefinitionSection(definition) {
    const { theme } = this.state;
    
    if (!definition) {
      return null;
    }
    
    return html`
      <div style=${{ marginBottom: theme.spacing.medium.gap }}>
        <div>Definition: ${definition}</div>
      </div>
    `;
  }

  renderNavigationSection(children) {
    const { theme } = this.state;
    
    return html`
      <${NavigationSection}
        marginBottom=${theme.spacing.medium.gap}
        gap=${theme.spacing.small.gap}
      >
        ${children.map(child => html`
          <div key=${child}>${formatTagDisplayName(child)}</div>
        `)}
      </${NavigationSection}>
    `;
  }

  renderFooter() {
    const { theme, currentNode } = this.state;
    const currentDefinition = getTagDefinition(currentNode);
    
    return html`
      <${FooterSection}
        gap=${theme.spacing.small.gap}
        paddingTop=${theme.spacing.small.padding}
        borderColor=${theme.colors.border.subtle}
      >
        <div>Select (${currentDefinition ? 'enabled' : 'disabled'})</div>
        <div>Cancel</div>
      </${FooterSection}>
    `;
  }
}
