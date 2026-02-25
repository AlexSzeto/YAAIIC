/**
 * use-folder-select.mjs – Shared utility for opening the folder-selection modal
 * and persisting the chosen folder on the server.
 *
 * Usage:
 *   openFolderSelect({
 *     currentFolder,          // { uid, label } – currently active folder
 *     onFolderChanged,        // (folder: { uid, label }) => void
 *     toast,                  // optional toast instance from useToast()
 *   });
 */
import { showFolderSelect } from './folder-select.mjs';

/**
 * Opens the folder-selection modal. On selection, persists the chosen folder
 * via POST /folder and calls onFolderChanged with the new folder object.
 *
 * @param {Object} options
 * @param {{ uid: string, label: string }} options.currentFolder - Currently active folder
 * @param {Function} options.onFolderChanged - Called with new folder {uid, label} after server update
 * @param {Object} [options.toast] - Optional toast instance for success/error feedback
 */
export function openFolderSelect({ currentFolder, onFolderChanged, toast }) {
  showFolderSelect(
    async (selectedUid) => {
      try {
        const response = await fetch('/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: selectedUid }),
        });

        if (!response.ok) throw new Error('Failed to select folder');

        const folderData = await response.json();
        const selectedFolder =
          folderData.list.find((f) => f.uid === selectedUid) ||
          { uid: '', label: 'Unsorted' };

        onFolderChanged(selectedFolder);

        if (toast) toast.success(`Switched to folder: ${selectedFolder.label}`);
      } catch (err) {
        console.error('Failed to switch folder:', err);
        if (toast) toast.error('Failed to switch folder');
      }
    },
    /* onRenameFolder */ null,
    /* onDeleteFolder */ null,
    /* onInsertFolder */ null,
    /* currentFolder */ currentFolder?.uid
  );
}
