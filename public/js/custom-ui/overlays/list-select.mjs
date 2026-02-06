/**
 * list-select.mjs - Generic list selection modal with customizable items and actions
 * 
 * Provides a modal dialog for selecting items from a list with optional edit/delete actions.
 */
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Icon } from '../layout/icon.mjs';
import { BaseOverlay, BaseContainer, BaseHeader, BaseTitle } from './modal-base.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const ModalWrapper = styled('div')`
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
`;
ModalWrapper.className = 'modal-wrapper';

const Content = styled('div')`
  flex: 1;
  overflow-y: auto;
  margin: 0 -16px;
  padding: 10px 0;
  min-height: 200px;
  max-height: 400px;
`;
Content.className = 'content';

const LoadingMessage = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: ${props => props.theme.colors.text.secondary};
`;
LoadingMessage.className = 'loading-message';

const List = styled('div')`
  display: flex;
  flex-direction: column;
`;
List.className = 'list';

const ItemContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: ${props => props.unselectable ? 'default' : 'pointer'};
  transition: background-color ${props => props.theme.transitions.fast};
  opacity: ${props => props.unselectable ? 0.5 : 1};
  
  ${props => !props.unselectable ? `
    &:hover {
      background-color: ${props.theme.colors.background.hover};
    }
  ` : ''}
  
  ${props => props.isSelected ? `
    background-color: rgba(100, 150, 255, 0.15);
    border-left: 3px solid ${props.theme.colors.primary.background};    
  ` : ''}
`;
ItemContainer.className = 'item-container';

const ItemLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
`;
ItemLabel.className = 'item-label';

const ItemName = styled('span')`
  color: ${props => props.theme.colors.text.primary};
  font-size: ${props => props.theme.typography.fontSize.medium};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
`;
ItemName.className = 'item-name';

const ItemActions = styled('div')`
  display: flex;
  gap: ${props => props.theme.spacing.medium.gap};
  align-items: center;
`;
ItemActions.className = 'item-actions';

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 15px;
  margin-top: 10px;
`;
Footer.className = 'footer';

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
 * @param {string} [props.item.icon] - Optional icon name for the Icon component
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
      unselectable=${item.unselectable}
      theme=${theme}
      onClick=${() => !item.unselectable && onSelect(item)}
    >
      <${ItemLabel} theme=${theme}>
        <${Icon} 
          name=${icon} 
          type='solid' 
          color=${theme.colors.text.secondary} 
          size='20px'
        />
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
      selectedId: props.selectedId ?? null,
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
    // Check if click was directly on the overlay element (not bubbled from children)
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
      <${BaseOverlay} 
        bgColor=${theme.colors.overlay.background}
        onClick=${this.handleOverlayClick}
      >
        <${BaseContainer}
          bgColor=${theme.colors.background.card}
          textColor=${theme.colors.text.primary}
          borderRadius=${theme.spacing.medium.borderRadius}
          maxWidth="90vw"
          maxHeight="80vh"
          minWidth="auto"
          shadowColor=${theme.shadow.colorStrong}
        >
          <${ModalWrapper}>
            <${BaseHeader} marginBottom="16px">
              <${BaseTitle}
                color=${theme.colors.text.primary}
                fontFamily=${theme.typography.fontFamily}
                fontWeight=${theme.typography.fontWeight.bold}
              >
                ${title}
              <//>
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
            <//>
          <//>
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
