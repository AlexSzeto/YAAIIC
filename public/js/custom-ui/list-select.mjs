/**
 * list-select.mjs - Generic list selection modal with customizable items and actions
 * 
 * Provides a modal dialog for selecting items from a list with optional edit/delete actions.
 */
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { styled } from './goober-setup.mjs';
import { currentTheme } from './theme.mjs';
import { Button } from './button.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${props => props.theme.colors.overlay.background};
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Modal = styled('div')`
  background-color: ${props => props.theme.colors.background.card};
  border-radius: ${props => props.theme.spacing.medium.borderRadius};
  box-shadow: 0 4px 12px ${props => props.theme.colors.shadow};
  border: ${props => props.theme.border.width} ${props => props.theme.border.style} ${props => props.theme.colors.border.secondary};
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled('div')`
  padding: 20px 20px 0 20px;
`;

const Title = styled('h3')`
  margin: 0 0 15px 0;
  color: ${props => props.theme.colors.text.primary};
`;

const Content = styled('div')`
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
  min-height: 200px;
  max-height: 400px;
`;

const LoadingMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: ${props => props.theme.colors.text.secondary};
`;

const List = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ItemContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color ${props => props.theme.transitions.fast};
  opacity: ${props => props.disabled ? 0.5 : 1};
  
  ${props => !props.disabled ? `
    &:hover {
      background-color: ${props.theme.colors.background.hover};
    }
  ` : ''}
  
  ${props => props.isSelected ? `
    background-color: rgba(100, 150, 255, 0.15);
    border-left: 3px solid ${props.theme.colors.primary.background};
  ` : ''}
`;

const ItemLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
`;

const ItemName = styled('span')`
  color: ${props => props.theme.colors.text.primary};
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
`;

const ItemActions = styled('div')`
  display: flex;
  gap: ${props => props.theme.spacing.medium.gap};
  align-items: center;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
`;

// ============================================================================
// ListItem Component
// ============================================================================

/**
 * ListItem - Renders a single list item row with optional actions
 * 
 * @param {Object} props
 * @param {Object} props.item - Item data object
 * @param {string} props.item.id - Unique item identifier
 * @param {string} props.item.label - Display label
 * @param {string} [props.item.icon] - Optional box-icon name
 * @param {boolean} [props.item.disabled=false] - Whether item is disabled
 * @param {string} [props.itemIcon] - Default icon to use if item doesn't specify one
 * @param {boolean} props.isSelected - Whether this item is currently selected
 * @param {Function} props.onSelect - Callback when item is selected
 * @param {Function} [props.onEdit] - Optional edit callback
 * @param {Function} [props.onDelete] - Optional delete callback
 * @param {boolean} props.showActions - Whether to show edit/delete actions
 * @param {Object} props.theme - Current theme object
 * @returns {preact.VNode}
 */
function ListItem({ item, itemIcon, isSelected, onSelect, onEdit, onDelete, showActions, theme }) {
  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(item);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(item);
  };

  const icon = item.icon || itemIcon || 'list-ul';

  return html`
    <${ItemContainer} 
      isSelected=${isSelected}
      disabled=${item.disabled}
      theme=${theme}
      onClick=${() => !item.disabled && onSelect(item)}
    >
      <${ItemLabel} theme=${theme}>
        <box-icon 
          name='${icon}' 
          type='solid' 
          color='${theme.colors.text.secondary}' 
          size='20px'
        ></box-icon>
        <${ItemName} theme=${theme}>${item.label}<//>
      <//>
      ${showActions ? html`
        <${ItemActions} theme=${theme}>
          <${Button}
            variant="small-icon"
            icon="edit"
            onClick=${handleEditClick}
            disabled=${item.disabled || !onEdit}
            title=${item.disabled ? 'Cannot edit this item' : 'Edit item'}
          />
          <${Button}
            variant="small-icon"
            icon="trash"
            color="danger"
            onClick=${handleDeleteClick}
            disabled=${item.disabled || !onDelete}
            title=${item.disabled ? 'Cannot delete this item' : 'Delete item'}
          />
        <//>
      ` : null}
    <//>
  `;
}


// ============================================================================
// ListSelectModal Component
// ============================================================================

/**
 * ListSelectModal - Modal dialog for selecting items from a list
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {string} [props.title='Select Item'] - Modal title
 * @param {Array<Object>} [props.items=[]] - Array of item objects with id, label, optional icon, optional disabled
 * @param {string} [props.itemIcon] - Default icon for items that don't specify one
 * @param {string} [props.actionLabel] - Label for the action button (e.g., "New Item")
 * @param {boolean} [props.showActions=false] - Show edit/delete buttons on items
 * @param {boolean} [props.showActionButton=true] - Show the action button in footer
 * @param {string} [props.selectedId] - Currently selected item id
 * @param {string} [props.emptyMessage='No items available'] - Message to show when items array is empty
 * @param {Function} [props.onSelectItem] - Callback when item is selected: (item) => void
 * @param {Function} [props.onEdit] - Callback when edit is clicked: (item) => void
 * @param {Function} [props.onDelete] - Callback when delete is clicked: (item) => void
 * @param {Function} [props.onAction] - Callback for action button: () => void
 * @param {Function} [props.onClose] - Callback when modal is closed: () => void
 * @returns {preact.VNode|null}
 * 
 * @example
 * <ListSelectModal
 *   isOpen={true}
 *   title="Select Folder"
 *   items={[{ id: '1', label: 'Documents', icon: 'folder' }]}
 *   onSelectItem={(item) => console.log('Selected:', item)}
 *   onClose={() => setIsOpen(false)}
 * />
 */
class ListSelectModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedId: props.selectedId || null,
      theme: currentTheme.value
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.handleClose();
    }
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }

  handleClose = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  handleItemSelect = async (item) => {
    this.setState({ selectedId: item.id });
    
    if (this.props.onSelectItem) {
      await this.props.onSelectItem(item);
    }
    this.handleClose();
  }

  handleEdit = async (item) => {
    if (this.props.onEdit) {
      await this.props.onEdit(item);
    }
  }

  handleDelete = async (item) => {
    if (this.props.onDelete) {
      await this.props.onDelete(item);
    }
  }

  handleAction = async () => {
    if (this.props.onAction) {
      await this.props.onAction();
    }
  }

  render() {
    const { isLoading, selectedId, theme } = this.state;
    const { 
      isOpen, 
      title = 'Select Item', 
      items = [], 
      itemIcon,
      actionLabel,
      showActions = false,
      showActionButton = true
    } = this.props;

    if (!isOpen) {
      return null;
    }

    return html`
      <${Overlay} theme=${theme} onClick=${this.handleOverlayClick}>
        <${Modal} theme=${theme}>
          <${Header} theme=${theme}>
            <${Title} theme=${theme}>${title}<//>
          <//>
          
          <${Content} theme=${theme}>
            ${isLoading ? html`
              <${LoadingMessage} theme=${theme}>Loading...<//>
            ` : items.length === 0 ? html`
              <${LoadingMessage} theme=${theme}>No items available<//>
            ` : html`
              <${List} theme=${theme}>
                ${items.map(item => html`
                  <${ListItem}
                    key=${item.id}
                    item=${item}
                    itemIcon=${itemIcon}
                    isSelected=${item.id === selectedId}
                    onSelect=${this.handleItemSelect}
                    onEdit=${showActions ? this.handleEdit : null}
                    onDelete=${showActions ? this.handleDelete : null}
                    showActions=${showActions}
                    theme=${theme}
                  />
                `)}
              <//>
            `}
          <//>
          
          <${Footer} theme=${theme}>
            <${Button} 
              variant="medium-text"
              color="secondary"
              onClick=${this.handleClose}
            >
              Cancel
            </>
            ${showActionButton && actionLabel ? html`
              <${Button} 
                variant="medium-text"
                color="primary"
                onClick=${this.handleAction}
              >
                ${actionLabel}
              </>
            ` : null}
          </>
        <//>
      <//>
    `;
  }
}


// ============================================================================
// showListSelect Function
// ============================================================================

/**
 * showListSelect - Shows a list selection modal
 * 
 * A convenience function that creates and renders the ListSelectModal component
 * in a portal container. Returns a cleanup function to close and unmount the modal.
 * 
 * @param {Object} options - Configuration options
 * @param {string} [options.title='Select Item'] - Modal title
 * @param {Array<Object>} [options.items=[]] - List items with id, label, icon (optional), disabled (optional)
 * @param {string} [options.itemIcon] - Default boxicon name for items
 * @param {string} [options.actionLabel] - Label for action button (e.g., "New Item")
 * @param {boolean} [options.showActions=false] - Show edit/delete buttons on items
 * @param {boolean} [options.showActionButton=true] - Show the action button in footer
 * @param {string} [options.selectedId] - Currently selected item id
 * @param {string} [options.emptyMessage='No items available'] - Message to show when items array is empty (use 'Loading...' for loading state)
 * @param {Function} [options.onSelectItem] - Callback when item is selected: (item) => void
 * @param {Function} [options.onEdit] - Callback when edit is clicked: (item) => void
 * @param {Function} [options.onDelete] - Callback when delete is clicked: (item) => void
 * @param {Function} [options.onAction] - Callback for action button: () => void
 * @param {Function} [options.onClose] - Callback when modal is closed: () => void
 * 
 * @returns {Function} Cleanup function to close the modal
 * 
 * @example
 * // Basic usage
 * const cleanup = showListSelect({
 *   title: 'Select Export',
 *   items: [{ id: 'export1', label: 'My Export' }],
 *   itemIcon: 'export',
 *   onSelectItem: (item) => console.log('Selected:', item)
 * });
 * 
 * @example
 * // With edit/delete actions
 * const cleanup = showListSelect({
 *   title: 'Manage Items',
 *   items: [{ id: '1', label: 'Item 1' }],
 *   showActions: true,
 *   actionLabel: 'New Item',
 *   onSelectItem: (item) => handleSelect(item),
 *   onEdit: (item) => handleEdit(item),
 *   onDelete: (item) => handleDelete(item),
 *   onAction: () => createNewItem()
 * });
 */
export function showListSelect(options) {
  // Create container element
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Function to clean up modal
  const cleanup = () => {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  };

  const handleClose = () => {
    if (options.onClose) {
      options.onClose();
    }
    cleanup();
  };

  render(html`<${ListSelectModal}
    isOpen=${true}
    title=${options.title}
    items=${options.items || []}
    itemIcon=${options.itemIcon}
    actionLabel=${options.actionLabel}
    showActions=${options.showActions || false}
    showActionButton=${options.showActionButton !== false}
    selectedId=${options.selectedId}
    emptyMessage=${options.emptyMessage}
    onSelectItem=${options.onSelectItem}
    onEdit=${options.onEdit}
    onDelete=${options.onDelete}
    onAction=${options.onAction}
    onClose=${handleClose}
  />`, container);

  return cleanup;
}

export default ListSelectModal;
