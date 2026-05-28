/**
 * chip-autocomplete-input.mjs – Autocomplete input with a chip row.
 *
 * Composes AutocompleteInput with a row of removable chip buttons below it.
 * Each chip uses the `chip` Button variant with an `x` icon. The input
 * deduplicates case-insensitively before appending.
 *
 * A search icon button is shown inline with the input whenever there are
 * suggestions to browse. Clicking it opens a SearchSelectModal in multi-select
 * mode. The modal is pre-seeded with the current `values` as the initial
 * selection, and `onValuesChange` is called immediately on every toggle so the
 * chip row stays in sync while the modal is open.
 */
import { html } from 'htm/preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { VerticalLayout } from '../custom-ui/themed-base.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { AutocompleteInput } from './autocomplete-input.mjs';
import { SearchSelectModal } from '../custom-ui/overlays/search-select.mjs';

// ============================================================================
// Styled Components
// ============================================================================


const ChipRow = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: center;
`;
ChipRow.className = 'chip-autocomplete-chip-row';

const InputSearchRow = styled('div')`
  display: flex;
  gap: 8px;
  align-items: flex-end;
  width: 100%;
`;
InputSearchRow.className = 'chip-autocomplete-input-search-row';

const InputFlex = styled('div')`
  flex: 1;
  min-width: 0;
`;
InputFlex.className = 'chip-autocomplete-input-flex';

const ButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 44px;
`;
ButtonWrapper.className = 'autocomplete-input-button-wrapper';

// ============================================================================
// Helpers
// ============================================================================

function normalizeSearchItems(items) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  const out = [];

  for (const item of items) {
    const normalized = typeof item === 'string'
      ? { label: item, value: item }
      : {
          label: String(item?.label ?? item?.value ?? ''),
          value: item?.value ?? item?.label,
        };

    if (!normalized.label || normalized.value === undefined || normalized.value === null) continue;

    const key = String(normalized.value).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ChipAutocompleteInput – autocomplete input that appends selected values as chips.
 *
 * @param {string}   props.label
 * @param {string}   [props.placeholder]
 * @param {string[]} props.suggestions       – autocomplete candidates
 * @param {string[]} props.values            – current chip list
 * @param {Function} props.onValuesChange    – (newValues: string[]) => void
 * @param {boolean}  [props.disabled]
 * @param {Array<string|{label:string,value:string}>} [props.searchItems]
 *   Optional override for the modal items. By default, the modal uses
 *   `suggestions`. The item values must match the strings stored in `values`
 *   so that current chips are pre-checked on open.
 * @param {string}   [props.searchTitle]     – modal title (defaults to "Select {label}")
 *
 * @example
 * // Basic usage
 * <${ChipAutocompleteInput}
 *   label="Types"
 *   placeholder="Add a type..."
 *   suggestions=${['hair', 'outfit', 'accessory']}
 *   values=${part.config.type}
 *   onValuesChange=${(v) => updateConfig({ type: v })}
 * />
 *
 * @example
 * // With custom modal labels/values
 * <${ChipAutocompleteInput}
 *   label="Preferred Outfits"
 *   placeholder="Type to add an outfit..."
 *   suggestions=${outfitList.map(o => o.name)}
 *   values=${preferredOutfitNames}
 *   onValuesChange=${handlePreferredOutfitsChange}
 *   searchItems=${outfitList.map(o => o.name)}
 *   searchTitle="Select Preferred Outfits"
 * />
 */
export function ChipAutocompleteInput({
  label,
  placeholder,
  suggestions = [],
  values = [],
  onValuesChange,
  disabled = false,
  searchItems,
  searchTitle,
}) {
  // ── Internal modal open state ────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);

  const browseItems = useMemo(
    () => normalizeSearchItems(searchItems ?? suggestions),
    [searchItems, suggestions]
  );
  const hasSearch = browseItems.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelect = useCallback((value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    // Case-insensitive duplicate check
    if (values.some(v => v.toLowerCase() === trimmed.toLowerCase())) return;
    onValuesChange([...values, trimmed]);
  }, [values, onValuesChange]);

  const handleRemove = useCallback((index) => {
    onValuesChange(values.filter((_, i) => i !== index));
  }, [values, onValuesChange]);

  // Called on every checkbox toggle in the modal — immediately replaces the
  // chip list so the two controls stay in sync while the modal is open.
  const handleModalSelect = useCallback((selectedValues) => {
    onValuesChange(selectedValues);
  }, [onValuesChange]);

  // ── Render ────────────────────────────────────────────────────────────────

  return html`
    <${VerticalLayout} gap="small">
    ${hasSearch ? html`
      <${InputSearchRow}>
        <${InputFlex}>
          <${AutocompleteInput}
            label=${label}
            placeholder=${placeholder}
            suggestions=${suggestions}
            onSelect=${handleSelect}
            disabled=${disabled}
          />
        </${InputFlex}>
        <${ButtonWrapper}>
          <${Button}
            variant="medium-icon"
            icon="search"
            title="Browse all options"
            disabled=${disabled}
            onClick=${() => setSearchOpen(true)}
          />
        </${ButtonWrapper}>
      </${InputSearchRow}>
    ` : html`
      <${AutocompleteInput}
        label=${label}
        placeholder=${placeholder}
        suggestions=${suggestions}
        onSelect=${handleSelect}
        disabled=${disabled}
      />
    `}
    ${values.length > 0 && html`
      <${ChipRow}>
        ${values.map((v, i) => html`
          <${Button}
            key=${v + i}
            variant="chip"
            color="primary"
            icon="x"
            disabled=${disabled}
            onClick=${() => handleRemove(i)}
          >${v}<//>
        `)}
      </${ChipRow}>
    `}

    ${hasSearch && html`
      <${SearchSelectModal}
        isOpen=${searchOpen}
        title=${searchTitle || (label ? `Select ${label}` : 'Select')}
        items=${browseItems}
        mode="multi"
        initialSelected=${values}
        onSelect=${handleModalSelect}
        onClose=${() => setSearchOpen(false)}
      />
    `}
    </${VerticalLayout}>
  `;
}
