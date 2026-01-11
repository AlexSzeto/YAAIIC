// List Select Modal Component
// A generic list selection modal with customizable items and actions
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { Button } from './button.mjs';

// ListItem component - renders a single list item row
function ListItem({ item, itemIcon, isSelected, onSelect, onEdit, onDelete, showActions }) {
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
    <div class="folder-item ${isSelected ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}" 
         onClick=${() => !item.disabled && onSelect(item)}>
      <div class="folder-label">
        <box-icon name='${icon}' type='solid' color='var(--dark-text-secondary)' size='20px'></box-icon>
        <span class="folder-name">${item.label}</span>
      </div>
      ${showActions ? html`
        <div class="folder-actions">
          <${Button}
            variant="icon"
            icon="edit"
            onClick=${handleEditClick}
            disabled=${item.disabled || !onEdit}
            title=${item.disabled ? 'Cannot edit this item' : 'Edit item'}
          />
          <${Button}
            variant="icon"
            icon="trash"
            onClick=${handleDeleteClick}
            disabled=${item.disabled || !onDelete}
            title=${item.disabled ? 'Cannot delete this item' : 'Delete item'}
          />
        </div>
      ` : null}
    </div>
  `;
}

// ListSelectModal component
class ListSelectModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedId: props.selectedId || null,
      isLoading: props.isLoading || false
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.handleClose();
    }
  }

  handleOverlayClick = (e) => {
    if (e.target.classList.contains('folder-select-overlay')) {
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
    const { isLoading, selectedId } = this.state;
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
      <div class="folder-select-overlay" onClick=${this.handleOverlayClick}>
        <div class="folder-select-modal">
          <div class="folder-select-header">
            <h3 class="folder-select-title">${title}</h3>
          </div>
          
          <div class="folder-select-content">
            ${isLoading ? html`
              <div class="folder-loading">Loading...</div>
            ` : items.length === 0 ? html`
              <div class="folder-loading">No items available</div>
            ` : html`
              <div class="folder-list">
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
                  />
                `)}
              </div>
            `}
          </div>
          
          <div class="folder-select-footer">
            <button class="folder-btn cancel-btn" onClick=${this.handleClose}>
              Cancel
            </button>
            ${showActionButton && actionLabel ? html`
              <button class="folder-btn insert-btn" onClick=${this.handleAction}>
                ${actionLabel}
              </button>
            ` : null}
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Shows the list select modal
 * 
 * @param {object} options - Configuration options
 * @param {string} options.title - Modal title
 * @param {Array} options.items - List items with id, label, icon (optional), disabled (optional)
 * @param {string} options.itemIcon - Default boxicon name for items
 * @param {string} options.actionLabel - Label for action button (e.g., "New Item")
 * @param {boolean} options.showActions - Show edit/delete buttons on items
 * @param {boolean} options.showActionButton - Show the action button in footer
 * @param {Function} options.onSelectItem - Callback when item is selected
 * @param {Function} options.onEdit - Callback when edit is clicked
 * @param {Function} options.onDelete - Callback when delete is clicked
 * @param {Function} options.onAction - Callback for action button
 * @param {Function} options.onClose - Callback when modal is closed
 * @param {string} options.selectedId - Currently selected item id
 * 
 * @returns {Function} Cleanup function to close the modal
 * 
 * @example
 * const cleanup = showListSelect({
 *   title: 'Select Export',
 *   items: [{ id: 'export1', label: 'My Export' }],
 *   itemIcon: 'export',
 *   onSelectItem: (item) => console.log('Selected:', item)
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
    onSelectItem=${options.onSelectItem}
    onEdit=${options.onEdit}
    onDelete=${options.onDelete}
    onAction=${options.onAction}
    onClose=${handleClose}
  />`, container);

  return cleanup;
}

export default ListSelectModal;
