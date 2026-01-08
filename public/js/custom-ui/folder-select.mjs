// Folder Select Modal Component
import { render, Component } from 'preact';
import { html } from 'htm/preact';
import { showTextPrompt, showDialog } from './dialog.mjs';

// FolderItem component - renders a single folder row
function FolderItem({ folder, isSelected, onSelect, onRename, onDelete }) {
  const handleRenameClick = (e) => {
    e.stopPropagation();
    onRename(folder);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(folder);
  };

  return html`
    <div class="folder-item ${isSelected ? 'selected' : ''}" onClick=${() => onSelect(folder.uid)}>
      <div class="folder-label">
        <span class="folder-icon">📁</span>
        <span class="folder-name">${folder.label}</span>
      </div>
      <div class="folder-actions">
        ${folder.uid !== '' && html`
          <button
            class="folder-action-btn rename-btn"
            onClick=${handleRenameClick}
            title="Rename folder"
          >
            ✏️
          </button>
          <button
            class="folder-action-btn delete-btn"
            onClick=${handleDeleteClick}
            title="Delete folder"
          >
            🗑️
          </button>
        `}
      </div>
    </div>
  `;
}

// FolderSelectModal component
class FolderSelectModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      folders: [],
      currentFolder: props.currentFolder || '',
      isLoading: true
    };
  }

  componentDidMount() {
    this.fetchFolders();
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

  fetchFolders = async () => {
    try {
      const response = await fetch('/folder');
      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }
      const data = await response.json();
      this.setState({
        folders: data.list,
        currentFolder: data.current,
        isLoading: false
      });
    } catch (error) {
      console.error('Error fetching folders:', error);
      this.setState({ isLoading: false });
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

  handleFolderSelect = async (uid) => {
    if (this.props.onSelectFolder) {
      await this.props.onSelectFolder(uid);
    }
    this.handleClose();
  }

  handleRenameFolder = async (folder) => {
    const newLabel = await showTextPrompt('Rename Folder', folder.label, 'Folder name');
    if (newLabel && newLabel.trim() && newLabel !== folder.label) {
      try {
        const response = await fetch('/folder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: folder.uid, label: newLabel.trim() })
        });
        
        if (!response.ok) {
          throw new Error('Failed to rename folder');
        }
        
        // Refresh folder list
        await this.fetchFolders();
        
        if (this.props.onRenameFolder) {
          this.props.onRenameFolder(folder.uid, newLabel.trim());
        }
      } catch (error) {
        console.error('Error renaming folder:', error);
        await showDialog('Failed to rename folder', 'Error');
      }
    }
  }

  handleDeleteFolder = async (folder) => {
    const result = await showDialog(
      `Delete folder "${folder.label}"? All images in this folder will be moved to Unsorted.`,
      'Confirm Delete',
      ['Delete', 'Cancel']
    );
    
    if (result === 'Delete') {
      try {
        const response = await fetch(`/folder/${folder.uid}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete folder');
        }
        
        // Refresh folder list
        await this.fetchFolders();
        
        if (this.props.onDeleteFolder) {
          this.props.onDeleteFolder(folder.uid);
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
        await showDialog('Failed to delete folder', 'Error');
      }
    }
  }

  handleInsertFolder = async () => {
    const folderName = await showTextPrompt('New Folder', '', 'Folder name');
    if (folderName && folderName.trim()) {
      try {
        const response = await fetch('/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: folderName.trim() })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create folder');
        }
        
        const data = await response.json();
        
        // Refresh folder list
        await this.fetchFolders();
        
        if (this.props.onInsertFolder) {
          this.props.onInsertFolder(data.current);
        }
        
        // Select the newly created folder
        this.handleFolderSelect(data.current);
      } catch (error) {
        console.error('Error creating folder:', error);
        await showDialog('Failed to create folder', 'Error');
      }
    }
  }

  render() {
    const { isLoading, folders, currentFolder } = this.state;

    if (!this.props.isOpen) {
      return null;
    }

    return html`
      <div class="folder-select-overlay" onClick=${this.handleOverlayClick}>
        <div class="folder-select-modal">
          <div class="folder-select-header">
            <h3 class="folder-select-title">Select Folder</h3>
          </div>
          
          <div class="folder-select-content">
            ${isLoading ? html`
              <div class="folder-loading">Loading folders...</div>
            ` : html`
              <div class="folder-list">
                ${folders.map(folder => html`
                  <${FolderItem}
                    key=${folder.uid}
                    folder=${folder}
                    isSelected=${folder.uid === currentFolder}
                    onSelect=${this.handleFolderSelect}
                    onRename=${this.handleRenameFolder}
                    onDelete=${this.handleDeleteFolder}
                  />
                `)}
              </div>
            `}
          </div>
          
          <div class="folder-select-footer">
            <button class="folder-btn cancel-btn" onClick=${this.handleClose}>
              Cancel
            </button>
            <button class="folder-btn insert-btn" onClick=${this.handleInsertFolder}>
              New Folder
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Shows the folder select modal
 * 
 * @param {Function} onSelectFolder - Callback when a folder is selected, receives folder uid
 * @param {Function} [onRenameFolder] - Optional callback when a folder is renamed
 * @param {Function} [onDeleteFolder] - Optional callback when a folder is deleted
 * @param {Function} [onInsertFolder] - Optional callback when a new folder is created
 * @param {string} [currentFolder] - Current folder uid to show as selected
 * 
 * @returns {Function} Cleanup function to close the modal
 * 
 * @example
 * const cleanup = showFolderSelect(async (uid) => {
 *   console.log('Selected folder:', uid);
 * }, null, null, null, currentFolderUid);
 */
export function showFolderSelect(onSelectFolder, onRenameFolder, onDeleteFolder, onInsertFolder, currentFolder) {
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
    cleanup();
  };

  render(html`<${FolderSelectModal}
    isOpen=${true}
    currentFolder=${currentFolder}
    onSelectFolder=${onSelectFolder}
    onRenameFolder=${onRenameFolder}
    onDeleteFolder=${onDeleteFolder}
    onInsertFolder=${onInsertFolder}
    onClose=${handleClose}
  />`, container);

  return cleanup;
}

export default FolderSelectModal;
