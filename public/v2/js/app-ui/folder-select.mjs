/**
 * folder-select.mjs - Folder selection modal using ListSelect as base
 * 
 * Provides a modal dialog for selecting, creating, renaming, and deleting folders.
 * Uses the generic ListSelectModal component for consistent styling and behavior.
 */
import { showListSelect } from '../custom-ui/overlays/list-select.mjs';
import { showTextPrompt, showDialog } from '../custom-ui/dialog.mjs';

/**
 * Internal helper to fetch folders from the server
 * @returns {Promise<Array<{id: string, label: string, icon: string, disabled: boolean}>>}
 */
async function fetchFolderItems() {
  try {
    const response = await fetch('/folder');
    if (!response.ok) {
      throw new Error('Failed to fetch folders');
    }
    const data = await response.json();
    // Transform folder data to list-select item format
    return data.list.map(folder => ({
      id: folder.uid,
      label: folder.label,
      icon: 'folder',
      // Unsorted folder (empty uid) cannot be edited/deleted
      disabled: folder.uid === ''
    }));
  } catch (error) {
    console.error('Error fetching folders:', error);
    return [];
  }
}

/**
 * Creates a new folder on the server
 * @param {string} label - New folder name
 * @returns {Promise<{uid: string, label: string}|null>} Created folder or null on failure
 */
async function createFolder(label) {
  try {
    const response = await fetch('/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim() })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create folder');
    }
    
    const data = await response.json();
    return { uid: data.current, label: label.trim() };
  } catch (error) {
    console.error('Error creating folder:', error);
    await showDialog('Failed to create folder', 'Error');
    return null;
  }
}

/**
 * Renames a folder on the server
 * @param {string} uid - Folder uid to rename
 * @param {string} newLabel - New folder name
 * @returns {Promise<boolean>} True on success
 */
async function renameFolder(uid, newLabel) {
  try {
    const response = await fetch('/folder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, label: newLabel.trim() })
    });
    
    if (!response.ok) {
      throw new Error('Failed to rename folder');
    }
    
    return true;
  } catch (error) {
    console.error('Error renaming folder:', error);
    await showDialog('Failed to rename folder', 'Error');
    return false;
  }
}

/**
 * Deletes a folder on the server
 * @param {string} uid - Folder uid to delete
 * @returns {Promise<boolean>} True on success
 */
async function deleteFolder(uid) {
  try {
    const response = await fetch(`/folder/${uid}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete folder');
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting folder:', error);
    await showDialog('Failed to delete folder', 'Error');
    return false;
  }
}

/**
 * Shows the folder select modal
 * 
 * A modal for selecting folders with options to create, rename, and delete folders.
 * Uses ListSelect internally for consistent styling.
 * 
 * @param {Function} onSelectFolder - Callback when a folder is selected, receives folder uid
 * @param {Function} [onRenameFolder] - Optional callback when a folder is renamed: (uid, newLabel) => void
 * @param {Function} [onDeleteFolder] - Optional callback when a folder is deleted: (uid) => void
 * @param {Function} [onInsertFolder] - Optional callback when a new folder is created: (newFolder) => void
 * @param {string} [currentFolder] - Current folder uid to show as selected
 * 
 * @returns {Function} Cleanup function to close the modal
 * 
 * @example
 * const cleanup = showFolderSelect(
 *   async (uid) => {
 *     console.log('Selected folder:', uid);
 *   },
 *   (uid, newLabel) => console.log('Renamed:', uid, newLabel),
 *   (uid) => console.log('Deleted:', uid),
 *   (newFolder) => console.log('Created:', newFolder),
 *   currentFolderUid
 * );
 */
export function showFolderSelect(onSelectFolder, onRenameFolder, onDeleteFolder, onInsertFolder, currentFolder) {
  // Store cleanup function reference for re-rendering
  let cleanupRef = null;
  
  // Function to show the modal with current folder items
  async function showModal() {
    // Fetch folders from server
    const items = await fetchFolderItems();
    
    // Show list select modal
    cleanupRef = showListSelect({
      title: 'Select Folder',
      items,
      itemIcon: 'folder',
      actionLabel: 'New Folder',
      showActions: true,
      showActionButton: true,
      selectedId: currentFolder,
      emptyMessage: items.length === 0 ? 'Loading...' : 'No folders available',
      
      onSelectItem: async (item) => {
        if (onSelectFolder) {
          await onSelectFolder(item.id);
        }
      },
      
      onEdit: async (item) => {
        const newLabel = await showTextPrompt('Rename Folder', item.label, 'Folder name');
        if (newLabel && newLabel.trim() && newLabel !== item.label) {
          const success = await renameFolder(item.id, newLabel);
          if (success) {
            if (onRenameFolder) {
              onRenameFolder(item.id, newLabel.trim());
            }
            // Re-show modal with updated items
            if (cleanupRef) {
              cleanupRef();
            }
            showModal();
          }
        }
      },
      
      onDelete: async (item) => {
        const result = await showDialog(
          `Delete folder "${item.label}"? All images in this folder will be moved to Unsorted.`,
          'Confirm Delete',
          ['Delete', 'Cancel']
        );
        
        if (result === 'Delete') {
          const success = await deleteFolder(item.id);
          if (success) {
            if (onDeleteFolder) {
              onDeleteFolder(item.id);
            }
            // Re-show modal with updated items
            if (cleanupRef) {
              cleanupRef();
            }
            showModal();
          }
        }
      },
      
      onAction: async () => {
        const folderName = await showTextPrompt('New Folder', '', 'Folder name');
        if (folderName && folderName.trim()) {
          const newFolder = await createFolder(folderName);
          if (newFolder) {
            if (onInsertFolder) {
              onInsertFolder(newFolder.uid);
            }
            // Select the newly created folder
            if (onSelectFolder) {
              await onSelectFolder(newFolder.uid);
            }
            // Close the modal (selecting already closes it)
            if (cleanupRef) {
              cleanupRef();
            }
          }
        }
      }
    });
  }
  
  // Initial render
  showModal();
  
  // Return cleanup function
  return () => {
    if (cleanupRef) {
      cleanupRef();
    }
  };
}

export default showFolderSelect;
