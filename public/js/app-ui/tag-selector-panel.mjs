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
import { Button } from '../custom-ui/io/button.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { getCategoryTree, getTagDefinition, formatTagDisplayName, getAllTagNames } from './tag-data.mjs';
import { injectAutocompleteStyles } from './autocomplete-styles.mjs';
import { H2, HorizontalLayout, VerticalLayout } from '../custom-ui/themed-base.mjs';

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Main panel container with glass effect and positioning
 */
const PanelContainer = styled('div')`
  position: fixed;
  z-index: 10001;
  width: 400px;
  height: 500px;
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
  overflow-x: auto;
  padding-bottom: ${props => props.paddingBottom};
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
 * Navigation section with scrollable area
 */
const NavigationSection = styled('div')`
  flex: 1;
  overflow-y: auto;
  margin-bottom: ${props => props.marginBottom};
  padding-right: ${props => props.paddingRight}; /* For scrollbar space */
`;
NavigationSection.className = 'tag-selector-panel-navigation-section';

/**
 * Tag definition display component
 * Displays tag definitions with accent border and subtle background
 */
const DefinitionDisplay = styled('div')`
  padding: ${props => props.padding};
  margin-bottom: ${props => props.marginBottom};
  background-color: ${props => props.backgroundColor};
  border-left: 3px solid ${props => props.borderColor};
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  line-height: ${props => props.lineHeight};
`;
DefinitionDisplay.className = 'tag-selector-panel-definition';

/**
 * Footer section with action buttons
 */
const FooterSection = styled('div')`
  display: flex;
  flex-wrap: nowrap;
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
    
    this.searchInputId = 'tag-selector-search-' + Math.random().toString(36).substr(2, 9);
    this.autoCompleteInstance = null;
    this.autoCompleteId = null;
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
    
    // Initialize autocomplete
    this.initializeAutocomplete();
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    // Clean up autocomplete
    if (this.autoCompleteInstance) {
      // Remove the autocomplete list from DOM if it exists
      const list = this.autoCompleteInstance.list;
      if (list && list.parentNode) {
        list.parentNode.removeChild(list);
      }
      
      // Remove the style tag for this autocomplete instance
      if (this.autoCompleteId !== null) {
        const styleTag = document.getElementById('autocomplete-styles-' + this.autoCompleteId);
        if (styleTag && styleTag.parentNode) {
          styleTag.parentNode.removeChild(styleTag);
        }
      }
      
      this.autoCompleteInstance.unInit();
      this.autoCompleteInstance = null;
      this.autoCompleteId = null;
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
    
    // The category tree structure has arrays of child names
    if (!Array.isArray(children)) {
      return [];
    }
    
    const filteredChildren = children.filter(child => {
      const isNavigable = this.isNodeNavigable(child);
      const hasDefinition = getTagDefinition(child);
      return isNavigable || hasDefinition;
    });

    // Sort children by navigability only, preserving original order within each group
    const sortedChildren = [...filteredChildren];
    sortedChildren.sort((a, b) => {
      const isNavigableA = this.isNodeNavigable(a);
      const isNavigableB = this.isNodeNavigable(b);
      
      // Navigable nodes first, then preserve original order
      if (isNavigableA !== isNavigableB) {
        return isNavigableB ? 1 : -1;
      }
      
      return 0;
    });
    
    return sortedChildren;
  }
  
  /**
   * Check if a node is navigable (has children) or a leaf tag
   */
  isNodeNavigable(nodeName) {
    const { categoryTree } = this.state;
    
    // Check if this node name exists as a key in the category tree
    // If it does, it means it has children and is navigable
    const hasChildren = categoryTree[nodeName] !== undefined;
    
    return hasChildren;
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
   * Initialize autocomplete for the search input
   */
  initializeAutocomplete() {
    // Prevent re-initialization if instance already exists
    if (this.autoCompleteInstance) {
      return;
    }
    
    const tagNames = getAllTagNames();
    
    if (tagNames.length === 0) {
      console.warn('No tags available for autocomplete in tag selector');
      return;
    }
    
    const inputElement = document.getElementById(this.searchInputId);
    if (!inputElement) {
      console.warn('Search input element not found for autocomplete initialization');
      return;
    }
    
    // Initialize autoComplete.js
    this.autoCompleteInstance = new autoComplete({
      selector: `#${this.searchInputId}`,
      placeHolder: "Search tags...",
      data: {
        src: tagNames,
        cache: true,
      },
      resultsList: {
        maxResults: 10,
        destination: () => document.body,
        position: "afterbegin",
      },
      resultItem: {
        highlight: true
      },
      events: {
        input: {
          open: (event) => {
            // Position the autocomplete dropdown relative to the input
            const list = this.autoCompleteInstance.list;
            if (list && inputElement) {
              const inputRect = inputElement.getBoundingClientRect();
              list.style.position = 'fixed';
              list.style.left = inputRect.left + 'px';
              list.style.top = (inputRect.bottom + 4) + 'px';
              list.style.width = inputRect.width + 'px';
              list.style.zIndex = '10002'; // Higher than panel's 10001
            }
          },
          selection: (event) => {
            const selectedTag = event.detail.selection.value;
            
            // Navigate to the selected tag
            this.navigateToTag(selectedTag);
            
            // Update search input value
            inputElement.value = selectedTag;
            this.setState({ searchValue: selectedTag });
            
            // Dispatch input event for state sync
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    });
    
    // Store the autocomplete ID and inject styles for this instance
    this.autoCompleteId = this.autoCompleteInstance.id;
    injectAutocompleteStyles(this.autoCompleteId);
  }

  /**
   * Navigate to a specific tag in the tree
   * @param {string} tagName - The tag to navigate to
   */
  navigateToTag(tagName) {
    // Simple navigation: show tag_groups -> searched tag
    // This provides a single back link to reset the search
    this.setState({
      path: ['tag_groups'],
      currentNode: tagName,
      searchValue: tagName
    });
  }

  /**
   * Build the full path to a node by working backwards from its key
   * @param {string} nodeKey - The node key to find the path for
   * @returns {string[]} Path to the node
   */
  buildPathToNode(nodeKey) {
    const path = [];
    
    // Start from tag_groups and work forward
    if (nodeKey === 'tag_groups') {
      return [];
    }
    
    // For keys like "tag_groups/body" or "tag_group:body_parts", build the path
    path.push('tag_groups');
    
    // If the key starts with "tag_groups/" or "tag_group:", find parent categories
    if (nodeKey.startsWith('tag_groups/') || nodeKey.startsWith('tag_group:')) {
      // For now, we'll just return tag_groups as the parent
      // A more sophisticated approach would traverse the tree to find the full path
      return path;
    }
    
    return path;
  }

  /**
   * Handle tag selection
   */
  handleSelect = () => {
    const { currentNode } = this.state;
    const { onSelect } = this.props;
    
    // Get the tag name without any prefix or path
    const tagName = currentNode.replace(/^tag_groups?:?\/*/i, '').replace(/.*\//, '');
    
    if (onSelect) {
      onSelect(tagName);
    }

  }

  /**
   * Handle close
   */
  handleClose = () => {
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
    
    // Build full breadcrumb trail: [...path, currentNode]
    const breadcrumbs = [...path, currentNode];
    
    return html`
      <${BreadcrumbSection}
        gap=${theme.spacing.small.gap}
        marginBottom=${theme.spacing.medium.gap}
        paddingBottom=${theme.spacing.medium.padding}
      >
        ${breadcrumbs.map((nodeName, index) => {
          const isCurrent = index === breadcrumbs.length - 1;
          
          return html`
            <${Button}
              key=${nodeName + index}
              variant="small-text"
              color="secondary"
              disabled=${isCurrent}
              onClick=${isCurrent ? null : () => this.navigateToPathIndex(index)}
            >
              ${formatTagDisplayName(nodeName)}
            </${Button}>
          `;
        })}
      </${BreadcrumbSection}>
    `;
  }

  renderSearchSection() {
    const { theme, searchValue } = this.state;
    
    return html`
      <${SearchSection}
        marginBottom=${theme.spacing.medium.gap}
      >
        <${Input}
          id=${this.searchInputId}
          placeholder="Search tags..."
          value=${searchValue}
          onChange=${(e) => this.setState({ searchValue: e.target.value })}
          fullWidth=${true}
        />
      </${SearchSection}>
    `;
  }

  renderTitleSection(displayName) {
    const { theme } = this.state;
    
    return html`
      <${TitleSection}
        marginBottom=${theme.spacing.medium.gap}
      >
        <${H2}>
          ${displayName}
        </${H2}>
      </${TitleSection}>
    `;
  }

  renderDefinitionSection(definition) {
    const { theme } = this.state;
    
    console.log('Rendering definition section with definition:', definition);
    if (!definition) {
      return null;
    }
    
    return html`
      <${DefinitionDisplay}
        padding=${theme.spacing.medium.padding}
        marginBottom=${theme.spacing.medium.gap}
        backgroundColor=${theme.colors.background.subtle}
        borderColor=${theme.colors.primary.main}
        color=${theme.colors.text.secondary}
        fontSize=${theme.typography.fontSize.medium}
        lineHeight="1.4"
      >
        ${definition}
      </${DefinitionDisplay}>
    `;
  }

  renderNavigationSection(children) {
    const { theme } = this.state;
    
    return html`
      <${NavigationSection} paddingRight=${theme.spacing.medium.padding} marginBottom=${theme.spacing.medium.gap}>
        <${VerticalLayout} gap="small">
          ${children.map(child => {
            const displayName = formatTagDisplayName(child);
            const isNavigable = this.isNodeNavigable(child);
            
            return html`
              <${Button}
                key=${child}
                variant="medium-icon-text"
                color="secondary"
                icon=${isNavigable ? 'folder' : 'tag'}
                onClick=${() => this.navigateToNode(child)}
              >
                ${displayName}
              </${Button}>
            `;
          })}
        </${VerticalLayout}>
      </${NavigationSection}>
    `;
  }

  renderFooter() {
    const { theme, currentNode } = this.state;
    const currentDefinition = getTagDefinition(currentNode);
    
    return html`
      <${HorizontalLayout}
        gap=${theme.spacing.small.gap}
        paddingTop=${theme.spacing.small.padding}
        borderColor=${theme.colors.border.subtle}
      >
        <${Button}
          variant="medium-text"
          color="primary"
          disabled=${!currentDefinition}
          onClick=${this.handleSelect}
        >
          Select
        </${Button}>
        <${Button}
          variant="medium-text"
          color="secondary"
          onClick=${this.handleClose}
        >
          Close
        </${Button}>
      </${HorizontalLayout}>
    `;
  }
}
