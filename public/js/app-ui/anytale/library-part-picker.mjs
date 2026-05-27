/**
 * library-part-picker.mjs - Shared "Add Parts from Library" picker.
 *
 * Opens a searchable multi-select modal so the user can add or remove multiple
 * parts in one interaction.  Pre-checks parts that are already present in the
 * active list (via currentPartUids).  Parent components own add/remove because
 * each stores parts in a different shape.
 */
import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import { Button } from '../../custom-ui/io/button.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object}   props
 * @param {Array}    props.libraryParts        - All available library parts
 * @param {string[]} [props.currentPartUids=[]] - UIDs of parts already in the active list;
 *                                               used to pre-check items in the modal
 * @param {Function} props.onSelectPart        - (partConfig) => void — called for each newly added part
 * @param {Function} [props.onRemovePart]      - (uid) => void — called for each part removed
 * @param {boolean}  [props.disabled=false]
 * @param {string}   [props.label='Browse Library']
 * @param {string}   [props.modalTitle='Add Parts from Library']
 */
export function LibraryPartPicker({
  libraryParts = [],
  currentPartUids = [],
  onSelectPart,
  onRemovePart,
  disabled = false,
  label = 'Browse Library',
  modalTitle = 'Add Parts from Library',
}) {
  const [modalOpen, setModalOpen] = useState(false);

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
    <${Button}
      variant="medium-text"
      icon="search"
      widthScale="full"
      disabled=${disabled || libraryParts.length === 0}
      onClick=${() => setModalOpen(true)}
    >${label}<//>

    <${SearchSelectModal}
      isOpen=${modalOpen}
      title=${modalTitle}
      items=${libraryParts.map(part => ({
        label: part.name || part.referenceTag || part.uid,
        value: part.uid,
        subtitle: Array.isArray(part.type) ? part.type.join(', ') : '',
      }))}
      mode="multi"
      initialSelected=${currentPartUids}
      onSelect=${handleModalSelect}
      onClose=${() => setModalOpen(false)}
    />
  `;
}

export default LibraryPartPicker;
