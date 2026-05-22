/**
 * library-part-picker.mjs - Shared "Add Part from Library" picker.
 *
 * Combines the standard autocomplete input with a single-select browse modal.
 * Parent components own the resulting add behavior because each stores parts in
 * a different shape.
 */
import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { SearchSelectModal } from '../../custom-ui/overlays/search-select.mjs';
import { AutocompleteInput } from '../autocomplete-input.mjs';

// ============================================================================
// Styled Components
// ============================================================================

const PickerRow = styled('div')`
  display: flex;
  gap: 8px;
  align-items: flex-end;
  width: 100%;
`;
PickerRow.className = 'library-part-picker-row';

const InputFlex = styled('div')`
  flex: 1;
  min-width: 0;
`;
InputFlex.className = 'library-part-picker-input-flex';

const ButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 44px;
`;
ButtonWrapper.className = 'autocomplete-input-button-wrapper';

// ============================================================================
// Component
// ============================================================================

/**
 * @param {Object} props
 * @param {Array} props.libraryParts
 * @param {Function} props.onSelectPart - (partConfig) => void
 * @param {Function} [props.onMissingPart] - (inputValue) => void
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.label='Add Part from Library']
 * @param {string} [props.placeholder='Type to search saved parts...']
 * @param {string} [props.modalTitle='Add Part from Library']
 */
export function LibraryPartPicker({
  libraryParts = [],
  onSelectPart,
  onMissingPart,
  disabled = false,
  label = 'Add Part from Library',
  placeholder = 'Type to search saved parts...',
  modalTitle = 'Add Part from Library',
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleAutocompleteSelect = useCallback((inputValue) => {
    const trimmed = (inputValue || '').trim();
    if (!trimmed) return;

    const match = libraryParts.find(part =>
      part.name?.toLowerCase() === trimmed.toLowerCase()
    );

    if (!match) {
      onMissingPart?.(trimmed);
      return;
    }

    onSelectPart?.(match);
  }, [libraryParts, onMissingPart, onSelectPart]);

  const handleModalSelect = useCallback((uid) => {
    const match = libraryParts.find(part => part.uid === uid);
    if (match) onSelectPart?.(match);
  }, [libraryParts, onSelectPart]);

  return html`
    <${PickerRow}>
      <${InputFlex}>
        <${AutocompleteInput}
          label=${label}
          placeholder=${placeholder}
          suggestions=${libraryParts.map(part => part.name)}
          onSelect=${handleAutocompleteSelect}
          disabled=${disabled}
        />
      </${InputFlex}>
      <${ButtonWrapper}>
        <${Button}
          variant="medium-icon"
          icon="search"
          title="Browse saved parts"
          disabled=${disabled || libraryParts.length === 0}
          onClick=${() => setModalOpen(true)}
        />
      </${ButtonWrapper}>
      <${SearchSelectModal}
        isOpen=${modalOpen}
        title=${modalTitle}
        items=${libraryParts.map(part => {
          const types = Array.isArray(part.type) && part.type.length > 0 ? ` (${part.type.join(', ')})` : '';
          return { label: (part.name || part.uid) + types, value: part.uid };
        })}
        mode="single"
        onSelect=${handleModalSelect}
        onClose=${() => setModalOpen(false)}
      />
    </${PickerRow}>
  `;
}

export default LibraryPartPicker;
