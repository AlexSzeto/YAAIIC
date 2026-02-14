/**
 * tag-selector-panel.mjs - Tag Selector Panel Component
 * 
 * Provides a hierarchical browser for selecting Danbooru tags from the category tree.
 * Displays tags organized by categories, allows navigation through the tree structure,
 * and includes search functionality with autocomplete.
 */

import { createRef } from 'preact';
import { html, Component } from 'htm/preact';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Modal } from '../custom-ui/overlays/modal.mjs';
import { getCategoryTree, getTagDefinition, formatTagDisplayName, getAllTagNames, getMergedAutocompleteData } from './tag-data.mjs';
import { injectAutocompleteStyles } from './autocomplete-styles.mjs';
import { H2, VerticalLayout } from '../custom-ui/themed-base.mjs';

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Panel container with rigid dimensions for modal content
 * Provides fixed size and flex layout for proper navigation scrolling
 */
const PanelContainer = styled('div')`
  width: 400px;
  height: 500px;
  display: flex;
  flex-direction: column;
  gap: ${props => props.gap};
  overflow: hidden;
`;
PanelContainer.className = 'tag-selector-panel-container';

/**
 * Breadcrumb navigation section
 */
const BreadcrumbSection = styled('div')`
  display: flex;
  gap: ${props => props.gap};
  overflow-x: auto;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;
BreadcrumbSection.className = 'tag-selector-panel-breadcrumb-section';

/**
 * Search input section
 */
const SearchSection = styled('div')`
`;
SearchSection.className = 'tag-selector-panel-search-section';

/**
 * Title section
 */
const TitleSection = styled('div')`
`;
TitleSection.className = 'tag-selector-panel-title-section';

/**
 * Navigation section with scrollable area
 */
const NavigationSection = styled('div')`
  flex: 2 1 0;
  overflow-y: auto;
  padding-right: ${props => props.paddingRight}; /* For scrollbar space */
`;
NavigationSection.className = 'tag-selector-panel-navigation-section';

/**
 * Tag definition display component
 * Displays tag definitions with accent border and subtle background
 */
const DefinitionDisplay = styled('div')`
  flex: 1 1 0;
  padding: 0 ${props => props.padding};
  margin-bottom: ${props => props.marginBottom};
  background-color: ${props => props.backgroundColor};
  border-left: 3px solid ${props => props.borderColor};
  color: ${props => props.color};
  font-size: ${props => props.fontSize};
  line-height: ${props => props.lineHeight};
  overflow-y: scroll;
`;
DefinitionDisplay.className = 'tag-selector-panel-definition';

/** Spacer section for when both Navigation and Definition sections are absent */
const SpacerSection = styled('div')`
  flex: 1 1 0;
`;
SpacerSection.className = 'tag-selector-panel-spacer-section';

/**
 * Footer section with action buttons
 */
const FooterSection = styled('div')`
  display: flex;
  flex-wrap: nowrap;
  gap: ${props => props.gap};
  padding-top: ${props => props.paddingTop};
`;
FooterSection.className = 'tag-selector-panel-footer-section';

// ============================================================================
// Tag Selector Panel Component
// ============================================================================

/**
 * Tag Selector Panel Component
 * 
 * Displays a hierarchical interface for browsing and selecting tags from
 * the Danbooru category tree in a modal dialog.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onSelect - Callback when a tag is selected: (tagName) => void
 * @param {Function} props.onClose - Callback when modal should close: () => void
 * @returns {preact.VNode}
 * 
 * @example
 * <TagSelectorPanel
 *   isOpen={isOpen}
 *   onSelect={(tag) => console.log('Selected:', tag)}
 *   onClose={() => console.log('Closed')}
 * />
 */
export class TagSelectorPanel extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      theme: currentTheme.value,
      path: [], // Navigation path as array of node names
      currentNode: 'tag_groups', // Current node key
      searchValue: '',
      categoryTree: {} // Will be populated when modal opens
    };
    
    this.searchInputId = 'tag-selector-search-' + Math.random().toString(36).substr(2, 9);
    this.autoCompleteInstance = null;
    this.autoCompleteId = null;
    this.breadcrumbRef = createRef();
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    // Initialize autocomplete and load category tree when modal opens
    if (this.props.isOpen && !prevProps.isOpen) {
      // Load category tree
      const categoryTree = getCategoryTree();
      this.setState({ categoryTree });
      
      // Wait for next tick to ensure DOM is ready for autocomplete
      setTimeout(() => {
        this.initializeAutocomplete();
      }, 0);
    }
    
    // Clean up autocomplete when modal closes
    if (!this.props.isOpen && prevProps.isOpen) {
      this.cleanupAutocomplete();
    }
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.cleanupAutocomplete();
  }

  /**
   * Clean up autocomplete instance
   */
  cleanupAutocomplete() {
    if (!this.autoCompleteInstance) {
      return;
    }
    
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

  /**
   * Scroll breadcrumb to the rightmost position
   */
  scrollBreadcrumbToRight() {
    console.log('Scrolling breadcrumb to right', this.breadcrumbRef);
    if (this.breadcrumbRef.current.base) {
      // Use nextTick to ensure DOM is updated
      requestAnimationFrame(() => {
        if (this.breadcrumbRef.current.base) {
          this.breadcrumbRef.current.base.scrollLeft = this.breadcrumbRef.current.base.scrollWidth;
        } else {
          console.warn('Breadcrumb ref not set on scroll attempt');
        }
      });
    } else {
      console.warn('Breadcrumb ref not set, cannot scroll to right');
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
   * Get counts of categories and tags from current children
   * @returns {{ categories: number, tags: number }}
   */
  getCategoriesAndTagsCounts() {
    const children = this.getCurrentChildren();
    
    let categories = 0;
    let tags = 0;
    
    for (const child of children) {
      const isNavigable = this.isNodeNavigable(child);
      const hasDefinition = getTagDefinition(child);
      
      if (isNavigable) {
        categories++;
      } else if (hasDefinition) {
        tags++;
      }
    }
    
    return { categories, tags };
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
    },
    // Scroll breadcrumb to right when navigation changes
    () => this.scrollBreadcrumbToRight());
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
    
    const autocompleteData = getMergedAutocompleteData();
    
    if (autocompleteData.length === 0) {
      console.warn('No tags or categories available for autocomplete in tag selector');
      return;
    }
    
    // Store autocomplete data for lookup during selection
    this.autocompleteData = autocompleteData;
    
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
        src: autocompleteData.map(item => item.display),
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
              list.style.zIndex = '10003'; // Higher than modal's 10000
            }
          },
          selection: (event) => {
            const selectedDisplay = event.detail.selection.value;
            
            // Look up the selected item from autocomplete data
            const selectedItem = this.autocompleteData.find(item => item.display === selectedDisplay);
            
            if (!selectedItem) {
              console.warn('Selected item not found in autocomplete data:', selectedDisplay);
              return;
            }
            
            // Navigate to the selected tag/category with isCategory flag
            this.navigateToTag(selectedItem.internal, selectedItem.isCategory);
            
            // Update search input value
            inputElement.value = selectedDisplay;
            this.setState({ searchValue: selectedDisplay });
          }
        }
      }
    });
    
    // Store the autocomplete ID and inject styles for this instance
    this.autoCompleteId = this.autoCompleteInstance.id;
    injectAutocompleteStyles(this.autoCompleteId);
  }

  /**
   * Find the parent node for a given child node in the category tree
   * @param {string} childNode - The child node to find parent for
   * @returns {string|null} Parent node name or null if not found
   */
  findParentNode(childNode) {
    const { categoryTree } = this.state;
    
    // Search through all nodes in the category tree
    for (const [nodeName, children] of Object.entries(categoryTree)) {
      if (Array.isArray(children) && children.includes(childNode)) {
        return nodeName;
      }
    }
    
    return null;
  }

  /**
   * Build the full breadcrumb path to a node by traversing upward through the tree
   * @param {string} nodeKey - The node to build path for
   * @returns {string[]} Path to the node (excluding the node itself)
   */
  buildPathToNode(nodeKey) {
    const path = [];
    let currentNode = nodeKey;
    
    // Traverse upward until we reach tag_groups or can't find a parent
    while (true) {
      const parent = this.findParentNode(currentNode);
      
      if (!parent) {
        // No parent found, add tag_groups if not already at root
        if (currentNode !== 'tag_groups') {
          path.unshift('tag_groups');
        }
        break;
      }
      
      if (parent === 'tag_groups') {
        // Reached tag_groups, add it and stop
        path.unshift('tag_groups');
        break;
      }
      
      // Add parent to the beginning of path and continue upward
      path.unshift(parent);
      currentNode = parent;
    }
    
    return path;
  }

  /**
   * Navigate to a specific tag or category in the tree
   * @param {string} internalName - The internal name of the tag or category to navigate to
   * @param {boolean} isCategory - Whether the item is a category (has children) or a tag
   */
  navigateToTag(internalName, isCategory) {
    // Build full path to the node
    const path = this.buildPathToNode(internalName);
    
    // Set state with the computed path and the selected node
    this.setState({
      path: path,
      currentNode: internalName,
      searchValue: ''
    });
  }

  /**
   * Handle tag insertion
   */
  handleInsert = () => {
    const { currentNode } = this.state;
    const { onSelect } = this.props;
    
    // Get the tag name without any prefix or path
    const tagName = currentNode.replace(/^tag_groups?:?\/*/i, '').replace(/.*\//, '').replace(/_/g, ' ');
    
    if (onSelect) {
      onSelect(tagName);
    }
    
    // Don't close the modal - user can continue selecting tags
  }

  render() {
    const { isOpen, onClose } = this.props;
    const { theme, currentNode } = this.state;
    
    const children = this.getCurrentChildren();
    const currentDefinition = getTagDefinition(currentNode);
    const displayName = formatTagDisplayName(currentNode);
    
    const definitionSection = this.renderDefinitionSection(currentDefinition);
    const navigationSection = this.renderNavigationSection(children);

    return html`
      <${Modal}
        isOpen=${isOpen}
        onClose=${onClose}
        showHeader=${false}
        width="450px"
        height="550px"
      >
        <${PanelContainer} gap=${theme.spacing.medium.gap}>
          <${H2}>Search</${H2}>
          ${this.renderSearchSection()}
          ${this.renderBreadcrumbs()}
          ${this.renderTitleSection(displayName)}
          ${definitionSection}
          ${navigationSection}
          ${!definitionSection && !navigationSection ? html`<${SpacerSection} />` : null}
          ${this.renderFooter()}
        </${PanelContainer}>
      </${Modal}>
    `;
  }

  renderBreadcrumbs() {
    const { theme, path, currentNode } = this.state;
    
    // Build full breadcrumb trail: [...path, currentNode]
    const breadcrumbs = [...path, currentNode];
    
    return html`
      <${BreadcrumbSection}
        ref=${this.breadcrumbRef}
        gap=${theme.spacing.small.gap}
        paddingBottom=${theme.spacing.small.padding}
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
    const { categories, tags } = this.getCategoriesAndTagsCounts();
    
    // Format counts with proper pluralization
    const categoryText = categories === 1 ? 'category' : 'categories';
    const tagText = tags === 1 ? 'tag' : 'tags';
    
    // Build count string
    let countString = '';
    if (categories > 0 && tags > 0) {
      countString = `${categories} ${categoryText}, ${tags} ${tagText}`;
    } else if (categories > 0) {
      countString = `${categories} ${categoryText}`;
    } else if (tags > 0) {
      countString = `${tags} ${tagText}`;
    }
    
    return html`
      <${TitleSection}
        marginBottom=${theme.spacing.medium.gap}
      >
        <${H2}>
          ${displayName}
        </${H2}>
        <div>${countString}</div>
      </${TitleSection}>
    `;
  }

  renderDefinitionSection(definition) {
    const { theme } = this.state;
    
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
    
    if(children.length === 0) {
      return null;
    }

    return html`
      <${NavigationSection} paddingRight=${theme.spacing.medium.padding}>
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
      <${FooterSection}
        gap=${theme.spacing.small.gap}
        paddingTop=${theme.spacing.small.padding}
        borderColor=${theme.colors.border.subtle}
      >
        <${Button}
          variant="medium-text"
          color="primary"
          disabled=${!currentDefinition}
          onClick=${this.handleInsert}
        >
          Insert
        </${Button}>
      </${FooterSection}>
    `;
  }
}
