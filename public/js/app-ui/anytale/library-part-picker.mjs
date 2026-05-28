/**
 * library-part-picker.mjs - Shared "Add Parts from Library" modal.
 *
 * A purely controlled multi-select modal: the parent owns the open/close state
 * and passes isOpen/onClose.  Pre-checks parts already present in the active
 * list (via currentPartUids) so the user can add or remove multiple parts in
 * one interaction.
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen              - Whether the modal is visible
 * @param {Function} props.onClose             - Called when the modal should close
 * @param {Array}    props.libraryParts        - All available library parts
 * @param {string[]} [props.currentPartUids=[]] - UIDs of parts already in the active list;
 *                                               used to pre-check items in the modal
 * @param {Function} props.onSelectPart        - (partConfig) => void — called for each newly added part
 * @param {Function} [props.onRemovePart]      - (uid) => void — called for each part removed
 * @param {string}   [props.modalTitle='Add Parts from Library']
 */
export function LibraryPartPicker({
  isOpen = false,
  onClose,
  libraryParts = [],
  currentPartUids = [],
  onSelectPart,
  onRemovePart,
  modalTitle = 'Add Parts from Library',
}) {
  // Called by SearchSelectModal on every toggle: array of all currently-selected UIDs.
  const handleModalSelect = useCallback((selectedUids) => {
    const selectedSet = new Set(selectedUids);
    const currentSet = new Set(currentPartUids);

    // Add newly checked parts
    for (const uid of selectedSet) {
      if (!currentSet.has(uid)) {
        const match = libraryParts.find(p => p.uid === uid);
        if (match) onSelectPart?.(match);
      }
    }

    // Remove newly unchecked parts
    for (const uid of currentSet) {
      if (!selectedSet.has(uid)) {
        onRemovePart?.(uid);
      }
    }
  }, [libraryParts, currentPartUids, onSelectPart, onRemovePart]);

  return html`
    <${SearchSelectModal}
      isOpen=${isOpen}
      title=${modalTitle}
      items=${libraryParts.map(part => ({
        label: part.name || part.referenceTag || part.uid,
        value: part.uid,
        subtitle: Array.isArray(part.type) ? part.type.join(', ') : '',
      }))}
      mode="multi"
      initialSelected=${currentPartUids}
      onSelect=${handleModalSelect}
      onClose=${onClose}
    />
  `;
}

export default LibraryPartPicker;
